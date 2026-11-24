import type { ReceptionPlace } from '../catalogos/lugar-recepcion.repository.ts'
import type { UpcRepresentative } from '../catalogos/representante-upc.repository.ts'
import type { Section5CatalogItem } from '../catalogos/seccion5.repository.ts'
import type { CityCatalogItem } from '../catalogos/ciudad.repository.ts'

export type DonationCreateInput = {
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
  nombre_encargado: string
  cargo_encargado: string
}

export type CreatedDonation = {
  id: string
  estado: 'BORRADOR'
  correlativo_acta: null
}

export type DonationDeletionPlan = {
  documentPaths: string[]
  documentCount: number
}

export type DeletedDonation = {
  documentCount: number
  deletedFileCount: number
}

export type DonationListItem = {
  id: string
  correlativo_acta: string | null
  nombre_proyecto: string
  tipo_gestion: string
  dpto_seccion: string | null
  fecha_recepcion: string
  lugar_recepcion: ReceptionPlace[]
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
