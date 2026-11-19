export type DonationDocumentType = 'MEMO_INICIAL' | 'MEMO_DE'

export type DonationDocumentUpload = {
  tipoDocumento: DonationDocumentType
  originalName: string
  mimeType: string
  contents: Buffer
}

export type DonationDocumentMetadata = {
  donativoId: string
  tipoDocumento: DonationDocumentType
  originalName: string
  storedName: string
  relativePath: string
  mimeType: string
  sizeBytes: number
  createdBy: string
}

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

export type DonationDocumentFile = DonationDocumentItem & {
  ruta_archivo: string
}
