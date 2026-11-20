import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  createDonation,
  DonationSaveError,
  getReceptionPlaces,
  getUpcRepresentatives,
  uploadDonationDocument,
} from '../services/donations'
import type {
  DonationDocumentType,
  ReceptionPlace,
  UpcRepresentative,
} from '../services/donations'
import DatePicker from './form/DatePicker'
import FormMultiSelect from './form/FormMultiSelect'
import FormSelect from './form/FormSelect'
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
}

type RequiredField =
  | 'tipoRegistro'
  | 'nombreDonativo'
  | 'tipoGestion'
  | 'fechaRecepcion'
  | 'lugarRecepcion'

type FormErrors = Partial<Record<RequiredField, string>>
type StringFormField = Exclude<keyof DonationForm, 'lugarRecepcion'>

type AttachmentField =
  | 'initialRecord'
  | 'executiveAuthorization'
  | 'conapinaRecord'
  | 'donationAgreement'
type Attachments = Record<AttachmentField, File | null>

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const allowedAttachmentExtensions = new Set(['.pdf', '.doc', '.docx'])

const attachmentDocumentTypes: Record<AttachmentField, DonationDocumentType> = {
  initialRecord: 'MEMO_INICIAL',
  executiveAuthorization: 'MEMO_DE',
  conapinaRecord: 'ACTA_CONAPINA',
  donationAgreement: 'ACUERDO_DONACION',
}

const initialAttachments: Attachments = {
  initialRecord: null,
  executiveAuthorization: null,
  conapinaRecord: null,
  donationAgreement: null,
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
}

function DonationDraftModal({
  creatorName,
  authToken,
  onClose,
  onSaved,
}: DonationDraftModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const operationLockedRef = useRef(false)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
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

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstFieldRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !operationLockedRef.current) {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus()
    }
  }, [onClose])

  const handleFocusTrap = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    )

    if (!focusableElements?.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

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
  }

  const updateReceptionPlaces = (values: string[]) => {
    setForm((current) => ({ ...current, lugarRecepcion: values }))
    setStatusMessage('')
    setStatusType(null)
    if (values.length > 0) {
      setErrors((current) => ({ ...current, lugarRecepcion: undefined }))
    }
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

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      setStatusMessage('Revise los campos requeridos antes de continuar.')
      setStatusType('error')
      return
    }

    if (Object.values(attachmentErrors).some(Boolean)) {
      setStatusMessage('Revise los documentos seleccionados antes de continuar.')
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
          },
          authToken,
        )
        donationId = createdDonation.id
        setCreatedDonationId(donationId)
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
      setIsClosing(true)
      const closingDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : 180
      await new Promise((resolve) => window.setTimeout(resolve, closingDelay))
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

    if (!allowedAttachmentExtensions.has(actualExtension)) {
      errorMessage = 'Seleccione un archivo PDF, DOC o DOCX válido.'
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

  return (
    <div
      className={`donation-modal-overlay${
        isClosing ? ' donation-modal-overlay--closing' : ''
      }`}
      role="presentation"
    >
      <div
        className={`donation-modal${isClosing ? ' donation-modal--closing' : ''}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-modal-title"
        aria-describedby="donation-modal-description"
        onKeyDown={handleFocusTrap}
      >
        <header className="donation-modal-header">
          <div>
            <h2 id="donation-modal-title">Registrar nueva donación</h2>
            <p id="donation-modal-description">
              Sistema de Gestión de Donaciones Institucionales — CONAPINA
            </p>
          </div>
          <button
            className="donation-modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar formulario de donación"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
            </svg>
          </button>
        </header>

        <form className="donation-modal-form" onSubmit={handleSubmit} noValidate>
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

            <section className="donation-form-section" aria-labelledby="general-info-title">
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
                    ref={firstFieldRef}
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

            <section className="donation-form-section" aria-labelledby="upc-info-title">
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

            <section className="donation-form-section" aria-labelledby="agreement-title">
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

          <footer className="donation-modal-footer">
            <button
              className="modal-secondary-button"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button className="modal-primary-button" type="submit" disabled={isSaving}>
              {isSaving
                ? 'Guardando...'
                : createdDonationId
                  ? 'Reintentar documentos'
                  : 'Guardar borrador'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default DonationDraftModal
