export type DonationActaSummary = {
  id: string
  version: number
  estado: 'ACTIVA'
  nombre_archivo: string
}

export type DonationActaMetadata = {
  donativoId: string
  version: number
  originalName: string
  storedName: string
  relativePath: string
  sizeBytes: number
  createdBy: string
}

export type DonationActaFile = {
  nombre_archivo: string
  ruta_archivo: string
  mime_type: 'application/pdf'
}

export type DownloadedDonationActa = {
  contents: Buffer
  name: string
  mimeType: 'application/pdf'
}
