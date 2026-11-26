import { RecordId, TextCodec } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'
import type {
  DonationActaFile,
  DonationActaMetadata,
  DonationActaSummary,
} from './donativo-acta.types.ts'

const LATEST_VERSION_QUERY = `
  SELECT version
  FROM donativo_actas
  WHERE donativo_id = $donativo_id
    AND tipo_acta = $tipo_acta
    AND ($tipo_acta = 'FINAL' OR numero_entrega = $numero_entrega)
  ORDER BY version DESC
  LIMIT 1;
`

const CREATE_VERSION_QUERY = `
  BEGIN TRANSACTION;
  UPDATE donativo_actas
  SET estado = 'REEMPLAZADA', updated_by = $created_by
  WHERE donativo_id = $donativo_id
    AND estado = 'ACTIVA'
    AND tipo_acta = $tipo_acta
    AND ($tipo_acta = 'FINAL' OR numero_entrega = $numero_entrega);
  CREATE donativo_actas CONTENT {
    donativo_id: $donativo_id,
    version: $version,
    estado: 'ACTIVA',
    nombre_archivo: $nombre_archivo,
    nombre_almacenado: $nombre_almacenado,
    ruta_archivo: $ruta_archivo,
    mime_type: 'application/pdf',
    size_bytes: $size_bytes,
    codigo_acta: $codigo_acta,
    tipo_acta: $tipo_acta,
    numero_entrega: $numero_entrega,
    income_ids: $income_ids,
    actas_referencia: $actas_referencia,
    es_acta_final: $es_acta_final,
    created_by: $created_by,
    updated_by: NONE
  }
  RETURN id, version, estado, nombre_archivo, codigo_acta, tipo_acta, numero_entrega,
    income_ids, actas_referencia, es_acta_final;
  UPDATE $target_income_id SET
    estado_recepcion = $reception_state,
    updated_by = $created_by;
  COMMIT TRANSACTION;
`

const FIND_ACTIVE_QUERY = `
  SELECT id, version, estado, nombre_archivo, codigo_acta, tipo_acta, numero_entrega,
    income_ids, actas_referencia, es_acta_final
  FROM donativo_actas
  WHERE donativo_id = $donativo_id AND estado = 'ACTIVA' AND es_acta_final = true
  ORDER BY version DESC
  LIMIT 1;
`

const FIND_ACTIVE_FILE_QUERY = `
  SELECT version, nombre_archivo, ruta_archivo, mime_type
  FROM donativo_actas
  WHERE donativo_id = $donativo_id AND estado = 'ACTIVA' AND es_acta_final = true
  ORDER BY version DESC
  LIMIT 1;
`

const LIST_ACTIVE_QUERY = `
  SELECT id, version, estado, nombre_archivo, codigo_acta, tipo_acta, numero_entrega,
    income_ids, actas_referencia, es_acta_final
  FROM donativo_actas
  WHERE donativo_id = $donativo_id AND estado = 'ACTIVA'
  ORDER BY numero_entrega ASC, tipo_acta ASC;
`

const FIND_ACTIVE_FILE_BY_ID_QUERY = `
  SELECT nombre_archivo, ruta_archivo, mime_type
  FROM donativo_actas
  WHERE id = $acta_id AND donativo_id = $donativo_id AND estado = 'ACTIVA'
  LIMIT 1;
`

type ActaRecord = {
  id: unknown
  version: number
  estado: 'ACTIVA'
  nombre_archivo: string
  codigo_acta: string
  tipo_acta: 'PROVISIONAL' | 'FINAL'
  numero_entrega: number
  income_ids: unknown[]
  actas_referencia: unknown[]
  es_acta_final: boolean
}

type ActaFileRecord = {
  nombre_archivo: string
  ruta_archivo: string
  mime_type: 'application/pdf'
}

type ActaDiagnosticContext = {
  operation: 'next_version' | 'persist_version'
  logicalAction: string
  donativoId: string
  tipoActa: 'PROVISIONAL' | 'FINAL'
  numeroEntrega: number
  version?: number
  incomeIds: string[]
}

function databaseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string' && message.trim()) return message
  }
  return 'Error de SurrealDB sin mensaje disponible.'
}

function logDatabaseFailure(context: ActaDiagnosticContext, error: unknown): void {
  if (process.env.NODE_ENV === 'production') return
  console.error('[donativo_actas] database_operation_failed', {
    operation: context.operation,
    logical_action: context.logicalAction,
    surreal_message: databaseErrorMessage(error),
    donativo_id: context.donativoId,
    tipo_acta: context.tipoActa,
    numero_entrega: context.numeroEntrega,
    version: context.version ?? null,
    income_ids: context.incomeIds,
  })
}

function recordId(value: string, expectedTable: 'donativos' | 'incomes' | 'donativo_actas') {
  try {
    const parsed = TextCodec.parseRecordId(value)
    if (parsed.table.name !== expectedTable) throw new DatabaseQueryError()
    return parsed
  } catch (error) {
    const prefix = `${expectedTable}:⟨`
    const uuid = value.startsWith(prefix) && value.endsWith('⟩')
      ? value.slice(prefix.length, -1)
      : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      if (error instanceof DatabaseQueryError) throw error
      throw new DatabaseQueryError()
    }
    return new RecordId(expectedTable, uuid)
  }
}

function donationRecordId(donativoId: string) {
  return recordId(donativoId, 'donativos')
}

function incomeRecordId(incomeId: string) {
  return recordId(incomeId, 'incomes')
}

function mapActa(record: ActaRecord): DonationActaSummary {
  return {
    id: String(record.id),
    version: Number(record.version),
    estado: 'ACTIVA',
    nombre_archivo: record.nombre_archivo,
    codigo_acta: record.codigo_acta,
    tipo_acta: record.tipo_acta,
    numero_entrega: Number(record.numero_entrega),
    income_ids: (record.income_ids ?? []).map(String),
    actas_referencia: (record.actas_referencia ?? []).map(String),
    es_acta_final: Boolean(record.es_acta_final),
  }
}

export interface DonationActaRepository {
  nextVersion(donativoId: string, tipoActa: 'PROVISIONAL' | 'FINAL', numeroEntrega: number): Promise<number>
  createVersion(metadata: DonationActaMetadata): Promise<DonationActaSummary>
  findActive(donativoId: string): Promise<DonationActaSummary | null>
  findActiveFile(donativoId: string): Promise<DonationActaFile | null>
  listActive(donativoId: string): Promise<DonationActaSummary[]>
  findActiveFileById(donativoId: string, actaId: string): Promise<DonationActaFile | null>
}

export class SurrealDonationActaRepository implements DonationActaRepository {
  async nextVersion(
    donativoId: string,
    tipoActa: 'PROVISIONAL' | 'FINAL',
    numeroEntrega: number,
  ): Promise<number> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[{ version: number }[]]>(LATEST_VERSION_QUERY, {
        donativo_id: donationRecordId(donativoId),
        tipo_acta: tipoActa,
        numero_entrega: numeroEntrega,
      })
      return Number(records[0]?.version ?? 0) + 1
    } catch (error) {
      logDatabaseFailure({
        operation: 'next_version',
        logicalAction: 'SELECT latest version scoped by donativo, tipo_acta and numero_entrega',
        donativoId,
        tipoActa,
        numeroEntrega,
        incomeIds: [],
      }, error)
      this.rethrow(error)
    }
  }

  async createVersion(metadata: DonationActaMetadata): Promise<DonationActaSummary> {
    try {
      const database = await getSurreal()
      const results = await database.query<unknown[]>(CREATE_VERSION_QUERY, {
        donativo_id: donationRecordId(metadata.donativoId),
        version: metadata.version,
        nombre_archivo: metadata.originalName,
        nombre_almacenado: metadata.storedName,
        ruta_archivo: metadata.relativePath,
        size_bytes: metadata.sizeBytes,
        codigo_acta: metadata.codigoActa,
        tipo_acta: metadata.tipoActa,
        numero_entrega: metadata.numeroEntrega,
        income_ids: metadata.incomeIds.map(incomeRecordId),
        actas_referencia: metadata.actasReferencia.map((id) => recordId(id, 'donativo_actas')),
        es_acta_final: metadata.esActaFinal,
        created_by: metadata.createdBy,
        target_income_id: incomeRecordId(metadata.targetIncomeId),
        reception_state: metadata.receptionState,
      })
      const records = [...results].reverse().find(
        (result): result is ActaRecord[] =>
          Array.isArray(result) && result.some((item) => this.isActaRecord(item)),
      )
      const record = records?.find((item) => this.isActaRecord(item))
      if (!record) throw new DatabaseQueryError()
      return mapActa(record)
    } catch (error) {
      const message = databaseErrorMessage(error)
      logDatabaseFailure({
        operation: 'persist_version',
        logicalAction: message.includes('idx_donativo_actas_version')
          ? 'CREATE donativo_actas metadata'
          : 'TRANSACTION replace active acta, CREATE donativo_actas and UPDATE target income',
        donativoId: metadata.donativoId,
        tipoActa: metadata.tipoActa,
        numeroEntrega: metadata.numeroEntrega,
        version: metadata.version,
        incomeIds: metadata.incomeIds,
      }, error)
      this.rethrow(error)
    }
  }

  async findActive(donativoId: string): Promise<DonationActaSummary | null> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[ActaRecord[]]>(FIND_ACTIVE_QUERY, {
        donativo_id: donationRecordId(donativoId),
      })
      return records[0] ? mapActa(records[0]) : null
    } catch (error) {
      this.rethrow(error)
    }
  }

  async findActiveFile(donativoId: string): Promise<DonationActaFile | null> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[ActaFileRecord[]]>(FIND_ACTIVE_FILE_QUERY, {
        donativo_id: donationRecordId(donativoId),
      })
      return records[0] ?? null
    } catch (error) {
      this.rethrow(error)
    }
  }

  async listActive(donativoId: string): Promise<DonationActaSummary[]> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[ActaRecord[]]>(LIST_ACTIVE_QUERY, {
        donativo_id: donationRecordId(donativoId),
      })
      return records.map(mapActa)
    } catch (error) {
      this.rethrow(error)
    }
  }

  async findActiveFileById(donativoId: string, actaId: string): Promise<DonationActaFile | null> {
    try {
      const parsedActaId = recordId(actaId, 'donativo_actas')
      const database = await getSurreal()
      const [records] = await database.query<[ActaFileRecord[]]>(FIND_ACTIVE_FILE_BY_ID_QUERY, {
        donativo_id: donationRecordId(donativoId),
        acta_id: parsedActaId,
      })
      return records[0] ?? null
    } catch (error) {
      this.rethrow(error)
    }
  }

  private isActaRecord(value: unknown): value is ActaRecord {
    if (!value || typeof value !== 'object') return false
    const record = value as Partial<ActaRecord>
    return record.estado === 'ACTIVA'
      && typeof record.nombre_archivo === 'string'
      && typeof record.codigo_acta === 'string'
      && (record.tipo_acta === 'PROVISIONAL' || record.tipo_acta === 'FINAL')
  }

  private rethrow(error: unknown): never {
    if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
      throw error
    }
    throw new DatabaseQueryError()
  }
}
