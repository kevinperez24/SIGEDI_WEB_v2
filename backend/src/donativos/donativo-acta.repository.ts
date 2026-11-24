import { TextCodec } from 'surrealdb'
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
  ORDER BY version DESC
  LIMIT 1;
`

const CREATE_VERSION_QUERY = `
  BEGIN TRANSACTION;
  UPDATE donativo_actas
  SET estado = 'REEMPLAZADA', updated_by = $created_by
  WHERE donativo_id = $donativo_id AND estado = 'ACTIVA';
  CREATE donativo_actas CONTENT {
    donativo_id: $donativo_id,
    version: $version,
    estado: 'ACTIVA',
    nombre_archivo: $nombre_archivo,
    nombre_almacenado: $nombre_almacenado,
    ruta_archivo: $ruta_archivo,
    mime_type: 'application/pdf',
    size_bytes: $size_bytes,
    created_by: $created_by,
    updated_by: NONE
  }
  RETURN id, version, estado, nombre_archivo;
  COMMIT TRANSACTION;
`

const FIND_ACTIVE_QUERY = `
  SELECT id, version, estado, nombre_archivo
  FROM donativo_actas
  WHERE donativo_id = $donativo_id AND estado = 'ACTIVA'
  ORDER BY version DESC
  LIMIT 1;
`

const FIND_ACTIVE_FILE_QUERY = `
  SELECT version, nombre_archivo, ruta_archivo, mime_type
  FROM donativo_actas
  WHERE donativo_id = $donativo_id AND estado = 'ACTIVA'
  ORDER BY version DESC
  LIMIT 1;
`

type ActaRecord = {
  id: unknown
  version: number
  estado: 'ACTIVA'
  nombre_archivo: string
}

type ActaFileRecord = {
  nombre_archivo: string
  ruta_archivo: string
  mime_type: 'application/pdf'
}

function donationRecordId(donativoId: string) {
  const recordId = TextCodec.parseRecordId(donativoId)
  if (recordId.table.name !== 'donativos') throw new DatabaseQueryError()
  return recordId
}

function mapActa(record: ActaRecord): DonationActaSummary {
  return {
    id: String(record.id),
    version: Number(record.version),
    estado: 'ACTIVA',
    nombre_archivo: record.nombre_archivo,
  }
}

export interface DonationActaRepository {
  nextVersion(donativoId: string): Promise<number>
  createVersion(metadata: DonationActaMetadata): Promise<DonationActaSummary>
  findActive(donativoId: string): Promise<DonationActaSummary | null>
  findActiveFile(donativoId: string): Promise<DonationActaFile | null>
}

export class SurrealDonationActaRepository implements DonationActaRepository {
  async nextVersion(donativoId: string): Promise<number> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[{ version: number }[]]>(LATEST_VERSION_QUERY, {
        donativo_id: donationRecordId(donativoId),
      })
      return Number(records[0]?.version ?? 0) + 1
    } catch (error) {
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
        created_by: metadata.createdBy,
      })
      const records = [...results].reverse().find(
        (result): result is ActaRecord[] =>
          Array.isArray(result) && result.some((item) => this.isActaRecord(item)),
      )
      const record = records?.find((item) => this.isActaRecord(item))
      if (!record) throw new DatabaseQueryError()
      return mapActa(record)
    } catch (error) {
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

  private isActaRecord(value: unknown): value is ActaRecord {
    if (!value || typeof value !== 'object') return false
    const record = value as Partial<ActaRecord>
    return record.estado === 'ACTIVA' && typeof record.nombre_archivo === 'string'
  }

  private rethrow(error: unknown): never {
    if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
      throw error
    }
    throw new DatabaseQueryError()
  }
}
