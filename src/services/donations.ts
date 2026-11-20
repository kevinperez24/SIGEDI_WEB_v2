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

export type DonationDraftInput = {
  tipo_registro: string
  nombre_proyecto: string
  tipo_gestion: string
  dpto_seccion: string
  fecha_recepcion: string
  lugar_recepcion: string[]
  observaciones: string
  representante_upc: string
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
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type DonationDetailResult = {
  donativo: DonationDetail
  documentos: DonationDocumentItem[]
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
  | { ok: true; donativo: DonationDetail; documentos: DonationDocumentItem[] }
  | { ok: false; message: string }

type DonationUpdateResponse =
  | { ok: true; donativo: DonationDetail }
  | { ok: false; message: string }

type DonationDeletionResponse =
  | { ok: true; message: string }
  | { ok: false; message: string }

type ReceptionPlaceCatalogResponse =
  | { ok: true; lugares: ReceptionPlace[] }
  | { ok: false; message: string }

type UpcRepresentativeCatalogResponse =
  | { ok: true; representantes: UpcRepresentative[] }
  | { ok: false; message: string }

export class DonationSaveError extends Error {}
export class DonationListError extends Error {}
export class DonationDocumentSaveError extends Error {}
export class DonationDetailError extends Error {}
export class DonationDeletionError extends Error {}
export class ReceptionPlaceCatalogError extends Error {}
export class UpcRepresentativeCatalogError extends Error {}

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
  return { donativo: result.donativo, documentos: result.documentos }
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
