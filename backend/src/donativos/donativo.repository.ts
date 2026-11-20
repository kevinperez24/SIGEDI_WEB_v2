import { DateTime, TextCodec } from 'surrealdb'
import type { Surreal } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'
import type {
  CreatedDonation,
  DonationCreateInput,
  DonationDeletionPlan,
  DonationDetail,
  DonationListItem,
} from './donativo.types.ts'
import type { ReceptionPlace } from '../catalogos/lugar-recepcion.repository.ts'
import type { UpcRepresentative } from '../catalogos/representante-upc.repository.ts'

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
    representante_upc: IF $has_representante_upc THEN $representante_upc ELSE NONE END,
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
    representante_upc,
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
    representante_upc: IF $has_representante_upc THEN $representante_upc ELSE NONE END,
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
    representante_upc,
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

const LIST_RECEPTION_PLACES_QUERY = `
  SELECT id, codigo, nombre
  FROM catalogo_lugares_recepcion
  ORDER BY codigo ASC;
`

const FIND_RECEPTION_PLACES_QUERY = `
  SELECT id, codigo, nombre
  FROM catalogo_lugares_recepcion
  WHERE id IN $lugar_ids
  ORDER BY codigo ASC;
`

const FIND_UPC_REPRESENTATIVE_QUERY = `
  SELECT id, codigo, nombre
  FROM catalogo_representantes_upc
  WHERE id = $representante_id
  LIMIT 1;
`

const PREPARE_DONATION_DELETION_QUERY = `
  SELECT id FROM donativos WHERE id = $donativo_id LIMIT 1;
  SELECT id, ruta_archivo
  FROM donativo_documentos
  WHERE donativo_id = $donativo_id;
`

const DELETE_DONATION_CASCADE_QUERY = `
  BEGIN TRANSACTION;
  DELETE donativo_documentos WHERE donativo_id = $donativo_id;
  DELETE $donativo_id;
  COMMIT TRANSACTION;
`

type CreatedDonationRecord = {
  id: unknown
  estado: unknown
  correlativo_acta?: unknown
}

type DonationDetailRecord = Record<keyof Omit<DonationDetail, 'id'>, unknown> & {
  id: unknown
}

type ReceptionPlaceRecord = {
  id: unknown
  codigo?: unknown
  nombre?: unknown
}

type DeletionDocumentRecord = {
  ruta_archivo?: unknown
}

function donationRecordId(donativoId: string) {
  const recordId = TextCodec.parseRecordId(donativoId)
  if (recordId.table.name !== 'donativos') throw new DatabaseQueryError()
  return recordId
}

function receptionPlaceRecordId(value: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== 'catalogo_lugares_recepcion') throw new DatabaseQueryError()
  return recordId
}

function upcRepresentativeRecordId(value: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== 'catalogo_representantes_upc') throw new DatabaseQueryError()
  return recordId
}

function mapReceptionPlace(record: ReceptionPlaceRecord): ReceptionPlace {
  return {
    id: String(record.id),
    codigo: String(record.codigo ?? ''),
    nombre: String(record.nombre ?? ''),
  }
}

function mapReceptionPlaces(
  value: unknown,
  placesById: ReadonlyMap<string, ReceptionPlace>,
): ReceptionPlace[] {
  if (!Array.isArray(value)) return []
  return value
    .map((recordId) => placesById.get(String(recordId)))
    .filter((place): place is ReceptionPlace => Boolean(place))
}

async function findReceptionPlaces(database: Surreal, value: unknown): Promise<ReceptionPlace[]> {
  if (!Array.isArray(value) || value.length === 0) return []
  const [records] = await database.query<[ReceptionPlaceRecord[]]>(
    FIND_RECEPTION_PLACES_QUERY,
    { lugar_ids: value },
  )
  return records.map(mapReceptionPlace)
}

async function findUpcRepresentative(
  database: Surreal,
  value: unknown,
): Promise<UpcRepresentative | null> {
  if (!value) return null
  const [records] = await database.query<[ReceptionPlaceRecord[]]>(
    FIND_UPC_REPRESENTATIVE_QUERY,
    { representante_id: value },
  )
  const record = records[0]
  return record ? mapReceptionPlace(record) : null
}

function mapDonationDetail(
  record: DonationDetailRecord,
  createdByName: string | null = null,
  receptionPlaces: ReceptionPlace[] = [],
  representative: UpcRepresentative | null = null,
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
    lugar_recepcion: receptionPlaces,
    observaciones: typeof record.observaciones === 'string' ? record.observaciones : null,
    representante_upc: representative,
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
  prepareDeletion(donativoId: string): Promise<DonationDeletionPlan | null>
  deleteCascade(donativoId: string): Promise<void>
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
        lugar_recepcion: input.lugar_recepcion.map(receptionPlaceRecordId),
        observaciones: input.observaciones,
        has_representante_upc: Boolean(input.representante_upc),
        representante_upc: input.representante_upc
          ? upcRepresentativeRecordId(input.representante_upc)
          : null,
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
      const [records, receptionPlaceRecords] = await database.query<[
        Record<string, unknown>[],
        ReceptionPlaceRecord[],
      ]>(`${LIST_DONATIONS_QUERY}\n${LIST_RECEPTION_PLACES_QUERY}`)

      if (!Array.isArray(records)) throw new DatabaseQueryError()
      const receptionPlacesById = new Map(
        receptionPlaceRecords.map((record) => {
          const place = mapReceptionPlace(record)
          return [place.id, place] as const
        }),
      )

      return records.map((record) => ({
        id: String(record.id),
        correlativo_acta:
          typeof record.correlativo_acta === 'string' ? record.correlativo_acta : null,
        nombre_proyecto: String(record.nombre_proyecto ?? ''),
        tipo_gestion: String(record.tipo_gestion ?? ''),
        dpto_seccion: typeof record.dpto_seccion === 'string' ? record.dpto_seccion : null,
        fecha_recepcion: String(record.fecha_recepcion ?? ''),
        lugar_recepcion: mapReceptionPlaces(record.lugar_recepcion, receptionPlacesById),
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
      const [receptionPlaces, representative, createdByName] = await Promise.all([
        findReceptionPlaces(database, record.lugar_recepcion),
        findUpcRepresentative(database, record.representante_upc),
        findCreatorName(database, createdBy),
      ])
      return mapDonationDetail(
        record,
        createdByName,
        receptionPlaces,
        representative,
      )
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
        lugar_recepcion: input.lugar_recepcion.map(receptionPlaceRecordId),
        observaciones: input.observaciones,
        has_representante_upc: Boolean(input.representante_upc),
        representante_upc: input.representante_upc
          ? upcRepresentativeRecordId(input.representante_upc)
          : null,
        updated_by: updatedBy,
      })
      if (!records[0]) return null
      const receptionPlaces = await findReceptionPlaces(
        database,
        records[0].lugar_recepcion,
      )
      const representative = await findUpcRepresentative(
        database,
        records[0].representante_upc,
      )
      return mapDonationDetail(records[0], null, receptionPlaces, representative)
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  async prepareDeletion(donativoId: string): Promise<DonationDeletionPlan | null> {
    try {
      const database = await getSurreal()
      const [donations, documents] = await database.query<[
        { id: unknown }[],
        DeletionDocumentRecord[],
      ]>(PREPARE_DONATION_DELETION_QUERY, {
        donativo_id: donationRecordId(donativoId),
      })
      if (!donations[0]) return null
      if (documents.some((document) => typeof document.ruta_archivo !== 'string')) {
        throw new DatabaseQueryError()
      }
      return {
        documentPaths: documents.map((document) => String(document.ruta_archivo)),
        documentCount: documents.length,
      }
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  async deleteCascade(donativoId: string): Promise<void> {
    try {
      const database = await getSurreal()
      await database.query(DELETE_DONATION_CASCADE_QUERY, {
        donativo_id: donationRecordId(donativoId),
      })
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }
}
