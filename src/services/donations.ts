const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3001'

export type ReceptionPlace = {
  id: string
  codigo: string
  nombre: string
}

export type UpcRepresentative = {
  id: string
  codigo: string
  nombre: string
}

export type Section5CatalogItem = {
  id: string
  codigo: string
  nombre: string
}

export type CityCatalogItem = {
  id: string
  codigo: string
  ciudad: string
  departamento: string
}

export type ConapinaReceptionManager = {
  id: string
  nombre: string
  cargo: string
}

export type DonationDraftInput = {
  tipo_registro: string
  nombre_proyecto: string
  tipo_gestion: string
  dpto_seccion: string
  fecha_recepcion: string
  lugar_recepcion: string[]
  observaciones: string
  representante_upc: string
  n_comprobante: string
  fecha_comprobante: string
  almacen_resguardo: string
  lugar_distribucion: string[]
  fechareport_financiero: string
  almacen_destino: string
  marco_acta: string
  objetivo_acta: string
  entregados_acta: string
  entrega_acta: string
  ciudad: string
  nombre_donante: string
  cargo_donante: string
  nombre_entidad: string
  dui_donante: string
  encargado_personal_id: string
}

export type CreatedDonation = {
  id: string
  estado: 'BORRADOR'
  correlativo_acta: null
}

export type DonationDocumentType =
  | 'MEMO_INICIAL'
  | 'MEMO_DE'
  | 'ACTA_CONAPINA'
  | 'ACUERDO_DONACION'
  | 'COMPROBANTE_GF'
  | 'REGISTRO_FOTO_1'
  | 'REGISTRO_FOTO_2'

export type CreatedDonationDocument = {
  id: string
  tipo_documento: DonationDocumentType
  nombre_archivo: string
  estado: 'ACTIVO'
}

export type DonationDocumentItem = {
  id: string
  tipo_documento: DonationDocumentType
  nombre_archivo: string
  mime_type: string
  size_bytes: number
  estado: 'ACTIVO'
  created_at: string
}

export type DonationDetail = {
  id: string
  correlativo_acta: string | null
  estado: string
  tipo_registro: string
  nombre_proyecto: string
  tipo_gestion: string
  dpto_seccion: string | null
  fecha_recepcion: string
  lugar_recepcion: ReceptionPlace[]
  observaciones: string | null
  representante_upc: UpcRepresentative | null
  n_comprobante: string | null
  fecha_comprobante: string | null
  almacen_resguardo: Section5CatalogItem | null
  lugar_distribucion: Section5CatalogItem[]
  fechareport_financiero: string | null
  almacen_destino: Section5CatalogItem | null
  marco_acta: string | null
  objetivo_acta: string | null
  entregados_acta: string | null
  entrega_acta: string | null
  ciudad: CityCatalogItem | null
  nombre_donante: string | null
  cargo_donante: string | null
  nombre_entidad: string | null
  dui_donante: string | null
  encargado_personal_id: string | null
  nombre_encargado: string | null
  cargo_encargado: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type DonationDetailResult = {
  donativo: DonationDetail
  documentos: DonationDocumentItem[]
  acta: DonationActaSummary | null
}

export type DonationActaSummary = {
  id: string
  version: number
  estado: 'ACTIVA'
  nombre_archivo: string
  codigo_acta: string
  tipo_acta: 'PROVISIONAL' | 'FINAL'
  numero_entrega: number
  income_ids: string[]
  actas_referencia: string[]
  es_acta_final: boolean
}

export type CreateDonationActaInput = {
  income_id: string
}

export type DonationIncomeProductInput = {
  id?: string
  brand_name: string
  name_product: string
  amount: number
  price: number
}

export type DonationIncomeInput = {
  tipo_recepcion: 'PARCIAL' | 'FINAL'
  nombre_almacen: string
  nombre_proveedor: string
  fecha_recepcion_donacion: string
  description: string
  productos: DonationIncomeProductInput[]
}

export type DonationIncomeProduct = Omit<DonationIncomeProductInput, 'id'> & {
  id: string
  income_id: string
  total_price: number
}

export type DonationIncome = Omit<DonationIncomeInput, 'productos'> & {
  id: string
  donativo_id: string
  numero_entrega: number
  estado_recepcion: 'PENDIENTE_ACTA' | 'DOCUMENTADA' | 'FINALIZADA'
  productos: DonationIncomeProduct[]
}

export type DonationListItem = {
  id: string
  correlativo_acta: string | null
  nombre_proyecto: string
  tipo_gestion: string
  dpto_seccion: string | null
  fecha_recepcion: string
  lugar_recepcion: ReceptionPlace[]
  estado: 'BORRADOR' | 'EN_PROCESO' | 'FINALIZADO' | 'ANULADO'
  created_at: string
}

type DonationResponse =
  | { ok: true; donativo: CreatedDonation }
  | { ok: false; message: string }

type DonationListResponse =
  | { ok: true; donativos: DonationListItem[] }
  | { ok: false; message: string }

type DonationDocumentResponse =
  | { ok: true; documento: CreatedDonationDocument }
  | { ok: false; message: string }

type DonationDetailResponse =
  | {
      ok: true
      donativo: DonationDetail
      documentos: DonationDocumentItem[]
      acta: DonationActaSummary | null
    }
  | { ok: false; message: string }

type DonationActaResponse =
  | { ok: true; acta: DonationActaSummary }
  | { ok: false; message: string }

type DonationActaListResponse =
  | { ok: true; actas: DonationActaSummary[] }
  | { ok: false; message: string }

type DonationUpdateResponse =
  | { ok: true; donativo: DonationDetail }
  | { ok: false; message: string }

type DonationDeletionResponse =
  | { ok: true; message: string }
  | { ok: false; message: string }

type DonationIncomeResponse =
  | { ok: true; income: DonationIncome }
  | { ok: false; message: string }

type DonationIncomeListResponse =
  | { ok: true; incomes: DonationIncome[] }
  | { ok: false; message: string }

type ReceptionPlaceCatalogResponse =
  | { ok: true; lugares: ReceptionPlace[] }
  | { ok: false; message: string }

type UpcRepresentativeCatalogResponse =
  | { ok: true; representantes: UpcRepresentative[] }
  | { ok: false; message: string }

type WarehouseCatalogResponse =
  | { ok: true; almacenes: Section5CatalogItem[] }
  | { ok: false; message: string }

type DistributionPlaceCatalogResponse =
  | { ok: true; lugares: Section5CatalogItem[] }
  | { ok: false; message: string }

type CityCatalogResponse =
  | { ok: true; ciudades: CityCatalogItem[] }
  | { ok: false; message: string }

type ConapinaReceptionManagerCatalogResponse =
  | { ok: true; encargados: ConapinaReceptionManager[] }
  | { ok: false; message: string }

export class DonationSaveError extends Error {}
export class DonationListError extends Error {}
export class DonationDocumentSaveError extends Error {}
export class DonationDetailError extends Error {}
export class DonationActaError extends Error {}
export class DonationDeletionError extends Error {}
export class DonationIncomeError extends Error {}
export class ReceptionPlaceCatalogError extends Error {}
export class UpcRepresentativeCatalogError extends Error {}
export class Section5CatalogError extends Error {}
export class CityCatalogError extends Error {}
export class ConapinaReceptionManagerCatalogError extends Error {}

export async function getReceptionPlaces(authToken: string): Promise<ReceptionPlace[]> {
  const response = await fetch(`${API_BASE_URL}/api/catalogos/lugares-recepcion`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => null)

  if (!response) throw new ReceptionPlaceCatalogError('No fue posible cargar los lugares.')
  const result = (await response.json().catch(() => null)) as ReceptionPlaceCatalogResponse | null
  if (!response.ok || !result?.ok) {
    throw new ReceptionPlaceCatalogError('No fue posible cargar los lugares.')
  }
  return result.lugares
}

export async function getUpcRepresentatives(
  authToken: string,
): Promise<UpcRepresentative[]> {
  const response = await fetch(`${API_BASE_URL}/api/catalogos/representantes-upc`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => null)

  if (!response) {
    throw new UpcRepresentativeCatalogError('No fue posible cargar los representantes.')
  }
  const result = (await response.json().catch(
    () => null,
  )) as UpcRepresentativeCatalogResponse | null
  if (!response.ok || !result?.ok) {
    throw new UpcRepresentativeCatalogError('No fue posible cargar los representantes.')
  }
  return result.representantes
}

async function getWarehouseCatalog(
  path: string,
  authToken: string,
): Promise<Section5CatalogItem[]> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => null)
  if (!response) throw new Section5CatalogError('No fue posible cargar el catálogo.')
  const result = (await response.json().catch(() => null)) as WarehouseCatalogResponse | null
  if (!response.ok || !result?.ok) {
    throw new Section5CatalogError('No fue posible cargar el catálogo.')
  }
  return result.almacenes
}

export function getSafekeepingWarehouses(authToken: string): Promise<Section5CatalogItem[]> {
  return getWarehouseCatalog('/api/catalogos/almacenes-resguardo', authToken)
}

export async function getDistributionPlaces(
  authToken: string,
): Promise<Section5CatalogItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/catalogos/lugares-distribucion`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => null)
  if (!response) throw new Section5CatalogError('No fue posible cargar el catálogo.')
  const result = (await response.json().catch(() => null)) as DistributionPlaceCatalogResponse | null
  if (!response.ok || !result?.ok) {
    throw new Section5CatalogError('No fue posible cargar el catálogo.')
  }
  return result.lugares
}

export function getDestinationWarehouses(authToken: string): Promise<Section5CatalogItem[]> {
  return getWarehouseCatalog('/api/catalogos/almacenes-destino', authToken)
}

export async function getCities(authToken: string): Promise<CityCatalogItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/catalogos/ciudades`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => null)
  if (!response) throw new CityCatalogError('No fue posible cargar las ciudades.')
  const result = (await response.json().catch(() => null)) as CityCatalogResponse | null
  if (!response.ok || !result?.ok) {
    throw new CityCatalogError('No fue posible cargar las ciudades.')
  }
  return result.ciudades
}

export async function getConapinaReceptionManagers(
  authToken: string,
): Promise<ConapinaReceptionManager[]> {
  const response = await fetch(`${API_BASE_URL}/api/catalogos/encargados-conapina`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => null)
  if (!response) {
    throw new ConapinaReceptionManagerCatalogError('No fue posible cargar los encargados.')
  }
  const result = (await response.json().catch(
    () => null,
  )) as ConapinaReceptionManagerCatalogResponse | null
  if (!response.ok || !result?.ok) {
    throw new ConapinaReceptionManagerCatalogError('No fue posible cargar los encargados.')
  }
  return result.encargados
}

export async function createDonation(
  input: DonationDraftInput,
  authToken: string,
): Promise<CreatedDonation> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/donativos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new DonationSaveError('No fue posible guardar la donación en este momento.')
  }

  let result: DonationResponse

  try {
    result = (await response.json()) as DonationResponse
  } catch {
    throw new DonationSaveError('No fue posible guardar la donación en este momento.')
  }

  if (!response.ok || !result.ok) {
    throw new DonationSaveError(
      !result.ok ? result.message : 'No fue posible guardar la donación en este momento.',
    )
  }

  return result.donativo
}

export async function getDonations(authToken: string): Promise<DonationListItem[]> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/donativos`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
  } catch {
    throw new DonationListError('No fue posible cargar las donaciones.')
  }

  let result: DonationListResponse

  try {
    result = (await response.json()) as DonationListResponse
  } catch {
    throw new DonationListError('No fue posible cargar las donaciones.')
  }

  if (!response.ok || !result.ok) {
    throw new DonationListError('No fue posible cargar las donaciones.')
  }

  return result.donativos
}

export async function deleteDonation(
  donationId: string,
  authToken: string,
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    },
  ).catch(() => null)

  if (!response) throw new DonationDeletionError('No fue posible eliminar la donación.')
  const result = (await response.json().catch(() => null)) as DonationDeletionResponse | null
  if (!response.ok || !result?.ok) {
    throw new DonationDeletionError(
      result && !result.ok ? result.message : 'No fue posible eliminar la donación.',
    )
  }
  return result.message
}

export async function uploadDonationDocument(
  donationId: string,
  documentType: DonationDocumentType,
  file: File,
  authToken: string,
): Promise<CreatedDonationDocument> {
  const formData = new FormData()
  formData.set('tipo_documento', documentType)
  formData.set('archivo', file)

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/documentos`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      },
    )
  } catch {
    throw new DonationDocumentSaveError('No fue posible guardar el documento.')
  }

  let result: DonationDocumentResponse

  try {
    result = (await response.json()) as DonationDocumentResponse
  } catch {
    throw new DonationDocumentSaveError('No fue posible guardar el documento.')
  }

  if (!response.ok || !result.ok) {
    throw new DonationDocumentSaveError(
      !result.ok ? result.message : 'No fue posible guardar el documento.',
    )
  }

  return result.documento
}

export async function getDonationDetail(
  donationId: string,
  authToken: string,
): Promise<DonationDetailResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  ).catch(() => null)

  if (!response) throw new DonationDetailError('No fue posible cargar el donativo.')
  const result = (await response.json().catch(() => null)) as DonationDetailResponse | null
  if (!response.ok || !result?.ok) {
    throw new DonationDetailError('No fue posible cargar el donativo.')
  }
  return { donativo: result.donativo, documentos: result.documentos, acta: result.acta }
}

export async function createDonationActa(
  donationId: string,
  authToken: string,
): Promise<DonationActaSummary> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/acta`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    },
  ).catch(() => null)
  if (!response) throw new DonationActaError('No fue posible generar el acta.')
  const result = (await response.json().catch(() => null)) as DonationActaResponse | null
  if (!response.ok || !result?.ok) {
    throw new DonationActaError('No fue posible generar el acta.')
  }
  return result.acta
}

export async function getDonationActa(
  donationId: string,
  authToken: string,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/acta`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  ).catch(() => null)
  if (!response?.ok) throw new DonationActaError('No fue posible abrir el acta.')
  return response.blob()
}

export async function getDonationActas(
  donationId: string,
  authToken: string,
): Promise<DonationActaSummary[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/actas`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  ).catch(() => null)
  const result = response
    ? (await response.json().catch(() => null)) as DonationActaListResponse | null
    : null
  if (!response?.ok || !result?.ok) {
    throw new DonationActaError('No fue posible cargar las actas.')
  }
  return result.actas
}

export async function createTypedDonationActa(
  donationId: string,
  input: CreateDonationActaInput,
  authToken: string,
): Promise<DonationActaSummary> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/actas`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(input),
    },
  ).catch(() => null)
  const result = response
    ? (await response.json().catch(() => null)) as DonationActaResponse | null
    : null
  if (!response?.ok || !result?.ok) {
    throw new DonationActaError(
      result && !result.ok ? result.message : 'No fue posible generar el acta.',
    )
  }
  return result.acta
}

export async function getDonationActaById(
  donationId: string,
  actaId: string,
  authToken: string,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/actas/${encodeURIComponent(actaId)}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  ).catch(() => null)
  if (!response?.ok) throw new DonationActaError('No fue posible abrir el acta.')
  return response.blob()
}

export async function updateDonation(
  donationId: string,
  input: DonationDraftInput,
  authToken: string,
): Promise<DonationDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(input),
    },
  ).catch(() => null)

  if (!response) throw new DonationDetailError('No fue posible guardar los cambios.')
  const result = (await response.json().catch(() => null)) as DonationUpdateResponse | null
  if (!response.ok || !result?.ok) {
    throw new DonationDetailError(
      result && !result.ok ? result.message : 'No fue posible guardar los cambios.',
    )
  }
  return result.donativo
}

export async function getDonationIncomes(
  donationId: string,
  authToken: string,
): Promise<DonationIncome[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/incomes`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  ).catch(() => null)
  if (!response) throw new DonationIncomeError('No fue posible cargar las recepciones.')
  const result = (await response.json().catch(() => null)) as DonationIncomeListResponse | null
  if (!response.ok || !result?.ok) {
    throw new DonationIncomeError('No fue posible cargar las recepciones.')
  }
  return result.incomes
}

export async function createDonationIncome(
  donationId: string,
  input: DonationIncomeInput,
  authToken: string,
): Promise<DonationIncome> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/incomes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(input),
    },
  ).catch(() => null)
  const result = response
    ? (await response.json().catch(() => null)) as DonationIncomeResponse | null
    : null
  if (!response?.ok || !result?.ok) {
    throw new DonationIncomeError(
      result && !result.ok ? result.message : 'No fue posible guardar la recepción.',
    )
  }
  return result.income
}

export async function updateDonationIncome(
  donationId: string,
  incomeId: string,
  input: DonationIncomeInput,
  authToken: string,
): Promise<DonationIncome> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/incomes/${encodeURIComponent(incomeId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(input),
    },
  ).catch(() => null)
  const result = response
    ? (await response.json().catch(() => null)) as DonationIncomeResponse | null
    : null
  if (!response?.ok || !result?.ok) {
    throw new DonationIncomeError(
      result && !result.ok ? result.message : 'No fue posible actualizar la recepción.',
    )
  }
  return result.income
}

export async function deleteDonationIncome(
  donationId: string,
  incomeId: string,
  authToken: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/incomes/${encodeURIComponent(incomeId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    },
  ).catch(() => null)
  if (!response?.ok) throw new DonationIncomeError('No fue posible eliminar la recepción.')
}

export async function getDonationDocument(
  donationId: string,
  documentId: string,
  authToken: string,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/documentos/${encodeURIComponent(documentId)}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  ).catch(() => null)

  if (!response?.ok) throw new DonationDetailError('No fue posible abrir el documento.')
  return response.blob()
}

export async function deleteDonationDocument(
  donationId: string,
  documentId: string,
  authToken: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/donativos/${encodeURIComponent(donationId)}/documentos/${encodeURIComponent(documentId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    },
  ).catch(() => null)

  if (!response?.ok) throw new DonationDetailError('No fue posible eliminar el documento.')
}
