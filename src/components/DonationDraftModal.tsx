import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  createDonation,
  createDonationIncome,
  deleteDonationIncome,
  getCities,
  getConapinaReceptionManagers,
  DonationSaveError,
  getDestinationWarehouses,
  getDistributionPlaces,
  getReceptionPlaces,
  getSafekeepingWarehouses,
  getUpcRepresentatives,
  uploadDonationDocument,
  updateDonationIncome,
} from '../services/donations'
import type {
  DonationDocumentType,
  CityCatalogItem,
  ConapinaReceptionManager,
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
import '../pages/DonativoMonetarioForm.css'
import './DonationDraftModal.css'

type DonationDraftModalProps = {
  creatorName: string
  authToken: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}

type DonationForm = {
  tipoRegistro: string
  nombreDonativo: string
  tipoGestion: string
  departamentoSeccion: string
  fechaRecepcion: string
  lugarRecepcion: string[]
  observaciones: string
  representanteUpc: string
  numeroComprobante: string
  fechaComprobante: string
  almacenResguardo: string
  lugarDistribucion: string[]
  fechaReporteFinanciero: string
  almacenDestino: string
  marcoActa: string
  objetivoActa: string
  entregadosActa: string
  entregaActa: string
  ciudad: string
  nombreDonante: string
  cargoDonante: string
  nombreEntidad: string
  duiDonante: string
  encargadoPersonalId: string
}

type RequiredField =
  | 'tipoRegistro'
  | 'nombreDonativo'
  | 'tipoGestion'
  | 'fechaRecepcion'
  | 'lugarRecepcion'
  | 'duiDonante'

type FormErrors = Partial<Record<RequiredField, string>>
type StringFormField = Exclude<keyof DonationForm, 'lugarRecepcion' | 'lugarDistribucion'>

type AttachmentField =
  | 'initialRecord'
  | 'executiveAuthorization'
  | 'conapinaRecord'
  | 'donationAgreement'
  | 'financialReceipt'
  | 'photo1'
  | 'photo2'
type Attachments = Record<AttachmentField, File | null>

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const allowedAttachmentExtensions = new Set(['.pdf', '.doc', '.docx'])
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const DUI_PATTERN = /^\d{8}-\d$/

function formatDui(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  return digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits
}

const attachmentDocumentTypes: Record<AttachmentField, DonationDocumentType> = {
  initialRecord: 'MEMO_INICIAL',
  executiveAuthorization: 'MEMO_DE',
  conapinaRecord: 'ACTA_CONAPINA',
  donationAgreement: 'ACUERDO_DONACION',
  financialReceipt: 'COMPROBANTE_GF',
  photo1: 'REGISTRO_FOTO_1',
  photo2: 'REGISTRO_FOTO_2',
}

const initialAttachments: Attachments = {
  initialRecord: null,
  executiveAuthorization: null,
  conapinaRecord: null,
  donationAgreement: null,
  financialReceipt: null,
  photo1: null,
  photo2: null,
}

const photoAttachmentSlots: { field: 'photo1' | 'photo2'; title: string }[] = [
  { field: 'photo1', title: 'Fotografía 1' },
  { field: 'photo2', title: 'Fotografía 2' },
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

function formatFileSize(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

const managementTypeOptions = [
  'En el marco de un proyecto',
  'Ofrecimiento',
  'Solicitud',
  'Asistencia Humanitaria',
]

const initialForm: DonationForm = {
  tipoRegistro: '',
  nombreDonativo: '',
  tipoGestion: '',
  departamentoSeccion: '',
  fechaRecepcion: '',
  lugarRecepcion: [],
  observaciones: '',
  representanteUpc: '',
  numeroComprobante: '',
  fechaComprobante: '',
  almacenResguardo: '',
  lugarDistribucion: [],
  fechaReporteFinanciero: '',
  almacenDestino: '',
  marcoActa: '',
  objetivoActa: '',
  entregadosActa: '',
  entregaActa: '',
  ciudad: '',
  nombreDonante: '',
  cargoDonante: '',
  nombreEntidad: '',
  duiDonante: '',
  encargadoPersonalId: '',
}

function DonationDraftModal({
  creatorName,
  authToken,
  onClose,
  onSaved,
}: DonationDraftModalProps) {
  const operationLockedRef = useRef(false)
  const persistedIncomeIdsRef = useRef<Set<string>>(new Set())
  const [activeSection, setActiveSection] = useState<DonationSectionNumber>(1)
  const [warehouseGroups, setWarehouseGroups] = useState<DonationWarehouseDraft[]>([])
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [createdDonationId, setCreatedDonationId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachments>(initialAttachments)
  const [attachmentErrors, setAttachmentErrors] = useState<
    Partial<Record<AttachmentField, string>>
  >({})
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
    (manager) => manager.id === form.encargadoPersonalId,
  )

  const updateField = (field: StringFormField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setStatusMessage('')
    setStatusType(null)

    if (
      (field === 'tipoRegistro' ||
        field === 'nombreDonativo' ||
        field === 'tipoGestion' ||
        field === 'fechaRecepcion') &&
      value.trim()
    ) {
      setErrors((current) => ({ ...current, [field]: undefined }))
    }
    if (field === 'duiDonante' && (!value || DUI_PATTERN.test(value))) {
      setErrors((current) => ({ ...current, duiDonante: undefined }))
    }
  }

  const updateReceptionPlaces = (values: string[]) => {
    setForm((current) => ({ ...current, lugarRecepcion: values }))
    setStatusMessage('')
    setStatusType(null)
    if (values.length > 0) {
      setErrors((current) => ({ ...current, lugarRecepcion: undefined }))
    }
  }

  const updateDistributionPlaces = (values: string[]) => {
    setForm((current) => ({ ...current, lugarDistribucion: values }))
    setStatusMessage('')
    setStatusType(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (operationLockedRef.current) return

    const nextErrors: FormErrors = {}

    if (!form.tipoRegistro.trim()) {
      nextErrors.tipoRegistro = 'Debe ingresar el tipo de registro.'
    }

    if (!form.nombreDonativo.trim()) {
      nextErrors.nombreDonativo = 'Debe ingresar el nombre del proyecto o donativo.'
    }

    if (!form.tipoGestion.trim()) {
      nextErrors.tipoGestion = 'Debe seleccionar el tipo de gestión.'
    }

    if (!form.fechaRecepcion) {
      nextErrors.fechaRecepcion = 'Debe ingresar la fecha de recepción.'
    }

    if (form.lugarRecepcion.length === 0) {
      nextErrors.lugarRecepcion = 'Debe seleccionar al menos un lugar de recepción.'
    }

    if (form.duiDonante && !DUI_PATTERN.test(form.duiDonante)) {
      nextErrors.duiDonante = 'Ingrese el DUI con formato 00000000-0.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      setActiveSection(
        Object.keys(nextErrors).some((field) => field !== 'duiDonante') ? 1 : 8,
      )
      setStatusMessage('Revise los campos requeridos antes de continuar.')
      setStatusType('error')
      return
    }

    if (Object.values(attachmentErrors).some(Boolean)) {
      const firstInvalidAttachment = (
        Object.entries(attachmentErrors) as [AttachmentField, string | undefined][]
      ).find(([, message]) => Boolean(message))?.[0]
      const attachmentSection: Partial<Record<AttachmentField, DonationSectionNumber>> = {
        initialRecord: 1,
        executiveAuthorization: 1,
        conapinaRecord: 2,
        donationAgreement: 3,
        financialReceipt: 4,
        photo1: 10,
        photo2: 10,
      }
      if (firstInvalidAttachment) setActiveSection(attachmentSection[firstInvalidAttachment] ?? 1)
      setStatusMessage('Revise los documentos seleccionados antes de continuar.')
      setStatusType('error')
      return
    }

    const incomeValidationError = validateDonationWarehouses(warehouseGroups)
    if (incomeValidationError) {
      setActiveSection(6)
      setStatusMessage(incomeValidationError)
      setStatusType('error')
      return
    }

    operationLockedRef.current = true
    setIsSaving(true)
    setStatusMessage('')
    setStatusType(null)

    try {
      let donationId = createdDonationId

      if (!donationId) {
        const createdDonation = await createDonation(
          {
            tipo_registro: form.tipoRegistro.trim(),
            nombre_proyecto: form.nombreDonativo.trim(),
            tipo_gestion: form.tipoGestion,
            dpto_seccion: form.departamentoSeccion.trim(),
            fecha_recepcion: form.fechaRecepcion,
            lugar_recepcion: form.lugarRecepcion,
            observaciones: form.observaciones.trim(),
            representante_upc: form.representanteUpc.trim(),
            n_comprobante: form.numeroComprobante.trim(),
            fecha_comprobante: form.fechaComprobante,
            almacen_resguardo: form.almacenResguardo.trim(),
            lugar_distribucion: form.lugarDistribucion,
            fechareport_financiero: form.fechaReporteFinanciero,
            almacen_destino: form.almacenDestino.trim(),
            marco_acta: form.marcoActa.trim(),
            objetivo_acta: form.objetivoActa.trim(),
            entregados_acta: form.entregadosActa.trim(),
            entrega_acta: form.entregaActa.trim(),
            ciudad: form.ciudad.trim(),
            nombre_donante: form.nombreDonante.trim(),
            cargo_donante: form.cargoDonante.trim(),
            nombre_entidad: form.nombreEntidad.trim(),
            dui_donante: form.duiDonante,
            encargado_personal_id: form.encargadoPersonalId,
          },
          authToken,
        )
        donationId = createdDonation.id
        setCreatedDonationId(donationId)
      }

      const currentIncomeIds = new Set(
        warehouseGroups.flatMap((warehouse) => warehouse.recordId ? [warehouse.recordId] : []),
      )
      for (const persistedIncomeId of persistedIncomeIdsRef.current) {
        if (!currentIncomeIds.has(persistedIncomeId)) {
          await deleteDonationIncome(donationId, persistedIncomeId, authToken)
          persistedIncomeIdsRef.current.delete(persistedIncomeId)
        }
      }

      const persistedWarehouses = [...warehouseGroups]
      for (const [index, warehouse] of warehouseGroups.entries()) {
        const input = donationWarehouseToInput(warehouse)
        const income = warehouse.recordId
          ? await updateDonationIncome(donationId, warehouse.recordId, input, authToken)
          : await createDonationIncome(donationId, input, authToken)
        const persistedWarehouse = donationIncomeToDraft(income)
        persistedWarehouses[index] = persistedWarehouse
        persistedIncomeIdsRef.current.add(income.id)
        setWarehouseGroups([...persistedWarehouses])
      }

      const selectedAttachments = Object.entries(attachments) as [AttachmentField, File | null][]
      const documentsToUpload = selectedAttachments.filter(
        (entry): entry is [AttachmentField, File] => entry[1] !== null,
      )
      let uploadFailed = false

      for (const [field, file] of documentsToUpload) {
        try {
          await uploadDonationDocument(
            donationId,
            attachmentDocumentTypes[field],
            file,
            authToken,
          )
          setAttachments((current) => ({ ...current, [field]: null }))
        } catch {
          uploadFailed = true
        }
      }

      if (uploadFailed) {
        setStatusMessage(
          'La donación fue creada, pero uno o más documentos no pudieron guardarse. Puede reintentar.',
        )
        setStatusType('error')
        await onSaved()
        return
      }

      setStatusMessage(
        documentsToUpload.length > 0
          ? 'Donación y documentos guardados correctamente.'
          : 'Donación guardada correctamente.',
      )
      setStatusType('success')
      await onSaved()
      onClose()
    } catch (error) {
      setStatusMessage(
        error instanceof DonationSaveError
          ? error.message
          : 'No fue posible guardar la donación en este momento.',
      )
      setStatusType('error')
    } finally {
      operationLockedRef.current = false
      setIsSaving(false)
    }
  }

  const updateAttachment = (field: AttachmentField, file: File | undefined) => {
    if (!file) return

    const extensionStart = file.name.lastIndexOf('.')
    const actualExtension =
      extensionStart >= 0 ? file.name.slice(extensionStart).toLowerCase() : ''
    let errorMessage = ''
    let failedValidation = ''

    const isPhoto = field === 'photo1' || field === 'photo2'
    const allowedExtensions = isPhoto ? allowedImageExtensions : allowedAttachmentExtensions

    if (!allowedExtensions.has(actualExtension)) {
      errorMessage = isPhoto
        ? 'Seleccione una imagen JPG, JPEG, PNG o WebP válida.'
        : 'Seleccione un archivo PDF, DOC o DOCX válido.'
      failedValidation = 'extension'
    } else if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) {
      errorMessage = 'El archivo debe tener un tamaño máximo de 10 MB.'
      failedValidation = 'size'
    }

    if (errorMessage) {
      if (import.meta.env.DEV) {
        console.debug('[SIGEDI adjuntos] Validación rechazada', {
          field,
          failedValidation,
          extension: actualExtension || 'sin extensión',
          mimeType: file.type || 'no informado',
          sizeBytes: file.size,
        })
      }
      setAttachmentErrors((current) => ({ ...current, [field]: errorMessage }))
      return
    }

    setAttachments((current) => ({ ...current, [field]: file }))
    setAttachmentErrors((current) => {
      const nextErrors = { ...current }
      delete nextErrors[field]
      return nextErrors
    })
    setStatusMessage('')
    setStatusType(null)
  }

  const removeAttachment = (field: AttachmentField) => {
    setAttachments((current) => ({ ...current, [field]: null }))
    setAttachmentErrors((current) => {
      const nextErrors = { ...current }
      delete nextErrors[field]
      return nextErrors
    })
  }

  const selectedAttachmentCount = [
    attachments.initialRecord,
    attachments.executiveAuthorization,
  ].filter(Boolean).length
  const selectedCity = cities.find((item) => item.id === form.ciudad)
  const activeSectionIndex = donationSections.findIndex(
    (section) => section.number === activeSection,
  )
  const hasPreviousSection = activeSectionIndex > 0
  const hasNextSection = activeSectionIndex < donationSections.length - 1

  const goToPreviousSection = () => {
    const previousSection = donationSections[activeSectionIndex - 1]
    if (previousSection) setActiveSection(previousSection.number)
  }

  const goToNextSection = () => {
    const nextSection = donationSections[activeSectionIndex + 1]
    if (nextSection) setActiveSection(nextSection.number)
  }

  const invalidSections = new Set<DonationSectionNumber>()
  if (
    errors.tipoRegistro ||
    errors.nombreDonativo ||
    errors.tipoGestion ||
    errors.fechaRecepcion ||
    errors.lugarRecepcion ||
    attachmentErrors.initialRecord ||
    attachmentErrors.executiveAuthorization
  ) invalidSections.add(1)
  if (attachmentErrors.conapinaRecord) invalidSections.add(2)
  if (attachmentErrors.donationAgreement) invalidSections.add(3)
  if (attachmentErrors.financialReceipt) invalidSections.add(4)
  if (errors.duiDonante) invalidSections.add(8)
  if (attachmentErrors.photo1 || attachmentErrors.photo2) invalidSections.add(10)

  return (
    <main
      className="dashboard-main dashboard-view donation-registration-page"
      id="registro-donacion"
      key="registro-donacion"
    >
      <header className="monetary-registration-heading">
        <p>DONATIVOS INSTITUCIONALES</p>
        <h1>Registrar nueva donación</h1>
        <span>Sistema de Gestión de Donaciones Institucionales — CONAPINA</span>
      </header>

      <form className="donation-registration-folder" onSubmit={handleSubmit} noValidate>
        <div className="donation-section-layout">
          <div className="donation-section-main">
            <div className="monetary-folder-panel donation-registration-panel">
          <div className="donation-modal-body">
            <section className="draft-summary" aria-label="Información inicial del borrador">
              <div>
                <span>Correlativo de acta</span>
                <strong>Por asignar</strong>
              </div>
              <div>
                <span>Creador</span>
                <strong>{creatorName}</strong>
              </div>
              <div>
                <span>Estado inicial</span>
                <strong className="draft-status">BORRADOR</strong>
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-1-panel"
              role="tabpanel"
              aria-labelledby="donation-section-1-tab"
              hidden={activeSection !== 1}
            >
              <div className="donation-section-heading">
                <span>Sección 1</span>
                <h3 id="general-info-title">Información general del donativo</h3>
              </div>

              <div className="donation-fields-grid">
                <div className="donation-field">
                  <label htmlFor="tipo-registro">
                    Tipo de registro <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="tipo-registro"
                    name="tipoRegistro"
                    type="text"
                    value={form.tipoRegistro}
                    onChange={(event) => updateField('tipoRegistro', event.target.value)}
                    placeholder="Ingrese el tipo de registro"
                    required
                    aria-invalid={Boolean(errors.tipoRegistro)}
                    aria-describedby={errors.tipoRegistro ? 'tipo-registro-error' : undefined}
                  />
                  {errors.tipoRegistro && (
                    <p className="donation-field-error" id="tipo-registro-error" role="alert">
                      {errors.tipoRegistro}
                    </p>
                  )}
                </div>

                <div className="donation-field">
                  <label htmlFor="estado-donativo">Estado</label>
                  <input id="estado-donativo" type="text" value="BORRADOR" readOnly />
                </div>

                <div className="donation-field donation-field--wide">
                  <label htmlFor="nombre-donativo">
                    Nombre del proyecto / donativo <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="nombre-donativo"
                    name="nombreDonativo"
                    type="text"
                    value={form.nombreDonativo}
                    onChange={(event) => updateField('nombreDonativo', event.target.value)}
                    placeholder="Ingrese el nombre del proyecto o donativo"
                    required
                    aria-invalid={Boolean(errors.nombreDonativo)}
                    aria-describedby={errors.nombreDonativo ? 'nombre-donativo-error' : undefined}
                  />
                  {errors.nombreDonativo && (
                    <p className="donation-field-error" id="nombre-donativo-error" role="alert">
                      {errors.nombreDonativo}
                    </p>
                  )}
                </div>

                <div className="donation-field">
                  <label htmlFor="tipo-gestion">Tipo de gestión</label>
                  <FormSelect
                    id="tipo-gestion"
                    name="tipoGestion"
                    value={form.tipoGestion}
                    options={managementTypeOptions}
                    onChange={(value) => updateField('tipoGestion', value)}
                    disabled={isSaving}
                    required
                    ariaInvalid={Boolean(errors.tipoGestion)}
                    ariaDescribedBy={errors.tipoGestion ? 'tipo-gestion-error' : undefined}
                  />
                  {errors.tipoGestion && (
                    <p className="donation-field-error" id="tipo-gestion-error" role="alert">
                      {errors.tipoGestion}
                    </p>
                  )}
                </div>

                <div className="donation-field">
                  <label htmlFor="departamento-seccion">Departamento / Sección / Otros</label>
                  <input
                    id="departamento-seccion"
                    name="departamentoSeccion"
                    type="text"
                    value={form.departamentoSeccion}
                    onChange={(event) => updateField('departamentoSeccion', event.target.value)}
                    placeholder="Ingrese el departamento o sección"
                  />
                </div>

                <div className="donation-field">
                  <label htmlFor="fecha-recepcion">Fecha de recepción</label>
                  <DatePicker
                    id="fecha-recepcion"
                    name="fechaRecepcion"
                    value={form.fechaRecepcion}
                    onChange={(value) => updateField('fechaRecepcion', value)}
                    disabled={isSaving}
                    required
                    ariaInvalid={Boolean(errors.fechaRecepcion)}
                    ariaDescribedBy={errors.fechaRecepcion ? 'fecha-recepcion-error' : undefined}
                  />
                  {errors.fechaRecepcion && (
                    <p className="donation-field-error" id="fecha-recepcion-error" role="alert">
                      {errors.fechaRecepcion}
                    </p>
                  )}
                </div>

                <div className="donation-field donation-field--wide">
                  <label htmlFor="lugar-recepcion">Lugar de recepción</label>
                  <FormMultiSelect
                    id="lugar-recepcion"
                    values={form.lugarRecepcion}
                    options={receptionPlaces.map((place) => ({
                      value: place.id,
                      label: place.nombre,
                    }))}
                    onChange={updateReceptionPlaces}
                    disabled={isSaving}
                    required
                    loading={isReceptionPlacesLoading}
                    error={receptionPlacesError}
                    onRetry={() => void loadReceptionPlaces()}
                    ariaInvalid={Boolean(errors.lugarRecepcion)}
                    ariaDescribedBy={errors.lugarRecepcion ? 'lugar-recepcion-error' : undefined}
                  />
                  {errors.lugarRecepcion && (
                    <p className="donation-field-error" id="lugar-recepcion-error" role="alert">
                      {errors.lugarRecepcion}
                    </p>
                  )}
                </div>

              </div>

              <div className="supporting-documents">
                <div className="supporting-documents-heading">
                  <div>
                    <span>Documentos de apoyo</span>
                    <h4>Memorándums</h4>
                    <p>Los archivos seleccionados se cargarán al guardar el borrador.</p>
                  </div>
                  <strong>
                    {selectedAttachmentCount === 0
                      ? 'Sin documentos seleccionados'
                      : `${selectedAttachmentCount} documento${
                          selectedAttachmentCount === 1 ? '' : 's'
                        } seleccionado${selectedAttachmentCount === 1 ? '' : 's'}`}
                  </strong>
                </div>

                <div className="attachment-grid">
                  <article className="attachment-card">
                    <div className="attachment-card-heading">
                      <div className="attachment-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M6 2h8l5 5v15H6V2Zm2 2v16h9V8h-4V4H8Zm7 1.4V6h.6L15 5.4ZM10 11h5v2h-5v-2Zm0 4h5v2h-5v-2Z" />
                        </svg>
                      </div>
                      <div>
                        <h5>Memorándum de registro inicial</h5>
                        <p>Documento de registro del donativo</p>
                      </div>
                    </div>
                    <div className="attachment-picker">
                      <input
                        className="attachment-file-input"
                        id="initial-record-file"
                        name="initialRecordFile"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={isSaving}
                        onChange={(event) => {
                          updateAttachment('initialRecord', event.target.files?.[0])
                          event.currentTarget.value = ''
                        }}
                      />
                      <label htmlFor="initial-record-file">
                        {attachments.initialRecord ? 'Reemplazar archivo' : 'Seleccionar archivo'}
                      </label>
                      <span title={attachments.initialRecord?.name}>
                        {attachments.initialRecord ? (
                          <>
                            {attachments.initialRecord.name}
                            <small>{formatFileSize(attachments.initialRecord.size)}</small>
                          </>
                        ) : (
                          'Ningún archivo seleccionado'
                        )}
                      </span>
                      {attachments.initialRecord && (
                        <button
                          className="attachment-remove-button"
                          type="button"
                          onClick={() => removeAttachment('initialRecord')}
                          disabled={isSaving}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    {attachmentErrors.initialRecord && (
                      <p className="attachment-error" role="alert">
                        {attachmentErrors.initialRecord}
                      </p>
                    )}
                  </article>

                  <article className="attachment-card">
                    <div className="attachment-card-heading">
                      <div className="attachment-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M6 2h8l5 5v15H6V2Zm2 2v16h9V8h-4V4H8Zm7 1.4V6h.6L15 5.4ZM10 11h5v2h-5v-2Zm0 4h5v2h-5v-2Z" />
                        </svg>
                      </div>
                      <div>
                        <h5>Memorándum de autorización de Dirección Ejecutiva</h5>
                        <p>Documento de autorización institucional</p>
                      </div>
                    </div>
                    <div className="attachment-picker">
                      <input
                        className="attachment-file-input"
                        id="executive-authorization-file"
                        name="executiveAuthorizationFile"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={isSaving}
                        onChange={(event) => {
                          updateAttachment('executiveAuthorization', event.target.files?.[0])
                          event.currentTarget.value = ''
                        }}
                      />
                      <label htmlFor="executive-authorization-file">
                        {attachments.executiveAuthorization
                          ? 'Reemplazar archivo'
                          : 'Seleccionar archivo'}
                      </label>
                      <span title={attachments.executiveAuthorization?.name}>
                        {attachments.executiveAuthorization ? (
                          <>
                            {attachments.executiveAuthorization.name}
                            <small>{formatFileSize(attachments.executiveAuthorization.size)}</small>
                          </>
                        ) : (
                          'Ningún archivo seleccionado'
                        )}
                      </span>
                      {attachments.executiveAuthorization && (
                        <button
                          className="attachment-remove-button"
                          type="button"
                          onClick={() => removeAttachment('executiveAuthorization')}
                          disabled={isSaving}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    {attachmentErrors.executiveAuthorization && (
                      <p className="attachment-error" role="alert">
                        {attachmentErrors.executiveAuthorization}
                      </p>
                    )}
                  </article>
                </div>
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-2-panel"
              role="tabpanel"
              aria-labelledby="donation-section-2-tab"
              hidden={activeSection !== 2}
            >
              <div className="donation-section-heading">
                <span>Sección 2</span>
                <h3 id="upc-info-title">
                  Información de Representante de Unidad de Programas y Cooperación (UPC)
                </h3>
              </div>

              <div className="donation-fields-grid">
                <div className="donation-field donation-field--wide">
                  <label htmlFor="representante-upc">Representante UPC</label>
                  <FormSelect
                    id="representante-upc"
                    name="representanteUpc"
                    value={form.representanteUpc}
                    options={upcRepresentatives.map((representative) => ({
                      value: representative.id,
                      label: representative.nombre,
                    }))}
                    onChange={(value) => updateField('representanteUpc', value)}
                    placeholder="Seleccione un representante"
                    disabled={isSaving}
                    loading={isUpcRepresentativesLoading}
                    error={upcRepresentativesError}
                    onRetry={() => void loadUpcRepresentatives()}
                  />
                </div>
              </div>

              <div className="supporting-documents">
                <div className="supporting-documents-heading">
                  <div>
                    <span>Documento de la Sección 2</span>
                    <h4>Acta de Donación emitida por CONAPINA</h4>
                    <p>El archivo seleccionado se cargará al guardar el borrador.</p>
                  </div>
                  <strong>
                    {attachments.conapinaRecord
                      ? 'Documento seleccionado'
                      : 'Sin documento seleccionado'}
                  </strong>
                </div>

                <div className="attachment-grid attachment-grid--single">
                  <article className="attachment-card">
                    <div className="attachment-card-heading">
                      <div className="attachment-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M6 2h8l5 5v15H6V2Zm2 2v16h9V8h-4V4H8Zm7 1.4V6h.6L15 5.4ZM10 11h5v2h-5v-2Zm0 4h5v2h-5v-2Z" />
                        </svg>
                      </div>
                      <div>
                        <h5>Acta de Donación emitida por CONAPINA</h5>
                        <p>Documento institucional asociado al donativo</p>
                      </div>
                    </div>
                    <div className="attachment-picker">
                      <input
                        className="attachment-file-input"
                        id="conapina-record-file"
                        name="conapinaRecordFile"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={isSaving}
                        onChange={(event) => {
                          updateAttachment('conapinaRecord', event.target.files?.[0])
                          event.currentTarget.value = ''
                        }}
                      />
                      <label htmlFor="conapina-record-file">
                        {attachments.conapinaRecord
                          ? 'Reemplazar archivo'
                          : 'Seleccionar archivo'}
                      </label>
                      <span title={attachments.conapinaRecord?.name}>
                        {attachments.conapinaRecord ? (
                          <>
                            {attachments.conapinaRecord.name}
                            <small>{formatFileSize(attachments.conapinaRecord.size)}</small>
                          </>
                        ) : (
                          'Ningún archivo seleccionado'
                        )}
                      </span>
                      {attachments.conapinaRecord && (
                        <button
                          className="attachment-remove-button"
                          type="button"
                          onClick={() => removeAttachment('conapinaRecord')}
                          disabled={isSaving}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    {attachmentErrors.conapinaRecord && (
                      <p className="attachment-error" role="alert">
                        {attachmentErrors.conapinaRecord}
                      </p>
                    )}
                  </article>
                </div>
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-3-panel"
              role="tabpanel"
              aria-labelledby="donation-section-3-tab"
              hidden={activeSection !== 3}
            >
              <div className="donation-section-heading">
                <span>Sección 3</span>
                <h3 id="agreement-title">Documento de acuerdo de donación</h3>
              </div>

              <div className="supporting-documents">
                <div className="supporting-documents-heading">
                  <div>
                    <span>Documento de la Sección 3</span>
                    <h4>Acuerdo de Donación</h4>
                    <p>El archivo seleccionado se cargará al guardar el borrador.</p>
                  </div>
                  <strong>
                    {attachments.donationAgreement
                      ? 'Documento seleccionado'
                      : 'Sin documento seleccionado'}
                  </strong>
                </div>

                <div className="attachment-grid attachment-grid--single">
                  <article className="attachment-card">
                    <div className="attachment-card-heading">
                      <div className="attachment-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M6 2h8l5 5v15H6V2Zm2 2v16h9V8h-4V4H8Zm7 1.4V6h.6L15 5.4ZM10 11h5v2h-5v-2Zm0 4h5v2h-5v-2Z" />
                        </svg>
                      </div>
                      <div>
                        <h5>Acuerdo de Donación</h5>
                        <p>Documento de acuerdo asociado al donativo</p>
                      </div>
                    </div>
                    <div className="attachment-picker">
                      <input
                        className="attachment-file-input"
                        id="donation-agreement-file"
                        name="donationAgreementFile"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={isSaving}
                        onChange={(event) => {
                          updateAttachment('donationAgreement', event.target.files?.[0])
                          event.currentTarget.value = ''
                        }}
                      />
                      <label htmlFor="donation-agreement-file">
                        {attachments.donationAgreement
                          ? 'Reemplazar archivo'
                          : 'Seleccionar archivo'}
                      </label>
                      <span title={attachments.donationAgreement?.name}>
                        {attachments.donationAgreement ? (
                          <>
                            {attachments.donationAgreement.name}
                            <small>{formatFileSize(attachments.donationAgreement.size)}</small>
                          </>
                        ) : (
                          'Ningún archivo seleccionado'
                        )}
                      </span>
                      {attachments.donationAgreement && (
                        <button
                          className="attachment-remove-button"
                          type="button"
                          onClick={() => removeAttachment('donationAgreement')}
                          disabled={isSaving}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    {attachmentErrors.donationAgreement && (
                      <p className="attachment-error" role="alert">
                        {attachmentErrors.donationAgreement}
                      </p>
                    )}
                  </article>
                </div>
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-4-panel"
              role="tabpanel"
              aria-labelledby="donation-section-4-tab"
              hidden={activeSection !== 4}
            >
              <div className="donation-section-heading">
                <span>Sección 4</span>
                <h3 id="receipt-title">Comprobante de donación</h3>
              </div>

              <div className="donation-fields-grid">
                <div className="donation-field">
                  <label htmlFor="receipt-number">N° de Comprobante</label>
                  <input
                    id="receipt-number"
                    type="text"
                    maxLength={200}
                    value={form.numeroComprobante}
                    onChange={(event) => updateField('numeroComprobante', event.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="donation-field">
                  <label htmlFor="receipt-date">Fecha de comprobante</label>
                  <DatePicker
                    id="receipt-date"
                    value={form.fechaComprobante}
                    onChange={(value) => updateField('fechaComprobante', value)}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="supporting-documents">
                <div className="supporting-documents-heading">
                  <div>
                    <span>Documento de la Sección 4</span>
                    <h4>Comprobante emitido por Gerencia Financiera</h4>
                    <p>El archivo seleccionado se cargará al guardar el borrador.</p>
                  </div>
                  <strong>
                    {attachments.financialReceipt
                      ? 'Documento seleccionado'
                      : 'Sin documento seleccionado'}
                  </strong>
                </div>

                <div className="attachment-grid attachment-grid--single">
                  <article className="attachment-card">
                    <div className="attachment-card-heading">
                      <div className="attachment-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M6 2h8l5 5v15H6V2Zm2 2v16h9V8h-4V4H8Zm7 1.4V6h.6L15 5.4ZM10 11h5v2h-5v-2Zm0 4h5v2h-5v-2Z" />
                        </svg>
                      </div>
                      <div>
                        <h5>Comprobante emitido por Gerencia Financiera</h5>
                        <p>PDF, DOC o DOCX, máximo 10 MB</p>
                      </div>
                    </div>
                    <div className="attachment-picker">
                      <input
                        className="attachment-file-input"
                        id="financial-receipt-file"
                        name="financialReceiptFile"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={isSaving}
                        onChange={(event) => {
                          updateAttachment('financialReceipt', event.target.files?.[0])
                          event.currentTarget.value = ''
                        }}
                      />
                      <label htmlFor="financial-receipt-file">
                        {attachments.financialReceipt
                          ? 'Reemplazar archivo'
                          : 'Seleccionar archivo'}
                      </label>
                      <span title={attachments.financialReceipt?.name}>
                        {attachments.financialReceipt ? (
                          <>
                            {attachments.financialReceipt.name}
                            <small>{formatFileSize(attachments.financialReceipt.size)}</small>
                          </>
                        ) : (
                          'Ningún archivo seleccionado'
                        )}
                      </span>
                      {attachments.financialReceipt && (
                        <button
                          className="attachment-remove-button"
                          type="button"
                          onClick={() => removeAttachment('financialReceipt')}
                          disabled={isSaving}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    {attachmentErrors.financialReceipt && (
                      <p className="attachment-error" role="alert">
                        {attachmentErrors.financialReceipt}
                      </p>
                    )}
                  </article>
                </div>
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-5-panel"
              role="tabpanel"
              aria-labelledby="donation-section-5-tab"
              hidden={activeSection !== 5}
            >
              <div className="donation-section-heading">
                <span>Sección 5</span>
                <h3 id="safekeeping-title">Resguardo y distribución</h3>
              </div>

              <div className="donation-fields-grid">
                <div className="donation-field">
                  <label htmlFor="safekeeping-warehouse">Almacén de Resguardo de donativo</label>
                  <FormSelect
                    id="safekeeping-warehouse"
                    value={form.almacenResguardo}
                    options={safekeepingWarehouses.map((item) => ({
                      value: item.id,
                      label: item.nombre,
                    }))}
                    onChange={(value) => updateField('almacenResguardo', value)}
                    placeholder="Seleccione un almacén"
                    disabled={isSaving}
                    loading={isSafekeepingWarehousesLoading}
                    error={safekeepingWarehousesError}
                    onRetry={() => void loadSafekeepingWarehouses()}
                  />
                </div>
                <div className="donation-field">
                  <label htmlFor="distribution-place">Lugar de distribución</label>
                  <FormMultiSelect
                    id="distribution-place"
                    values={form.lugarDistribucion}
                    options={distributionPlaces.map((item) => ({
                      value: item.id,
                      label: item.nombre,
                    }))}
                    onChange={updateDistributionPlaces}
                    disabled={isSaving}
                    loading={isDistributionPlacesLoading}
                    error={distributionPlacesError}
                    onRetry={() => void loadDistributionPlaces()}
                  />
                </div>
                <div className="donation-field">
                  <label htmlFor="financial-report-date">Fecha reporte financiero</label>
                  <DatePicker
                    id="financial-report-date"
                    value={form.fechaReporteFinanciero}
                    onChange={(value) => updateField('fechaReporteFinanciero', value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="donation-field">
                  <label htmlFor="destination-warehouse">Almacén destino</label>
                  <FormSelect
                    id="destination-warehouse"
                    value={form.almacenDestino}
                    options={destinationWarehouses.map((item) => ({
                      value: item.id,
                      label: item.nombre,
                    }))}
                    onChange={(value) => updateField('almacenDestino', value)}
                    placeholder="Seleccione un almacén"
                    disabled={isSaving}
                    loading={isDestinationWarehousesLoading}
                    error={destinationWarehousesError}
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
                disabled={isSaving}
              />
            </section>

            <section
              className="donation-form-section"
              id="donation-section-7-panel"
              role="tabpanel"
              aria-labelledby="donation-section-7-tab"
              hidden={activeSection !== 7}
            >
              <div className="donation-section-heading">
                <span>Sección 7</span>
                <h3 id="record-documentation-title">Documentación de Acta</h3>
              </div>

              <div className="donation-fields-grid">
                <div className="donation-field donation-field--wide">
                  <label htmlFor="record-framework">Marco del acta</label>
                  <textarea id="record-framework" rows={3} maxLength={5000} value={form.marcoActa} onChange={(event) => updateField('marcoActa', event.target.value)} disabled={isSaving} />
                </div>
                <div className="donation-field donation-field--wide">
                  <label htmlFor="record-objective">Objetivo del acta</label>
                  <textarea id="record-objective" rows={3} maxLength={5000} value={form.objetivoActa} onChange={(event) => updateField('objetivoActa', event.target.value)} disabled={isSaving} />
                </div>
                <div className="donation-field donation-field--wide">
                  <label htmlFor="record-delivered">Entregados en acta</label>
                  <textarea id="record-delivered" rows={3} maxLength={5000} value={form.entregadosActa} onChange={(event) => updateField('entregadosActa', event.target.value)} disabled={isSaving} />
                </div>
                <div className="donation-field donation-field--wide">
                  <label htmlFor="record-delivery">Entrega del acta</label>
                  <textarea id="record-delivery" rows={3} maxLength={5000} value={form.entregaActa} onChange={(event) => updateField('entregaActa', event.target.value)} disabled={isSaving} />
                </div>
                <div className="donation-field">
                  <label htmlFor="record-city">Ciudad</label>
                  <FormSelect
                    id="record-city"
                    value={form.ciudad}
                    options={cities.map((item) => ({ value: item.id, label: item.ciudad }))}
                    onChange={(value) => updateField('ciudad', value)}
                    placeholder="Seleccione una ciudad"
                    disabled={isSaving}
                    loading={isCitiesLoading}
                    error={citiesError}
                    onRetry={() => void loadCities()}
                  />
                </div>
                <div className="donation-field">
                  <label htmlFor="record-department">Departamento</label>
                  <input id="record-department" type="text" value={selectedCity?.departamento ?? ''} readOnly />
                </div>
                <div className="donation-field donation-field--wide">
                  <label htmlFor="observaciones">Observaciones</label>
                  <textarea
                    id="observaciones"
                    name="observaciones"
                    value={form.observaciones}
                    onChange={(event) => updateField('observaciones', event.target.value)}
                    placeholder="Ingrese observaciones adicionales"
                    rows={3}
                  />
                </div>
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-8-panel"
              role="tabpanel"
              aria-labelledby="donation-section-8-tab"
              hidden={activeSection !== 8}
            >
              <div className="donation-section-heading">
                <span>Sección 8</span>
                <h3 id="donor-info-title">Información del Donante o Representante</h3>
              </div>

              <div className="donation-fields-grid">
                <div className="donation-field">
                  <label htmlFor="donor-name">Nombre del donante o representante</label>
                  <input id="donor-name" type="text" maxLength={300} value={form.nombreDonante} onChange={(event) => updateField('nombreDonante', event.target.value)} disabled={isSaving} />
                </div>
                <div className="donation-field">
                  <label htmlFor="donor-position">Cargo</label>
                  <input id="donor-position" type="text" maxLength={300} value={form.cargoDonante} onChange={(event) => updateField('cargoDonante', event.target.value)} disabled={isSaving} />
                </div>
                <div className="donation-field">
                  <label htmlFor="donor-entity">Nombre de la entidad</label>
                  <input id="donor-entity" type="text" maxLength={500} value={form.nombreEntidad} onChange={(event) => updateField('nombreEntidad', event.target.value)} disabled={isSaving} />
                </div>
                <div className="donation-field">
                  <label htmlFor="donor-dui">DUI del donante</label>
                  <input
                    id="donor-dui"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="00000000-0"
                    value={form.duiDonante}
                    onChange={(event) => updateField('duiDonante', formatDui(event.target.value))}
                    disabled={isSaving}
                    aria-invalid={Boolean(errors.duiDonante)}
                    aria-describedby={errors.duiDonante ? 'donor-dui-error' : undefined}
                  />
                  {errors.duiDonante && <p className="donation-field-error" id="donor-dui-error" role="alert">{errors.duiDonante}</p>}
                </div>
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-9-panel"
              role="tabpanel"
              aria-labelledby="donation-section-9-tab"
              hidden={activeSection !== 9}
            >
              <div className="donation-section-heading">
                <span>Sección 9</span>
                <h3 id="reception-manager-title">Encargado de Recepción CONAPINA</h3>
              </div>

              <div className="donation-fields-grid">
                <div className="donation-field">
                  <label htmlFor="reception-manager-name">Nombre del encargado</label>
                  <FormSelect
                    id="reception-manager-name"
                    value={form.encargadoPersonalId}
                    options={receptionManagers.map((manager) => ({
                      value: manager.id,
                      label: manager.nombre,
                    }))}
                    onChange={(value) => updateField('encargadoPersonalId', value)}
                    placeholder="Buscar encargado..."
                    searchable
                    disabled={isSaving}
                    loading={isReceptionManagersLoading}
                    error={receptionManagersError}
                    onRetry={() => void loadReceptionManagers()}
                  />
                </div>
                <div className="donation-field">
                  <label htmlFor="reception-manager-position">Cargo del encargado</label>
                  <input id="reception-manager-position" type="text" value={selectedReceptionManager?.cargo ?? ''} readOnly />
                </div>
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-10-panel"
              role="tabpanel"
              aria-labelledby="donation-section-10-tab"
              hidden={activeSection !== 10}
            >
              <div className="donation-section-heading">
                <span>Sección 10</span>
                <h3 id="photo-record-title">Registro fotográfico</h3>
              </div>

              <div className="attachment-grid photo-attachment-grid">
                {photoAttachmentSlots.map(({ field, title }) => {
                  const file = attachments[field]
                  return (
                    <article className="attachment-card photo-attachment-card" key={field}>
                      <div className="attachment-card-heading">
                        <div className="attachment-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M4 5h4l1.5-2h5L16 5h4v16H4V5Zm2 2v12h12V7h-3l-1.5-2h-3L9 7H6Zm6 2.5A3.5 3.5 0 1 1 12 16.5 3.5 3.5 0 0 1 12 9.5Zm0 2A1.5 1.5 0 1 0 12 14.5 1.5 1.5 0 0 0 12 11.5Z" />
                          </svg>
                        </div>
                        <div>
                          <h5>{title}</h5>
                          <p>{file ? `${file.name} · ${formatFileSize(file.size)}` : 'Sin fotografía'}</p>
                        </div>
                      </div>

                      {file && <LocalImagePreview file={file} />}

                      <div className="attachment-picker">
                        <input
                          className="attachment-file-input"
                          id={`${field}-file`}
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          disabled={isSaving}
                          onChange={(event) => {
                            updateAttachment(field, event.target.files?.[0])
                            event.currentTarget.value = ''
                          }}
                        />
                        <label htmlFor={`${field}-file`}>
                          {file ? 'Reemplazar imagen' : 'Seleccionar imagen'}
                        </label>
                        <span>{file?.name ?? 'Ninguna imagen seleccionada'}</span>
                        {file && (
                          <button
                            className="attachment-remove-button"
                            type="button"
                            onClick={() => removeAttachment(field)}
                            disabled={isSaving}
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      {attachmentErrors[field] && (
                        <p className="attachment-error" role="alert">{attachmentErrors[field]}</p>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>

            <section
              className="donation-form-section"
              id="donation-section-11-panel"
              role="tabpanel"
              aria-labelledby="donation-section-11-tab"
              hidden={activeSection !== 11}
            >
              <div className="donation-section-heading">
                <span>Sección 11</span>
                <h3>Actas de recepción</h3>
              </div>
              <p className="detail-modal-state">
                Las actas estarán disponibles después de guardar el donativo y registrar sus recepciones.
              </p>
            </section>

            <div
              className={`donation-form-message${
                statusType === 'error' ? ' donation-form-message--error' : ''
              }`}
              role={statusType === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {statusMessage}
            </div>
          </div>
        </div>

        <footer className="monetary-folder-actions donation-registration-actions">
          <p>Los datos se conservarán mientras permanezca en este formulario.</p>
          <div>
            <button
              className="modal-secondary-button"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Volver
            </button>
            {hasPreviousSection && (
              <button
                className="modal-secondary-button"
                type="button"
                onClick={goToPreviousSection}
                disabled={isSaving}
              >
                Anterior
              </button>
            )}
            {hasNextSection ? (
              <button
                className="modal-primary-button"
                type="button"
                onClick={goToNextSection}
                disabled={isSaving}
              >
                Siguiente
              </button>
            ) : (
              <button className="modal-primary-button" type="submit" disabled={isSaving}>
                {isSaving
                  ? 'Guardando...'
                  : createdDonationId
                    ? 'Reintentar documentos'
                    : 'Guardar borrador'}
              </button>
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

export default DonationDraftModal
