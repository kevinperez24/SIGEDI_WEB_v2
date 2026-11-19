import { DateTime, TextCodec } from 'surrealdb'
import type { Surreal } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'
import type {
  CreatedDonation,
  DonationCreateInput,
  DonationDetail,
  DonationListItem,
} from './donativo.types.ts'

const CREATE_DONATION_QUERY = `
  CREATE donativos CONTENT {
    created_by: $created_by,
    estado: 'BORRADOR',
    correlativo_acta: NONE,
    tipo_registro: $tipo_registro,
    nombre_proyecto: $nombre_proyecto,
    tipo_gestion: $tipo_gestion,
    dpto_seccion: IF $dpto_seccion = '' THEN NONE ELSE $dpto_seccion END,
    fecha_recepcion: $fecha_recepcion,
    lugar_recepcion: $lugar_recepcion,
    observaciones: IF $observaciones = '' THEN NONE ELSE $observaciones END,
    updated_by: NONE
  }
  RETURN id, estado, correlativo_acta;
`

const LIST_DONATIONS_QUERY = `
  SELECT
    id,
    correlativo_acta,
    nombre_proyecto,
    tipo_gestion,
    dpto_seccion,
    fecha_recepcion,
    lugar_recepcion,
    estado,
    created_at
  FROM donativos
  ORDER BY created_at DESC;
`

const GET_DONATION_QUERY = `
  SELECT
    id,
    correlativo_acta,
    estado,
    tipo_registro,
    nombre_proyecto,
    tipo_gestion,
    dpto_seccion,
    fecha_recepcion,
    lugar_recepcion,
    observaciones,
    created_by,
    created_at,
    updated_by,
    updated_at
  FROM donativos
  WHERE id = $donativo_id
  LIMIT 1;
`

const UPDATE_DONATION_QUERY = `
  UPDATE $donativo_id MERGE {
    tipo_registro: $tipo_registro,
    nombre_proyecto: $nombre_proyecto,
    tipo_gestion: $tipo_gestion,
    dpto_seccion: IF $dpto_seccion = '' THEN NONE ELSE $dpto_seccion END,
    fecha_recepcion: $fecha_recepcion,
    lugar_recepcion: $lugar_recepcion,
    observaciones: IF $observaciones = '' THEN NONE ELSE $observaciones END,
    updated_by: $updated_by
  }
  RETURN
    id,
    correlativo_acta,
    estado,
    tipo_registro,
    nombre_proyecto,
    tipo_gestion,
    dpto_seccion,
    fecha_recepcion,
    lugar_recepcion,
    observaciones,
    created_by,
    created_at,
    updated_by,
    updated_at;
`

const FIND_CREATOR_QUERY = `
  SELECT nombres, apellidos
  FROM usuarios
  WHERE id = $usuario_id
  LIMIT 1;
`

type CreatedDonationRecord = {
  id: unknown
  estado: unknown
  correlativo_acta?: unknown
}

type DonationDetailRecord = Record<keyof Omit<DonationDetail, 'id'>, unknown> & {
  id: unknown
}

function donationRecordId(donativoId: string) {
  const recordId = TextCodec.parseRecordId(donativoId)
  if (recordId.table.name !== 'donativos') throw new DatabaseQueryError()
  return recordId
}

function mapDonationDetail(
  record: DonationDetailRecord,
  createdByName: string | null = null,
): DonationDetail {
  return {
    id: String(record.id),
    correlativo_acta:
      typeof record.correlativo_acta === 'string' ? record.correlativo_acta : null,
    estado: String(record.estado ?? ''),
    tipo_registro: String(record.tipo_registro ?? ''),
    nombre_proyecto: String(record.nombre_proyecto ?? ''),
    tipo_gestion: String(record.tipo_gestion ?? ''),
    dpto_seccion: typeof record.dpto_seccion === 'string' ? record.dpto_seccion : null,
    fecha_recepcion: String(record.fecha_recepcion ?? ''),
    lugar_recepcion: String(record.lugar_recepcion ?? ''),
    observaciones: typeof record.observaciones === 'string' ? record.observaciones : null,
    created_by: String(record.created_by ?? ''),
    created_by_name: createdByName,
    created_at: String(record.created_at ?? ''),
    updated_by: typeof record.updated_by === 'string' ? record.updated_by : null,
    updated_at: String(record.updated_at ?? ''),
  }
}

async function findCreatorName(database: Surreal, createdBy: string): Promise<string | null> {
  try {
    const userId = TextCodec.parseRecordId(createdBy)
    if (userId.table.name !== 'usuarios') return null
    const [users] = await database.query<[{ nombres?: unknown; apellidos?: unknown }[]]>(
      FIND_CREATOR_QUERY,
      { usuario_id: userId },
    )
    const user = users[0]
    if (!user) return null
    const fullName = `${typeof user.nombres === 'string' ? user.nombres : ''} ${
      typeof user.apellidos === 'string' ? user.apellidos : ''
    }`.trim()
    return fullName || null
  } catch {
    return null
  }
}

export interface DonationRepository {
  create(createdBy: string, input: DonationCreateInput): Promise<CreatedDonation>
  list(): Promise<DonationListItem[]>
  findById(donativoId: string): Promise<DonationDetail | null>
  update(
    donativoId: string,
    updatedBy: string,
    input: DonationCreateInput,
  ): Promise<DonationDetail | null>
}

export class SurrealDonationRepository implements DonationRepository {
  async create(createdBy: string, input: DonationCreateInput): Promise<CreatedDonation> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[CreatedDonationRecord[]]>(CREATE_DONATION_QUERY, {
        created_by: createdBy,
        tipo_registro: input.tipo_registro,
        nombre_proyecto: input.nombre_proyecto,
        tipo_gestion: input.tipo_gestion,
        dpto_seccion: input.dpto_seccion,
        fecha_recepcion: new DateTime(`${input.fecha_recepcion}T00:00:00.000Z`),
        lugar_recepcion: input.lugar_recepcion,
        observaciones: input.observaciones,
      })
      const record = records[0]

      if (!record || record.estado !== 'BORRADOR') throw new DatabaseQueryError()

      return {
        id: String(record.id),
        estado: 'BORRADOR',
        correlativo_acta: null,
      }
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  async list(): Promise<DonationListItem[]> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[Record<string, unknown>[]]>(LIST_DONATIONS_QUERY)

      if (!Array.isArray(records)) throw new DatabaseQueryError()

      return records.map((record) => ({
        id: String(record.id),
        correlativo_acta:
          typeof record.correlativo_acta === 'string' ? record.correlativo_acta : null,
        nombre_proyecto: String(record.nombre_proyecto ?? ''),
        tipo_gestion: String(record.tipo_gestion ?? ''),
        dpto_seccion: typeof record.dpto_seccion === 'string' ? record.dpto_seccion : null,
        fecha_recepcion: String(record.fecha_recepcion ?? ''),
        lugar_recepcion: String(record.lugar_recepcion ?? ''),
        estado: String(record.estado ?? ''),
        created_at: String(record.created_at ?? ''),
      }))
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  async findById(donativoId: string): Promise<DonationDetail | null> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[DonationDetailRecord[]]>(GET_DONATION_QUERY, {
        donativo_id: donationRecordId(donativoId),
      })
      const record = records[0]
      if (!record) return null
      const createdBy = String(record.created_by ?? '')
      return mapDonationDetail(record, await findCreatorName(database, createdBy))
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  async update(
    donativoId: string,
    updatedBy: string,
    input: DonationCreateInput,
  ): Promise<DonationDetail | null> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[DonationDetailRecord[]]>(UPDATE_DONATION_QUERY, {
        donativo_id: donationRecordId(donativoId),
        tipo_registro: input.tipo_registro,
        nombre_proyecto: input.nombre_proyecto,
        tipo_gestion: input.tipo_gestion,
        dpto_seccion: input.dpto_seccion,
        fecha_recepcion: new DateTime(`${input.fecha_recepcion}T00:00:00.000Z`),
        lugar_recepcion: input.lugar_recepcion,
        observaciones: input.observaciones,
        updated_by: updatedBy,
      })
      return records[0] ? mapDonationDetail(records[0]) : null
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }
}
