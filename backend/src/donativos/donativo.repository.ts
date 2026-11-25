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
import type { Section5CatalogItem } from '../catalogos/seccion5.repository.ts'
import type { CityCatalogItem } from '../catalogos/ciudad.repository.ts'

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
    n_comprobante: IF $n_comprobante = '' THEN NONE ELSE $n_comprobante END,
    fecha_comprobante: IF $has_fecha_comprobante THEN $fecha_comprobante ELSE NONE END,
    almacen_resguardo: IF $has_almacen_resguardo THEN $almacen_resguardo ELSE NONE END,
    lugar_distribucion: IF $has_lugar_distribucion THEN $lugar_distribucion ELSE NONE END,
    fechareport_financiero: IF $has_fechareport_financiero THEN $fechareport_financiero ELSE NONE END,
    almacen_destino: IF $has_almacen_destino THEN $almacen_destino ELSE NONE END,
    marco_acta: IF $marco_acta = '' THEN NONE ELSE $marco_acta END,
    objetivo_acta: IF $objetivo_acta = '' THEN NONE ELSE $objetivo_acta END,
    entregados_acta: IF $entregados_acta = '' THEN NONE ELSE $entregados_acta END,
    entrega_acta: IF $entrega_acta = '' THEN NONE ELSE $entrega_acta END,
    ciudad: IF $has_ciudad THEN $ciudad ELSE NONE END,
    nombre_donante: IF $nombre_donante = '' THEN NONE ELSE $nombre_donante END,
    cargo_donante: IF $cargo_donante = '' THEN NONE ELSE $cargo_donante END,
    nombre_entidad: IF $nombre_entidad = '' THEN NONE ELSE $nombre_entidad END,
    dui_donante: IF $dui_donante = '' THEN NONE ELSE $dui_donante END,
    encargado_personal_id: IF $encargado_personal_id = '' THEN NONE ELSE $encargado_personal_id END,
    nombre_encargado: IF $nombre_encargado = '' THEN NONE ELSE $nombre_encargado END,
    cargo_encargado: IF $cargo_encargado = '' THEN NONE ELSE $cargo_encargado END,
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
    n_comprobante,
    fecha_comprobante,
    almacen_resguardo,
    lugar_distribucion,
    fechareport_financiero,
    almacen_destino,
    marco_acta,
    objetivo_acta,
    entregados_acta,
    entrega_acta,
    ciudad,
    nombre_donante,
    cargo_donante,
    nombre_entidad,
    dui_donante,
    encargado_personal_id,
    nombre_encargado,
    cargo_encargado,
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
    n_comprobante: IF $n_comprobante = '' THEN NONE ELSE $n_comprobante END,
    fecha_comprobante: IF $has_fecha_comprobante THEN $fecha_comprobante ELSE NONE END,
    almacen_resguardo: IF $has_almacen_resguardo THEN $almacen_resguardo ELSE NONE END,
    lugar_distribucion: IF $has_lugar_distribucion THEN $lugar_distribucion ELSE NONE END,
    fechareport_financiero: IF $has_fechareport_financiero THEN $fechareport_financiero ELSE NONE END,
    almacen_destino: IF $has_almacen_destino THEN $almacen_destino ELSE NONE END,
    marco_acta: IF $marco_acta = '' THEN NONE ELSE $marco_acta END,
    objetivo_acta: IF $objetivo_acta = '' THEN NONE ELSE $objetivo_acta END,
    entregados_acta: IF $entregados_acta = '' THEN NONE ELSE $entregados_acta END,
    entrega_acta: IF $entrega_acta = '' THEN NONE ELSE $entrega_acta END,
    ciudad: IF $has_ciudad THEN $ciudad ELSE NONE END,
    nombre_donante: IF $nombre_donante = '' THEN NONE ELSE $nombre_donante END,
    cargo_donante: IF $cargo_donante = '' THEN NONE ELSE $cargo_donante END,
    nombre_entidad: IF $nombre_entidad = '' THEN NONE ELSE $nombre_entidad END,
    dui_donante: IF $dui_donante = '' THEN NONE ELSE $dui_donante END,
    encargado_personal_id: IF $encargado_personal_id = '' THEN NONE ELSE $encargado_personal_id END,
    nombre_encargado: IF $nombre_encargado = '' THEN NONE ELSE $nombre_encargado END,
    cargo_encargado: IF $cargo_encargado = '' THEN NONE ELSE $cargo_encargado END,
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
    n_comprobante,
    fecha_comprobante,
    almacen_resguardo,
    lugar_distribucion,
    fechareport_financiero,
    almacen_destino,
    marco_acta,
    objetivo_acta,
    entregados_acta,
    entrega_acta,
    ciudad,
    nombre_donante,
    cargo_donante,
    nombre_entidad,
    dui_donante,
    encargado_personal_id,
    nombre_encargado,
    cargo_encargado,
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

const FIND_SECTION5_CATALOGS_QUERY = `
  SELECT id, codigo, nombre FROM catalogo_almacenes_resguardo
  WHERE id = $almacen_resguardo LIMIT 1;
  SELECT id, codigo, nombre FROM catalogo_lugares_distribucion
  WHERE id IN $lugares_distribucion ORDER BY codigo ASC;
  SELECT id, codigo, nombre FROM catalogo_almacenes_destino
  WHERE id = $almacen_destino LIMIT 1;
`

const FIND_CITY_QUERY = `
  SELECT id, codigo, ciudad, departamento
  FROM catalogo_ciudades_departamentos
  WHERE id = $ciudad_id
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
  LET $income_ids = SELECT VALUE id FROM incomes WHERE donativo_id = $donativo_id;
  DELETE detincomes WHERE income_id IN $income_ids;
  DELETE incomes WHERE donativo_id = $donativo_id;
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

function section5RecordId(value: string, table: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== table) throw new DatabaseQueryError()
  return recordId
}

function cityRecordId(value: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== 'catalogo_ciudades_departamentos') {
    throw new DatabaseQueryError()
  }
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

function mapSection5Item(record: ReceptionPlaceRecord): Section5CatalogItem {
  return mapReceptionPlace(record)
}

async function findSection5Catalogs(
  database: Surreal,
  record: DonationDetailRecord,
): Promise<[
  Section5CatalogItem | null,
  Section5CatalogItem[],
  Section5CatalogItem | null,
]> {
  const [safekeepingWarehouses, distributionPlaces, destinationWarehouses] =
    await database.query<[
      ReceptionPlaceRecord[],
      ReceptionPlaceRecord[],
      ReceptionPlaceRecord[],
    ]>(FIND_SECTION5_CATALOGS_QUERY, {
      almacen_resguardo: record.almacen_resguardo ?? null,
      lugares_distribucion: Array.isArray(record.lugar_distribucion)
        ? record.lugar_distribucion
        : [],
      almacen_destino: record.almacen_destino ?? null,
    })
  return [
    safekeepingWarehouses[0] ? mapSection5Item(safekeepingWarehouses[0]) : null,
    distributionPlaces.map(mapSection5Item),
    destinationWarehouses[0] ? mapSection5Item(destinationWarehouses[0]) : null,
  ]
}

async function findCity(database: Surreal, value: unknown): Promise<CityCatalogItem | null> {
  if (!value) return null
  const [records] = await database.query<[
    { id: unknown; codigo?: unknown; ciudad?: unknown; departamento?: unknown }[],
  ]>(FIND_CITY_QUERY, { ciudad_id: value })
  const record = records[0]
  return record
    ? {
        id: String(record.id),
        codigo: String(record.codigo ?? ''),
        ciudad: String(record.ciudad ?? ''),
        departamento: String(record.departamento ?? ''),
      }
    : null
}

function mapDonationDetail(
  record: DonationDetailRecord,
  createdByName: string | null = null,
  receptionPlaces: ReceptionPlace[] = [],
  representative: UpcRepresentative | null = null,
  safekeepingWarehouse: Section5CatalogItem | null = null,
  distributionPlaces: Section5CatalogItem[] = [],
  destinationWarehouse: Section5CatalogItem | null = null,
  city: CityCatalogItem | null = null,
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
    n_comprobante:
      typeof record.n_comprobante === 'string' ? record.n_comprobante : null,
    fecha_comprobante:
      record.fecha_comprobante ? String(record.fecha_comprobante) : null,
    almacen_resguardo: safekeepingWarehouse,
    lugar_distribucion: distributionPlaces,
    fechareport_financiero:
      record.fechareport_financiero ? String(record.fechareport_financiero) : null,
    almacen_destino: destinationWarehouse,
    marco_acta: typeof record.marco_acta === 'string' ? record.marco_acta : null,
    objetivo_acta: typeof record.objetivo_acta === 'string' ? record.objetivo_acta : null,
    entregados_acta:
      typeof record.entregados_acta === 'string' ? record.entregados_acta : null,
    entrega_acta: typeof record.entrega_acta === 'string' ? record.entrega_acta : null,
    ciudad: city,
    nombre_donante:
      typeof record.nombre_donante === 'string' ? record.nombre_donante : null,
    cargo_donante:
      typeof record.cargo_donante === 'string' ? record.cargo_donante : null,
    nombre_entidad:
      typeof record.nombre_entidad === 'string' ? record.nombre_entidad : null,
    dui_donante: typeof record.dui_donante === 'string' ? record.dui_donante : null,
    encargado_personal_id:
      typeof record.encargado_personal_id === 'string' ? record.encargado_personal_id : null,
    nombre_encargado:
      typeof record.nombre_encargado === 'string' ? record.nombre_encargado : null,
    cargo_encargado:
      typeof record.cargo_encargado === 'string' ? record.cargo_encargado : null,
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
        n_comprobante: input.n_comprobante,
        has_fecha_comprobante: Boolean(input.fecha_comprobante),
        fecha_comprobante: input.fecha_comprobante
          ? new DateTime(`${input.fecha_comprobante}T00:00:00.000Z`)
          : null,
        has_almacen_resguardo: Boolean(input.almacen_resguardo),
        almacen_resguardo: input.almacen_resguardo
          ? section5RecordId(input.almacen_resguardo, 'catalogo_almacenes_resguardo')
          : null,
        has_lugar_distribucion: input.lugar_distribucion.length > 0,
        lugar_distribucion: input.lugar_distribucion.map((value) =>
          section5RecordId(value, 'catalogo_lugares_distribucion'),
        ),
        has_fechareport_financiero: Boolean(input.fechareport_financiero),
        fechareport_financiero: input.fechareport_financiero
          ? new DateTime(`${input.fechareport_financiero}T00:00:00.000Z`)
          : null,
        has_almacen_destino: Boolean(input.almacen_destino),
        almacen_destino: input.almacen_destino
          ? section5RecordId(input.almacen_destino, 'catalogo_almacenes_destino')
          : null,
        marco_acta: input.marco_acta,
        objetivo_acta: input.objetivo_acta,
        entregados_acta: input.entregados_acta,
        entrega_acta: input.entrega_acta,
        has_ciudad: Boolean(input.ciudad),
        ciudad: input.ciudad ? cityRecordId(input.ciudad) : null,
        nombre_donante: input.nombre_donante,
        cargo_donante: input.cargo_donante,
        nombre_entidad: input.nombre_entidad,
        dui_donante: input.dui_donante,
        encargado_personal_id: input.encargado_personal_id,
        nombre_encargado: input.nombre_encargado,
        cargo_encargado: input.cargo_encargado,
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
      const [receptionPlaces, representative, createdByName, section5Catalogs, city] = await Promise.all([
        findReceptionPlaces(database, record.lugar_recepcion),
        findUpcRepresentative(database, record.representante_upc),
        findCreatorName(database, createdBy),
        findSection5Catalogs(database, record),
        findCity(database, record.ciudad),
      ])
      return mapDonationDetail(
        record,
        createdByName,
        receptionPlaces,
        representative,
        ...section5Catalogs,
        city,
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
        n_comprobante: input.n_comprobante,
        has_fecha_comprobante: Boolean(input.fecha_comprobante),
        fecha_comprobante: input.fecha_comprobante
          ? new DateTime(`${input.fecha_comprobante}T00:00:00.000Z`)
          : null,
        has_almacen_resguardo: Boolean(input.almacen_resguardo),
        almacen_resguardo: input.almacen_resguardo
          ? section5RecordId(input.almacen_resguardo, 'catalogo_almacenes_resguardo')
          : null,
        has_lugar_distribucion: input.lugar_distribucion.length > 0,
        lugar_distribucion: input.lugar_distribucion.map((value) =>
          section5RecordId(value, 'catalogo_lugares_distribucion'),
        ),
        has_fechareport_financiero: Boolean(input.fechareport_financiero),
        fechareport_financiero: input.fechareport_financiero
          ? new DateTime(`${input.fechareport_financiero}T00:00:00.000Z`)
          : null,
        has_almacen_destino: Boolean(input.almacen_destino),
        almacen_destino: input.almacen_destino
          ? section5RecordId(input.almacen_destino, 'catalogo_almacenes_destino')
          : null,
        marco_acta: input.marco_acta,
        objetivo_acta: input.objetivo_acta,
        entregados_acta: input.entregados_acta,
        entrega_acta: input.entrega_acta,
        has_ciudad: Boolean(input.ciudad),
        ciudad: input.ciudad ? cityRecordId(input.ciudad) : null,
        nombre_donante: input.nombre_donante,
        cargo_donante: input.cargo_donante,
        nombre_entidad: input.nombre_entidad,
        dui_donante: input.dui_donante,
        encargado_personal_id: input.encargado_personal_id,
        nombre_encargado: input.nombre_encargado,
        cargo_encargado: input.cargo_encargado,
        updated_by: updatedBy,
      })
      if (!records[0]) return null
      const [receptionPlaces, representative, section5Catalogs, city] = await Promise.all([
        findReceptionPlaces(database, records[0].lugar_recepcion),
        findUpcRepresentative(database, records[0].representante_upc),
        findSection5Catalogs(database, records[0]),
        findCity(database, records[0].ciudad),
      ])
      return mapDonationDetail(
        records[0],
        null,
        receptionPlaces,
        representative,
        ...section5Catalogs,
        city,
      )
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
