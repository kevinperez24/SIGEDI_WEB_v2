import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react'
import {
  createDonation,
  DonationSaveError,
  uploadDonationDocument,
} from '../services/donations'
import type { DonationDocumentType } from '../services/donations'
import './DonationDraftModal.css'

type DonationDraftModalProps = {
  creatorName: string
  authToken: string
  onClose: () => void
  onSaved: () => void
}

type DonationForm = {
  tipoRegistro: string
  nombreDonativo: string
  tipoGestion: string
  departamentoSeccion: string
  fechaRecepcion: string
  lugarRecepcion: string
  observaciones: string
}

type RequiredField =
  | 'tipoRegistro'
  | 'nombreDonativo'
  | 'tipoGestion'
  | 'fechaRecepcion'
  | 'lugarRecepcion'

type FormErrors = Partial<Record<RequiredField, string>>

type AttachmentField = 'initialRecord' | 'executiveAuthorization'
type Attachments = Record<AttachmentField, File | null>

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const allowedAttachmentExtensions = new Set(['.pdf', '.doc', '.docx'])

const attachmentDocumentTypes: Record<AttachmentField, DonationDocumentType> = {
  initialRecord: 'MEMO_INICIAL',
  executiveAuthorization: 'MEMO_DE',
}

const initialAttachments: Attachments = {
  initialRecord: null,
  executiveAuthorization: null,
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

const receptionPlaceOptions = [
  'Sede central CONAPINA',
  'Dependencia institucional',
  'Otro lugar de recepción',
]

const initialForm: DonationForm = {
  tipoRegistro: '',
  nombreDonativo: '',
  tipoGestion: '',
  departamentoSeccion: '',
  fechaRecepcion: '',
  lugarRecepcion: '',
  observaciones: '',
}

function DonationDraftModal({
  creatorName,
  authToken,
  onClose,
  onSaved,
}: DonationDraftModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstFieldRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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

  const updateField = (field: keyof DonationForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setStatusMessage('')
    setStatusType(null)

    if (
      (field === 'tipoRegistro' ||
        field === 'nombreDonativo' ||
        field === 'tipoGestion' ||
        field === 'fechaRecepcion' ||
        field === 'lugarRecepcion') &&
      value.trim()
    ) {
      setErrors((current) => ({ ...current, [field]: undefined }))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving) return

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

    if (!form.lugarRecepcion.trim()) {
      nextErrors.lugarRecepcion = 'Debe seleccionar el lugar de recepción.'
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
          },
          authToken,
        )
        donationId = createdDonation.id
        setCreatedDonationId(donationId)
        onSaved()
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
        return
      }

      setStatusMessage(
        documentsToUpload.length > 0
          ? 'Donación y documentos guardados correctamente.'
          : 'Donación guardada correctamente.',
      )
      setStatusType('success')
      setForm(initialForm)
      setAttachments(initialAttachments)
      setCreatedDonationId(null)
      await new Promise((resolve) => window.setTimeout(resolve, 700))
      onClose()
    } catch (error) {
      setStatusMessage(
        error instanceof DonationSaveError
          ? error.message
          : 'No fue posible guardar la donación en este momento.',
      )
      setStatusType('error')
    } finally {
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

  const selectedAttachmentCount = Object.values(attachments).filter(Boolean).length

  return (
    <div className="donation-modal-overlay" role="presentation">
      <div
        className="donation-modal"
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
                  <select
                    id="tipo-gestion"
                    name="tipoGestion"
                    value={form.tipoGestion}
                    onChange={(event) => updateField('tipoGestion', event.target.value)}
                    required
                    aria-invalid={Boolean(errors.tipoGestion)}
                    aria-describedby={errors.tipoGestion ? 'tipo-gestion-error' : undefined}
                  >
                    <option value="">Seleccione una opción</option>
                    {managementTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
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
                  <input
                    id="fecha-recepcion"
                    name="fechaRecepcion"
                    type="date"
                    value={form.fechaRecepcion}
                    onChange={(event) => updateField('fechaRecepcion', event.target.value)}
                    required
                    aria-invalid={Boolean(errors.fechaRecepcion)}
                    aria-describedby={errors.fechaRecepcion ? 'fecha-recepcion-error' : undefined}
                  />
                  {errors.fechaRecepcion && (
                    <p className="donation-field-error" id="fecha-recepcion-error" role="alert">
                      {errors.fechaRecepcion}
                    </p>
                  )}
                </div>

                <div className="donation-field">
                  <label htmlFor="lugar-recepcion">Lugar de recepción</label>
                  <select
                    id="lugar-recepcion"
                    name="lugarRecepcion"
                    value={form.lugarRecepcion}
                    onChange={(event) => updateField('lugarRecepcion', event.target.value)}
                    required
                    aria-invalid={Boolean(errors.lugarRecepcion)}
                    aria-describedby={errors.lugarRecepcion ? 'lugar-recepcion-error' : undefined}
                  >
                    <option value="">Seleccione una opción</option>
                    {receptionPlaceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
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
