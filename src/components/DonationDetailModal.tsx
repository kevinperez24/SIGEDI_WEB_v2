import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  createTypedDonationActa,
  createDonationIncome,
  deleteDonationIncome,
  deleteDonationDocument,
  getCities,
  getConapinaReceptionManagers,
  getDestinationWarehouses,
  getDonationDetail,
  getDonationIncomes,
  getDonationActa,
  getDonationActaById,
  getDonationActas,
  getDonationDocument,
  getDistributionPlaces,
  getReceptionPlaces,
  getSafekeepingWarehouses,
  getUpcRepresentatives,
  updateDonation,
  updateDonationIncome,
  uploadDonationDocument,
} from '../services/donations'
import type {
  DonationDetail,
  DonationActaSummary,
  CityCatalogItem,
  ConapinaReceptionManager,
  DonationDocumentItem,
  DonationDocumentType,
  DonationDraftInput,
  DonationIncome,
  ReceptionPlace,
  Section5CatalogItem,
  UpcRepresentative,
} from '../services/donations'
import DatePicker from './form/DatePicker'
import FormMultiSelect from './form/FormMultiSelect'
import FormSelect from './form/FormSelect'
import DonationSectionNavigator, {
  donationSections,
  type DonationSectionNumber,
} from './DonationSectionNavigator'
import DonationWarehousesSection, {
  donationIncomeToDraft,
  donationWarehouseToInput,
  type DonationWarehouseDraft,
  validateDonationWarehouses,
} from './DonationWarehousesSection'
import DonationProvisionalActsSection from './DonationProvisionalActsSection'
import '../pages/DonativoMonetarioForm.css'
import './DonationDraftModal.css'

type DonationDetailModalProps = {
  donationId: string
  authToken: string
  onClose: () => void
  onUpdated: () => void
}

const managementTypes = [
  'En el marco de un proyecto',
  'Ofrecimiento',
  'Solicitud',
  'Asistencia Humanitaria',
]

const DUI_PATTERN = /^\d{8}-\d$/

function formatDui(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  return digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits
}

type DocumentSlot = { type: DonationDocumentType; title: string; image?: boolean }

const memorandumDocumentSlots: DocumentSlot[] = [
  { type: 'MEMO_INICIAL', title: 'Memorándum de registro inicial' },
  { type: 'MEMO_DE', title: 'Memorándum de autorización de Dirección Ejecutiva' },
]

const conapinaRecordSlot: DocumentSlot = {
  type: 'ACTA_CONAPINA',
  title: 'Acta de Donación emitida por CONAPINA',
}

const donationAgreementSlot: DocumentSlot = {
  type: 'ACUERDO_DONACION',
  title: 'Acuerdo de Donación',
}

const financialReceiptSlot: DocumentSlot = {
  type: 'COMPROBANTE_GF',
  title: 'Comprobante emitido por Gerencia Financiera',
}

const photoDocumentSlots: DocumentSlot[] = [
  { type: 'REGISTRO_FOTO_1', title: 'Fotografía 1', image: true },
  { type: 'REGISTRO_FOTO_2', title: 'Fotografía 2', image: true },
]

function LocalImagePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return previewUrl ? <img className="photo-preview" src={previewUrl} alt={`Vista previa de ${file.name}`} /> : null
}

function AuthenticatedImagePreview({
  donationId,
  document,
  authToken,
}: {
  donationId: string
  document: DonationDocumentItem
  authToken: string
}) {
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => {
    let objectUrl = ''
    let active = true
    void getDonationDocument(donationId, document.id, authToken)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => undefined)
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [authToken, document.id, donationId])
  return previewUrl ? <img className="photo-preview" src={previewUrl} alt={document.nombre_archivo} /> : null
}

function toForm(detail: DonationDetail): DonationDraftInput {
  return {
    tipo_registro: detail.tipo_registro,
    nombre_proyecto: detail.nombre_proyecto,
    tipo_gestion: detail.tipo_gestion,
    dpto_seccion: detail.dpto_seccion ?? '',
    fecha_recepcion: detail.fecha_recepcion.slice(0, 10),
    lugar_recepcion: detail.lugar_recepcion.map((place) => place.id),
    observaciones: detail.observaciones ?? '',
    representante_upc: detail.representante_upc?.id ?? '',
    n_comprobante: detail.n_comprobante ?? '',
    fecha_comprobante: detail.fecha_comprobante?.slice(0, 10) ?? '',
    almacen_resguardo: detail.almacen_resguardo?.id ?? '',
    lugar_distribucion: detail.lugar_distribucion.map((place) => place.id),
    fechareport_financiero: detail.fechareport_financiero?.slice(0, 10) ?? '',
    almacen_destino: detail.almacen_destino?.id ?? '',
    marco_acta: detail.marco_acta ?? '',
    objetivo_acta: detail.objetivo_acta ?? '',
    entregados_acta: detail.entregados_acta ?? '',
    entrega_acta: detail.entrega_acta ?? '',
    ciudad: detail.ciudad?.id ?? '',
    nombre_donante: detail.nombre_donante ?? '',
    cargo_donante: detail.cargo_donante ?? '',
    nombre_entidad: detail.nombre_entidad ?? '',
    dui_donante: detail.dui_donante ?? '',
    encargado_personal_id: detail.encargado_personal_id ?? '',
  }
}

function formatBytes(size: number): string {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function DonationDetailModal({
  donationId,
  authToken,
  onClose,
  onUpdated,
}: DonationDetailModalProps) {
  const [detail, setDetail] = useState<DonationDetail | null>(null)
  const [documents, setDocuments] = useState<DonationDocumentItem[]>([])
  const [activeActa, setActiveActa] = useState<DonationActaSummary | null>(null)
  const [actas, setActas] = useState<DonationActaSummary[]>([])
  const [incomes, setIncomes] = useState<DonationIncome[]>([])
  const [form, setForm] = useState<DonationDraftInput | null>(null)
  const [pendingDocuments, setPendingDocuments] = useState<
    Partial<Record<DonationDocumentType, File>>
  >({})
  const [activeSection, setActiveSection] = useState<DonationSectionNumber>(1)
  const [warehouseGroups, setWarehouseGroups] = useState<DonationWarehouseDraft[]>([])
  const [originalWarehouseGroups, setOriginalWarehouseGroups] = useState<DonationWarehouseDraft[]>([])
  const [invalidSections, setInvalidSections] = useState<Set<DonationSectionNumber>>(new Set())
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isOpeningActa, setIsOpeningActa] = useState(false)
  const [pendingActaAction, setPendingActaAction] = useState('')
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [receptionPlaces, setReceptionPlaces] = useState<ReceptionPlace[]>([])
  const [isReceptionPlacesLoading, setIsReceptionPlacesLoading] = useState(true)
  const [receptionPlacesError, setReceptionPlacesError] = useState('')
  const [upcRepresentatives, setUpcRepresentatives] = useState<UpcRepresentative[]>([])
  const [isUpcRepresentativesLoading, setIsUpcRepresentativesLoading] = useState(true)
  const [upcRepresentativesError, setUpcRepresentativesError] = useState('')
  const [safekeepingWarehouses, setSafekeepingWarehouses] = useState<Section5CatalogItem[]>([])
  const [isSafekeepingWarehousesLoading, setIsSafekeepingWarehousesLoading] = useState(true)
  const [safekeepingWarehousesError, setSafekeepingWarehousesError] = useState('')
  const [distributionPlaces, setDistributionPlaces] = useState<Section5CatalogItem[]>([])
  const [isDistributionPlacesLoading, setIsDistributionPlacesLoading] = useState(true)
  const [distributionPlacesError, setDistributionPlacesError] = useState('')
  const [destinationWarehouses, setDestinationWarehouses] = useState<Section5CatalogItem[]>([])
  const [isDestinationWarehousesLoading, setIsDestinationWarehousesLoading] = useState(true)
  const [destinationWarehousesError, setDestinationWarehousesError] = useState('')
  const [cities, setCities] = useState<CityCatalogItem[]>([])
  const [isCitiesLoading, setIsCitiesLoading] = useState(true)
  const [citiesError, setCitiesError] = useState('')
  const [receptionManagers, setReceptionManagers] = useState<ConapinaReceptionManager[]>([])
  const [isReceptionManagersLoading, setIsReceptionManagersLoading] = useState(true)
  const [receptionManagersError, setReceptionManagersError] = useState('')

  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    setMessage('')
    setHasError(false)
    try {
      const [result, loadedIncomes, loadedActas] = await Promise.all([
        getDonationDetail(donationId, authToken),
        getDonationIncomes(donationId, authToken),
        getDonationActas(donationId, authToken),
      ])
      setDetail(result.donativo)
      setDocuments(result.documentos)
      setActiveActa(result.acta)
      setForm(toForm(result.donativo))
      setIncomes(loadedIncomes)
      setActas(loadedActas)
      const incomeDrafts = loadedIncomes.map((income) => donationIncomeToDraft(income, false))
      setWarehouseGroups(incomeDrafts)
      setOriginalWarehouseGroups(incomeDrafts)
    } catch {
      setHasError(true)
      setMessage('No fue posible cargar el donativo.')
    } finally {
      setIsLoading(false)
    }
  }, [authToken, donationId])

  const loadReceptionPlaces = useCallback(async () => {
    setIsReceptionPlacesLoading(true)
    setReceptionPlacesError('')
    try {
      setReceptionPlaces(await getReceptionPlaces(authToken))
    } catch {
      setReceptionPlacesError('No fue posible cargar los lugares de recepción.')
    } finally {
      setIsReceptionPlacesLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    void loadReceptionPlaces()
  }, [loadReceptionPlaces])

  const loadUpcRepresentatives = useCallback(async () => {
    setIsUpcRepresentativesLoading(true)
    setUpcRepresentativesError('')
    try {
      setUpcRepresentatives(await getUpcRepresentatives(authToken))
    } catch {
      setUpcRepresentativesError('No fue posible cargar los representantes UPC.')
    } finally {
      setIsUpcRepresentativesLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    void loadUpcRepresentatives()
  }, [loadUpcRepresentatives])

  const loadSafekeepingWarehouses = useCallback(async () => {
    setIsSafekeepingWarehousesLoading(true)
    setSafekeepingWarehousesError('')
    try {
      setSafekeepingWarehouses(await getSafekeepingWarehouses(authToken))
    } catch {
      setSafekeepingWarehousesError('No fue posible cargar los almacenes de resguardo.')
    } finally {
      setIsSafekeepingWarehousesLoading(false)
    }
  }, [authToken])

  const loadDistributionPlaces = useCallback(async () => {
    setIsDistributionPlacesLoading(true)
    setDistributionPlacesError('')
    try {
      setDistributionPlaces(await getDistributionPlaces(authToken))
    } catch {
      setDistributionPlacesError('No fue posible cargar los lugares de distribución.')
    } finally {
      setIsDistributionPlacesLoading(false)
    }
  }, [authToken])

  const loadDestinationWarehouses = useCallback(async () => {
    setIsDestinationWarehousesLoading(true)
    setDestinationWarehousesError('')
    try {
      setDestinationWarehouses(await getDestinationWarehouses(authToken))
    } catch {
      setDestinationWarehousesError('No fue posible cargar los almacenes destino.')
    } finally {
      setIsDestinationWarehousesLoading(false)
    }
  }, [authToken])

  useEffect(() => { void loadSafekeepingWarehouses() }, [loadSafekeepingWarehouses])
  useEffect(() => { void loadDistributionPlaces() }, [loadDistributionPlaces])
  useEffect(() => { void loadDestinationWarehouses() }, [loadDestinationWarehouses])

  const loadCities = useCallback(async () => {
    setIsCitiesLoading(true)
    setCitiesError('')
    try {
      setCities(await getCities(authToken))
    } catch {
      setCitiesError('No fue posible cargar las ciudades.')
    } finally {
      setIsCitiesLoading(false)
    }
  }, [authToken])

  useEffect(() => { void loadCities() }, [loadCities])

  const loadReceptionManagers = useCallback(async () => {
    setIsReceptionManagersLoading(true)
    setReceptionManagersError('')
    try {
      setReceptionManagers(await getConapinaReceptionManagers(authToken))
    } catch {
      setReceptionManagersError('No fue posible cargar el personal de CONAPINA.')
    } finally {
      setIsReceptionManagersLoading(false)
    }
  }, [authToken])

  useEffect(() => { void loadReceptionManagers() }, [loadReceptionManagers])

  const selectedReceptionManager = receptionManagers.find(
    (manager) => manager.id === form?.encargado_personal_id,
  )

  const setField = <Field extends keyof DonationDraftInput,>(
    field: Field,
    value: DonationDraftInput[Field],
  ) => {
    setForm((current) => (current ? { ...current, [field]: value } : current))
  }

  const cancelEditing = () => {
    if (detail) setForm(toForm(detail))
    setWarehouseGroups(originalWarehouseGroups.map((warehouse) => ({
      ...warehouse,
      products: warehouse.products.map((product) => ({ ...product })),
    })))
    setPendingDocuments({})
    setInvalidSections(new Set())
    setMessage('')
    setHasError(false)
    setIsEditing(false)
  }

  const startEditing = () => {
    setMessage('')
    setHasError(false)
    setInvalidSections(new Set())
    setIsEditing(true)
  }

  const viewActa = async () => {
    if (!activeActa || isOpeningActa) return
    const previewWindow = window.open('about:blank', '_blank')
    if (previewWindow) previewWindow.opener = null
    setIsOpeningActa(true)
    setMessage('')
    setHasError(false)
    try {
      const blob = await getDonationActa(donationId, authToken)
      const url = URL.createObjectURL(blob)
      if (previewWindow) {
        previewWindow.location.href = url
      } else {
        throw new Error('Vista previa bloqueada')
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      previewWindow?.close()
      setHasError(true)
      setMessage('No fue posible abrir el acta.')
    } finally {
      setIsOpeningActa(false)
    }
  }

  const generateTypedActa = async (incomeId: string) => {
    if (pendingActaAction) return
    setPendingActaAction(incomeId)
    setMessage('')
    setHasError(false)
    try {
      const created = await createTypedDonationActa(
        donationId,
        { income_id: incomeId },
        authToken,
      )
      await loadDetail()
      if (created.es_acta_final) setActiveActa(created)
      setMessage(created.es_acta_final
        ? 'Acta final generada correctamente.'
        : 'Acta provisional generada correctamente.')
    } catch {
      setHasError(true)
      setMessage('No fue posible generar el acta en este momento.')
    } finally {
      setPendingActaAction('')
    }
  }

  const viewTypedActa = async (acta: DonationActaSummary) => {
    const previewWindow = window.open('about:blank', '_blank')
    if (previewWindow) previewWindow.opener = null
    try {
      const blob = await getDonationActaById(donationId, acta.id, authToken)
      const url = URL.createObjectURL(blob)
      if (!previewWindow) throw new Error('Vista previa bloqueada')
      previewWindow.location.href = url
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      previewWindow?.close()
      setHasError(true)
      setMessage('No fue posible abrir el acta.')
    }
  }

  const selectDocument = (type: DonationDocumentType, file?: File) => {
    if (!file) return
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : ''
    const isPhoto = type === 'REGISTRO_FOTO_1' || type === 'REGISTRO_FOTO_2'
    const validExtension = isPhoto
      ? ['.jpg', '.jpeg', '.png', '.webp'].includes(extension)
      : ['.pdf', '.doc', '.docx'].includes(extension)
    if (!validExtension || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setHasError(true)
      setMessage(
        isPhoto
          ? 'Seleccione una imagen JPG, JPEG, PNG o WebP de hasta 10 MB.'
          : 'Seleccione un archivo PDF, DOC o DOCX de hasta 10 MB.',
      )
      return
    }
    setPendingDocuments((current) => ({ ...current, [type]: file }))
    setMessage('')
    setHasError(false)
  }

  const saveChanges = async (event: FormEvent) => {
    event.preventDefault()
    if (!isEditing || !form || isSaving) return
    const nextInvalidSections = new Set<DonationSectionNumber>()
    if (
      !form.tipo_registro.trim() ||
      !form.nombre_proyecto.trim() ||
      !form.tipo_gestion ||
      !form.fecha_recepcion ||
      form.lugar_recepcion.length === 0
    ) nextInvalidSections.add(1)
    if (form.dui_donante !== '' && !DUI_PATTERN.test(form.dui_donante)) {
      nextInvalidSections.add(8)
    }
    const incomeValidationError = validateDonationWarehouses(warehouseGroups)
    if (incomeValidationError) nextInvalidSections.add(6)
    if (nextInvalidSections.size > 0) {
      setInvalidSections(nextInvalidSections)
      setActiveSection(nextInvalidSections.has(1) ? 1 : nextInvalidSections.has(6) ? 6 : 8)
      setHasError(true)
      setMessage(incomeValidationError ?? 'Revise los campos requeridos antes de continuar.')
      return
    }

    setIsSaving(true)
    setMessage('')
    setHasError(false)
    try {
      await updateDonation(donationId, form, authToken)
      const currentIncomeIds = new Set(
        warehouseGroups.flatMap((warehouse) => warehouse.recordId ? [warehouse.recordId] : []),
      )
      for (const originalWarehouse of originalWarehouseGroups) {
        if (originalWarehouse.recordId && !currentIncomeIds.has(originalWarehouse.recordId)) {
          await deleteDonationIncome(donationId, originalWarehouse.recordId, authToken)
          setOriginalWarehouseGroups((current) => current.filter(
            (warehouse) => warehouse.recordId !== originalWarehouse.recordId,
          ))
        }
      }
      const persistedWarehouses = [...warehouseGroups]
      for (const [index, warehouse] of warehouseGroups.entries()) {
        const input = donationWarehouseToInput(warehouse)
        const income = warehouse.recordId
          ? await updateDonationIncome(donationId, warehouse.recordId, input, authToken)
          : await createDonationIncome(donationId, input, authToken)
        const persistedWarehouse = donationIncomeToDraft(income, false)
        persistedWarehouses[index] = persistedWarehouse
        setWarehouseGroups([...persistedWarehouses])
        setOriginalWarehouseGroups((current) => {
          const existingIndex = current.findIndex((item) => item.recordId === income.id)
          if (existingIndex < 0) return [...current, persistedWarehouse]
          return current.map((item, itemIndex) => (
            itemIndex === existingIndex ? persistedWarehouse : item
          ))
        })
      }
      for (const [type, file] of Object.entries(pendingDocuments) as [
        DonationDocumentType,
        File,
      ][]) {
        await uploadDonationDocument(donationId, type, file, authToken)
      }
      await loadDetail()
      setPendingDocuments({})
      setInvalidSections(new Set())
      setIsEditing(false)
      setMessage('Cambios guardados correctamente.')
      onUpdated()
    } catch {
      setHasError(true)
      setMessage('No fue posible completar todos los cambios.')
    } finally {
      setIsSaving(false)
    }
  }

  const viewDocument = async (document: DonationDocumentItem) => {
    const canPreview = document.mime_type === 'application/pdf' || document.mime_type.startsWith('image/')
    const previewWindow = canPreview ? window.open('about:blank', '_blank') : null
    if (previewWindow) previewWindow.opener = null
    try {
      const blob = await getDonationDocument(donationId, document.id, authToken)
      const url = URL.createObjectURL(blob)
      if (canPreview) {
        if (previewWindow) previewWindow.location.href = url
      } else {
        const link = window.document.createElement('a')
        link.href = url
        link.download = document.nombre_archivo
        link.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      previewWindow?.close()
      setHasError(true)
      setMessage('No fue posible abrir el documento.')
    }
  }

  const removeDocument = async (document: DonationDocumentItem) => {
    if (
      !window.confirm(
        `¿Eliminar ${document.nombre_archivo} del donativo?`,
      )
    )
      return
    try {
      await deleteDonationDocument(donationId, document.id, authToken)
      setDocuments((current) => current.filter((item) => item.id !== document.id))
      setMessage('Documento eliminado correctamente.')
    } catch {
      setHasError(true)
      setMessage('No fue posible eliminar el documento.')
    }
  }

  const clearPendingDocument = (type: DonationDocumentType) => {
    setPendingDocuments((current) => {
      const nextDocuments = { ...current }
      delete nextDocuments[type]
      return nextDocuments
    })
  }

  const renderDocumentSlot = (slot: DocumentSlot) => {
    const document = documents.find((item) => item.tipo_documento === slot.type)
    const pending = pendingDocuments[slot.type]
    const fileInputId = `detail-${slot.type}`
    const emptyLabel = slot.image ? 'Sin fotografía' : 'Sin documento'

    return (
      <article className="attachment-card" key={slot.type}>
        <div className="attachment-card-heading">
          <div className="attachment-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6 2h8l5 5v15H6V2Zm2 2v16h9V8h-4V4H8Zm7 1.4V6h.6L15 5.4ZM10 11h5v2h-5v-2Zm0 4h5v2h-5v-2Z" />
            </svg>
          </div>
          <div>
            <h5>{slot.title}</h5>
            <p>
              {pending
                ? `${pending.name} · ${formatBytes(pending.size)}`
                : document
                  ? `${document.nombre_archivo} · ${formatBytes(document.size_bytes)}`
                  : emptyLabel}
            </p>
          </div>
        </div>

        {slot.image && pending && <LocalImagePreview file={pending} />}
        {slot.image && !pending && document && (
          <AuthenticatedImagePreview
            donationId={donationId}
            document={document}
            authToken={authToken}
          />
        )}

        {isEditing && (
          <div className="attachment-picker">
            <input
              className="attachment-file-input"
              id={fileInputId}
              type="file"
              accept={slot.image
                ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
                : '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
              onChange={(event) => {
                selectDocument(slot.type, event.target.files?.[0])
                event.currentTarget.value = ''
              }}
            />
            <label htmlFor={fileInputId}>
              {document || pending
                ? slot.image ? 'Reemplazar imagen' : 'Reemplazar archivo'
                : slot.image ? 'Seleccionar imagen' : 'Seleccionar archivo'}
            </label>
            <span>{pending?.name ?? (slot.image ? 'Ninguna imagen seleccionada' : 'Ningún archivo seleccionado')}</span>
          </div>
        )}

        {document ? (
          <div className="document-actions">
            <button type="button" onClick={() => void viewDocument(document)}>
              Ver
            </button>
            {isEditing && (
              <button
                className="document-action--danger"
                type="button"
                onClick={() => void removeDocument(document)}
              >
                Eliminar
              </button>
            )}
            {isEditing && pending && (
              <button type="button" onClick={() => clearPendingDocument(slot.type)}>
                Quitar selección
              </button>
            )}
          </div>
        ) : isEditing ? (
          pending && (
            <div className="document-actions">
              <button type="button" onClick={() => clearPendingDocument(slot.type)}>
                Quitar selección
              </button>
            </div>
          )
        ) : (
          <p className="document-empty-copy">{emptyLabel}</p>
        )}
      </article>
    )
  }

  const receptionPlacesById = new Map(
    [...receptionPlaces, ...(detail?.lugar_recepcion ?? [])].map((place) => [
      place.id,
      place,
    ]),
  )
  const availableReceptionPlaces = [...receptionPlacesById.values()]
  const upcRepresentativesById = new Map(
    [...upcRepresentatives, ...(detail?.representante_upc ? [detail.representante_upc] : [])].map(
      (representative) => [representative.id, representative],
    ),
  )
  const availableUpcRepresentatives = [...upcRepresentativesById.values()]
  const availableSafekeepingWarehouses = [
    ...new Map(
      [...safekeepingWarehouses, ...(detail?.almacen_resguardo ? [detail.almacen_resguardo] : [])]
        .map((item) => [item.id, item]),
    ).values(),
  ]
  const availableDistributionPlaces = [
    ...new Map(
      [...distributionPlaces, ...(detail?.lugar_distribucion ?? [])]
        .map((item) => [item.id, item]),
    ).values(),
  ]
  const availableDestinationWarehouses = [
    ...new Map(
      [...destinationWarehouses, ...(detail?.almacen_destino ? [detail.almacen_destino] : [])]
        .map((item) => [item.id, item]),
    ).values(),
  ]
  const availableCities = [
    ...new Map(
      [...cities, ...(detail?.ciudad ? [detail.ciudad] : [])].map((item) => [item.id, item]),
    ).values(),
  ]
  const selectedCity = availableCities.find((item) => item.id === form?.ciudad)
  const activeSectionIndex = donationSections.findIndex(
    (section) => section.number === activeSection,
  )
  const previousSection = donationSections[activeSectionIndex - 1]
  const nextSection = donationSections[activeSectionIndex + 1]

  return (
    <main
      className="dashboard-main dashboard-view donation-registration-page donation-detail-page"
      id="detalle-donacion"
      key={donationId}
    >
      <header className="donation-detail-page-header">
        <div className="monetary-registration-heading">
          <p>DONATIVOS INSTITUCIONALES</p>
          <h1 id="detail-title">Consultar donación</h1>
          <span>Sistema de Gestión de Donaciones Institucionales — CONAPINA</span>
        </div>
          <div className="donation-modal-header-actions">
            <button
              className="detail-edit-button"
              type="button"
              onClick={onClose}
              disabled={isSaving || Boolean(pendingActaAction)}
            >
              Volver al listado
            </button>
            {!isEditing && (
              <button
                className="detail-edit-button"
                type="button"
                onClick={startEditing}
                disabled={!detail || isSaving || Boolean(pendingActaAction)}
              >
                Editar
              </button>
            )}
            <button
              className="detail-edit-button"
              type="button"
              onClick={() => setActiveSection(11)}
              disabled={!detail || isEditing || isSaving || Boolean(pendingActaAction)}
            >
              Gestionar actas
            </button>
            {activeActa && (
              <button
                className="detail-edit-button"
                type="button"
                onClick={() => void viewActa()}
                disabled={isOpeningActa || Boolean(pendingActaAction)}
              >
                Ver Acta Final
              </button>
            )}
            <button
              className="detail-edit-button donation-detail-close-button"
              type="button"
              onClick={onClose}
              disabled={isSaving || Boolean(pendingActaAction)}
              aria-label="Cerrar detalle"
              title="Cerrar"
            >
              ×
            </button>
          </div>
      </header>

      <form className="donation-detail-page-form" onSubmit={saveChanges}>
        <div className="donation-section-layout">
          <div className="donation-section-main">
            <div className="monetary-folder-panel donation-registration-panel">
          <div className="donation-modal-body">
            {isLoading ? (
              <p className="detail-modal-state">Cargando...</p>
            ) : !detail || !form ? (
              <p className="detail-modal-state detail-modal-state--error">{message}</p>
            ) : (
              <>
                <section className="draft-summary detail-administrative-summary">
                  <div><span>Correlativo de acta</span><strong>{detail.correlativo_acta ?? 'Por asignar'}</strong></div>
                  <div><span>Estado</span><strong className="draft-status">{detail.estado}</strong></div>
                  <div><span>Creado por</span><strong>{detail.created_by_name ?? 'Usuario no disponible'}</strong></div>
                  <div><span>Fecha de creación</span><strong>{new Date(detail.created_at).toLocaleString('es-SV')}</strong></div>
                </section>

                <section className="donation-form-section" hidden={activeSection !== 1}>
                  <div className="donation-section-heading"><span>Sección 1</span><h3>Información general del donativo</h3></div>
                  <div className="donation-fields-grid">
                    <div className="donation-field"><label>Tipo de registro *</label><input value={form.tipo_registro} onChange={(event) => setField('tipo_registro', event.target.value)} disabled={!isEditing} /></div>
                    <div className="donation-field"><label>Estado</label><input value={detail.estado} readOnly /></div>
                    <div className="donation-field donation-field--wide"><label>Nombre del proyecto / donativo *</label><input value={form.nombre_proyecto} onChange={(event) => setField('nombre_proyecto', event.target.value)} disabled={!isEditing} /></div>
                    <div className="donation-field"><label htmlFor="detail-tipo-gestion">Tipo de gestión *</label><FormSelect id="detail-tipo-gestion" value={form.tipo_gestion} options={managementTypes} onChange={(value) => setField('tipo_gestion', value)} disabled={!isEditing} required /></div>
                    <div className="donation-field"><label>Departamento / Sección / Otros</label><input value={form.dpto_seccion} onChange={(event) => setField('dpto_seccion', event.target.value)} disabled={!isEditing} /></div>
                    <div className="donation-field"><label htmlFor="detail-fecha-recepcion">Fecha de recepción *</label><DatePicker id="detail-fecha-recepcion" value={form.fecha_recepcion} onChange={(value) => setField('fecha_recepcion', value)} disabled={!isEditing} required /></div>
                    <div className="donation-field donation-field--wide"><label htmlFor="detail-lugar-recepcion">Lugar de recepción *</label><FormMultiSelect id="detail-lugar-recepcion" values={form.lugar_recepcion} options={availableReceptionPlaces.map((place) => ({ value: place.id, label: place.nombre }))} onChange={(values) => setField('lugar_recepcion', values)} disabled={!isEditing} required loading={isEditing && isReceptionPlacesLoading} error={isEditing ? receptionPlacesError : undefined} onRetry={() => void loadReceptionPlaces()} /></div>
                  </div>

                  <div className="supporting-documents">
                    <div className="supporting-documents-heading"><div><span>Sub-Sección 1.2</span><h4>Memorándums</h4><p>Documentos activos asociados al donativo.</p></div><strong>{memorandumDocumentSlots.filter((slot) => documents.some((document) => document.tipo_documento === slot.type)).length} activos</strong></div>
                    <div className="attachment-grid">
                      {memorandumDocumentSlots.map(renderDocumentSlot)}
                    </div>
                  </div>
                </section>

                <section className="donation-form-section" hidden={activeSection !== 2}>
                  <div className="donation-section-heading">
                    <span>Sección 2</span>
                    <h3>
                      Información de Representante de Unidad de Programas y Cooperación (UPC)
                    </h3>
                  </div>
                  <div className="donation-fields-grid">
                    <div className="donation-field donation-field--wide">
                      <label htmlFor="detail-representante-upc">Representante UPC</label>
                      <FormSelect
                        id="detail-representante-upc"
                        value={form.representante_upc}
                        options={availableUpcRepresentatives.map((representative) => ({
                          value: representative.id,
                          label: representative.nombre,
                        }))}
                        onChange={(value) => setField('representante_upc', value)}
                        placeholder={isEditing ? 'Seleccione un representante' : 'Sin representante'}
                        disabled={!isEditing}
                        loading={isEditing && isUpcRepresentativesLoading}
                        error={isEditing ? upcRepresentativesError : undefined}
                        onRetry={() => void loadUpcRepresentatives()}
                      />
                    </div>
                  </div>

                  <div className="supporting-documents">
                    <div className="supporting-documents-heading">
                      <div>
                        <span>Documento de la Sección 2</span>
                        <h4>Acta de Donación emitida por CONAPINA</h4>
                        <p>Documento activo asociado al donativo.</p>
                      </div>
                      <strong>
                        {documents.some(
                          (document) => document.tipo_documento === 'ACTA_CONAPINA',
                        )
                          ? '1 activo'
                          : 'Sin documento'}
                      </strong>
                    </div>
                    <div className="attachment-grid attachment-grid--single">
                      {renderDocumentSlot(conapinaRecordSlot)}
                    </div>
                  </div>
                </section>

                <section className="donation-form-section" hidden={activeSection !== 3}>
                  <div className="donation-section-heading">
                    <span>Sección 3</span>
                    <h3>Documento de acuerdo de donación</h3>
                  </div>

                  <div className="supporting-documents">
                    <div className="supporting-documents-heading">
                      <div>
                        <span>Documento de la Sección 3</span>
                        <h4>Acuerdo de Donación</h4>
                        <p>Documento activo asociado al donativo.</p>
                      </div>
                      <strong>
                        {documents.some(
                          (document) => document.tipo_documento === 'ACUERDO_DONACION',
                        )
                          ? '1 activo'
                          : 'Sin documento'}
                      </strong>
                    </div>
                    <div className="attachment-grid attachment-grid--single">
                      {renderDocumentSlot(donationAgreementSlot)}
                    </div>
                  </div>
                </section>

                <section className="donation-form-section" hidden={activeSection !== 4}>
                  <div className="donation-section-heading">
                    <span>Sección 4</span>
                    <h3>Comprobante de donación</h3>
                  </div>

                  <div className="donation-fields-grid">
                    <div className="donation-field">
                      <label htmlFor="detail-receipt-number">N° de Comprobante</label>
                      <input
                        id="detail-receipt-number"
                        maxLength={200}
                        value={form.n_comprobante}
                        onChange={(event) => setField('n_comprobante', event.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-receipt-date">Fecha de comprobante</label>
                      <DatePicker
                        id="detail-receipt-date"
                        value={form.fecha_comprobante}
                        onChange={(value) => setField('fecha_comprobante', value)}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="supporting-documents">
                    <div className="supporting-documents-heading">
                      <div>
                        <span>Documento de la Sección 4</span>
                        <h4>Comprobante emitido por Gerencia Financiera</h4>
                        <p>PDF, DOC o DOCX, máximo 10 MB.</p>
                      </div>
                      <strong>
                        {documents.some(
                          (document) => document.tipo_documento === 'COMPROBANTE_GF',
                        )
                          ? '1 activo'
                          : 'Sin documento'}
                      </strong>
                    </div>
                    <div className="attachment-grid attachment-grid--single">
                      {renderDocumentSlot(financialReceiptSlot)}
                    </div>
                  </div>
                </section>

                <section className="donation-form-section" hidden={activeSection !== 5}>
                  <div className="donation-section-heading">
                    <span>Sección 5</span>
                    <h3>Resguardo y distribución</h3>
                  </div>

                  <div className="donation-fields-grid">
                    <div className="donation-field">
                      <label htmlFor="detail-safekeeping-warehouse">
                        Almacén de Resguardo de donativo
                      </label>
                      <FormSelect
                        id="detail-safekeeping-warehouse"
                        value={form.almacen_resguardo}
                        options={availableSafekeepingWarehouses.map((item) => ({
                          value: item.id,
                          label: item.nombre,
                        }))}
                        onChange={(value) => setField('almacen_resguardo', value)}
                        placeholder={isEditing ? 'Seleccione un almacén' : 'Sin almacén'}
                        disabled={!isEditing}
                        loading={isEditing && isSafekeepingWarehousesLoading}
                        error={isEditing ? safekeepingWarehousesError : undefined}
                        onRetry={() => void loadSafekeepingWarehouses()}
                      />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-distribution-place">Lugar de distribución</label>
                      <FormMultiSelect
                        id="detail-distribution-place"
                        values={form.lugar_distribucion}
                        options={availableDistributionPlaces.map((item) => ({
                          value: item.id,
                          label: item.nombre,
                        }))}
                        onChange={(values) => setField('lugar_distribucion', values)}
                        disabled={!isEditing}
                        loading={isEditing && isDistributionPlacesLoading}
                        error={isEditing ? distributionPlacesError : undefined}
                        onRetry={() => void loadDistributionPlaces()}
                      />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-financial-report-date">
                        Fecha reporte financiero
                      </label>
                      <DatePicker
                        id="detail-financial-report-date"
                        value={form.fechareport_financiero}
                        onChange={(value) => setField('fechareport_financiero', value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-destination-warehouse">Almacén destino</label>
                      <FormSelect
                        id="detail-destination-warehouse"
                        value={form.almacen_destino}
                        options={availableDestinationWarehouses.map((item) => ({
                          value: item.id,
                          label: item.nombre,
                        }))}
                        onChange={(value) => setField('almacen_destino', value)}
                        placeholder={isEditing ? 'Seleccione un almacén' : 'Sin almacén'}
                        disabled={!isEditing}
                        loading={isEditing && isDestinationWarehousesLoading}
                        error={isEditing ? destinationWarehousesError : undefined}
                        onRetry={() => void loadDestinationWarehouses()}
                      />
                    </div>
                  </div>
                </section>

                <section
                  className="donation-form-section"
                  id="donation-section-6-panel"
                  role="tabpanel"
                  aria-labelledby="donation-section-6-tab"
                  hidden={activeSection !== 6}
                >
                  <div className="donation-section-heading">
                    <span>Sección 6</span>
                    <h3>06 · Almacenes y Productos</h3>
                  </div>

                  <DonationWarehousesSection
                    value={warehouseGroups}
                    onChange={setWarehouseGroups}
                    disabled={!isEditing || isSaving}
                  />
                </section>

                <section className="donation-form-section" hidden={activeSection !== 7}>
                  <div className="donation-section-heading">
                    <span>Sección 7</span>
                    <h3>Documentación de Acta</h3>
                  </div>

                  <div className="donation-fields-grid">
                    <div className="donation-field donation-field--wide">
                      <label htmlFor="detail-record-framework">Marco del acta</label>
                      <textarea id="detail-record-framework" rows={3} maxLength={5000} value={form.marco_acta} onChange={(event) => setField('marco_acta', event.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="donation-field donation-field--wide">
                      <label htmlFor="detail-record-objective">Objetivo del acta</label>
                      <textarea id="detail-record-objective" rows={3} maxLength={5000} value={form.objetivo_acta} onChange={(event) => setField('objetivo_acta', event.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="donation-field donation-field--wide">
                      <label htmlFor="detail-record-delivered">Entregados en acta</label>
                      <textarea id="detail-record-delivered" rows={3} maxLength={5000} value={form.entregados_acta} onChange={(event) => setField('entregados_acta', event.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="donation-field donation-field--wide">
                      <label htmlFor="detail-record-delivery">Entrega del acta</label>
                      <textarea id="detail-record-delivery" rows={3} maxLength={5000} value={form.entrega_acta} onChange={(event) => setField('entrega_acta', event.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-record-city">Ciudad</label>
                      <FormSelect
                        id="detail-record-city"
                        value={form.ciudad}
                        options={availableCities.map((item) => ({ value: item.id, label: item.ciudad }))}
                        onChange={(value) => setField('ciudad', value)}
                        placeholder={isEditing ? 'Seleccione una ciudad' : 'Sin ciudad'}
                        disabled={!isEditing}
                        loading={isEditing && isCitiesLoading}
                        error={isEditing ? citiesError : undefined}
                        onRetry={() => void loadCities()}
                      />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-record-department">Departamento</label>
                      <input id="detail-record-department" value={selectedCity?.departamento ?? ''} readOnly />
                    </div>
                    <div className="donation-field donation-field--wide">
                      <label htmlFor="detail-observations">Observaciones</label>
                      <textarea id="detail-observations" rows={3} value={form.observaciones} onChange={(event) => setField('observaciones', event.target.value)} disabled={!isEditing} />
                    </div>
                  </div>
                </section>

                <section className="donation-form-section" hidden={activeSection !== 8}>
                  <div className="donation-section-heading">
                    <span>Sección 8</span>
                    <h3>Información del Donante o Representante</h3>
                  </div>

                  <div className="donation-fields-grid">
                    <div className="donation-field">
                      <label htmlFor="detail-donor-name">Nombre del donante o representante</label>
                      <input id="detail-donor-name" maxLength={300} value={form.nombre_donante} onChange={(event) => setField('nombre_donante', event.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-donor-position">Cargo</label>
                      <input id="detail-donor-position" maxLength={300} value={form.cargo_donante} onChange={(event) => setField('cargo_donante', event.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-donor-entity">Nombre de la entidad</label>
                      <input id="detail-donor-entity" maxLength={500} value={form.nombre_entidad} onChange={(event) => setField('nombre_entidad', event.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-donor-dui">DUI del donante</label>
                      <input
                        id="detail-donor-dui"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="00000000-0"
                        value={form.dui_donante}
                        onChange={(event) => setField('dui_donante', formatDui(event.target.value))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </section>

                <section className="donation-form-section" hidden={activeSection !== 9}>
                  <div className="donation-section-heading">
                    <span>Sección 9</span>
                    <h3>Encargado de Recepción CONAPINA</h3>
                  </div>

                  <div className="donation-fields-grid">
                    <div className="donation-field">
                      <label htmlFor="detail-reception-manager-name">Nombre del encargado</label>
                      {isEditing ? (
                        <FormSelect
                          id="detail-reception-manager-name"
                          value={form.encargado_personal_id}
                          options={receptionManagers.map((manager) => ({
                            value: manager.id,
                            label: manager.nombre,
                          }))}
                          onChange={(value) => setField('encargado_personal_id', value)}
                          placeholder="Buscar encargado..."
                          searchable
                          loading={isReceptionManagersLoading}
                          error={receptionManagersError}
                          onRetry={() => void loadReceptionManagers()}
                        />
                      ) : (
                        <input id="detail-reception-manager-name" value={detail.nombre_encargado ?? ''} readOnly />
                      )}
                    </div>
                    <div className="donation-field">
                      <label htmlFor="detail-reception-manager-position">Cargo del encargado</label>
                      <input
                        id="detail-reception-manager-position"
                        value={isEditing ? selectedReceptionManager?.cargo ?? '' : detail.cargo_encargado ?? ''}
                        readOnly
                      />
                    </div>
                  </div>
                </section>

                <section className="donation-form-section" hidden={activeSection !== 10}>
                  <div className="donation-section-heading">
                    <span>Sección 10</span>
                    <h3>Registro fotográfico</h3>
                  </div>

                  <div className="attachment-grid photo-attachment-grid">
                    {photoDocumentSlots.map(renderDocumentSlot)}
                  </div>
                </section>

                {activeSection === 11 && (
                  <DonationProvisionalActsSection
                    incomes={incomes}
                    actas={actas}
                    isLoading={isLoading}
                    pendingAction={pendingActaAction}
                    onGenerate={(incomeId) => void generateTypedActa(incomeId)}
                    onView={(acta) => void viewTypedActa(acta)}
                  />
                )}
              </>
            )}
            {detail && <div className={`donation-form-message${hasError ? ' donation-form-message--error' : ''}`} role={hasError ? 'alert' : 'status'}>{message}</div>}
          </div>
            </div>

            <footer className="monetary-folder-actions donation-registration-actions">
              <p>{isEditing ? 'Modo edición activo.' : 'Modo lectura.'}</p>
              <div>
                {previousSection && (
                  <button
                    className="modal-secondary-button"
                    type="button"
                    onClick={() => setActiveSection(previousSection.number)}
                    disabled={isSaving}
                  >
                    Anterior
                  </button>
                )}
                {nextSection && (
                  <button
                    className="modal-secondary-button"
                    type="button"
                    onClick={() => setActiveSection(nextSection.number)}
                    disabled={isSaving}
                  >
                    Siguiente
                  </button>
                )}
                {isEditing && (
                  <>
                    <button className="modal-secondary-button" type="button" onClick={cancelEditing} disabled={isSaving}>Cancelar edición</button>
                    <button className="modal-primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar cambios'}</button>
                  </>
                )}
              </div>
            </footer>
          </div>

          <DonationSectionNavigator
            activeSection={activeSection}
            invalidSections={invalidSections}
            onChange={setActiveSection}
          />
        </div>
      </form>
    </main>
  )
}

export default DonationDetailModal
