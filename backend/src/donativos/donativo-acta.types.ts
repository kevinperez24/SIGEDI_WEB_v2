export type DonationActaType = 'PROVISIONAL' | 'FINAL'

export type DonationActaSummary = {
  id: string
  version: number
  estado: 'ACTIVA'
  nombre_archivo: string
  codigo_acta: string
  tipo_acta: DonationActaType
  numero_entrega: number
  income_ids: string[]
  actas_referencia: string[]
  es_acta_final: boolean
}

export type DonationActaMetadata = {
  donativoId: string
  version: number
  originalName: string
  storedName: string
  relativePath: string
  sizeBytes: number
  createdBy: string
  codigoActa: string
  tipoActa: DonationActaType
  numeroEntrega: number
  incomeIds: string[]
  actasReferencia: string[]
  esActaFinal: boolean
  targetIncomeId: string
  receptionState: 'DOCUMENTADA' | 'FINALIZADA'
}

export type DonationActaFile = {
  nombre_archivo: string
  ruta_archivo: string
  mime_type: 'application/pdf'
}

export type CreateDonationActaInput = {
  income_id: string
}

export type DownloadedDonationActa = {
  contents: Buffer
  name: string
  mimeType: 'application/pdf'
}
