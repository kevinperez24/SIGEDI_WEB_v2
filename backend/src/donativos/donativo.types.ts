export type DonationCreateInput = {
  tipo_registro: string
  nombre_proyecto: string
  tipo_gestion: string
  dpto_seccion: string
  fecha_recepcion: string
  lugar_recepcion: string
  observaciones: string
}

export type CreatedDonation = {
  id: string
  estado: 'BORRADOR'
  correlativo_acta: null
}

export type DonationListItem = {
  id: string
  correlativo_acta: string | null
  nombre_proyecto: string
  tipo_gestion: string
  dpto_seccion: string | null
  fecha_recepcion: string
  lugar_recepcion: string
  estado: string
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
  lugar_recepcion: string
  observaciones: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}
