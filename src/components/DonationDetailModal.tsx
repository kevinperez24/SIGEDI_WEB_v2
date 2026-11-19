import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  deleteDonationDocument,
  getDonationDetail,
  getDonationDocument,
  updateDonation,
  uploadDonationDocument,
} from '../services/donations'
import type {
  DonationDetail,
  DonationDocumentItem,
  DonationDocumentType,
  DonationDraftInput,
} from '../services/donations'
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

const receptionPlaces = [
  'Sede central CONAPINA',
  'Dependencia institucional',
  'Otro lugar de recepción',
]

const documentSlots: { type: DonationDocumentType; title: string }[] = [
  { type: 'MEMO_INICIAL', title: 'Memorándum de registro inicial' },
  { type: 'MEMO_DE', title: 'Memorándum de autorización de Dirección Ejecutiva' },
]

function toForm(detail: DonationDetail): DonationDraftInput {
  return {
    tipo_registro: detail.tipo_registro,
    nombre_proyecto: detail.nombre_proyecto,
    tipo_gestion: detail.tipo_gestion,
    dpto_seccion: detail.dpto_seccion ?? '',
    fecha_recepcion: detail.fecha_recepcion.slice(0, 10),
    lugar_recepcion: detail.lugar_recepcion,
    observaciones: detail.observaciones ?? '',
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
  const [form, setForm] = useState<DonationDraftInput | null>(null)
  const [pendingDocuments, setPendingDocuments] = useState<
    Partial<Record<DonationDocumentType, File>>
  >({})
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)

  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    setMessage('')
    setHasError(false)
    try {
      const result = await getDonationDetail(donationId, authToken)
      setDetail(result.donativo)
      setDocuments(result.documentos)
      setForm(toForm(result.donativo))
    } catch {
      setHasError(true)
      setMessage('No fue posible cargar el donativo.')
    } finally {
      setIsLoading(false)
    }
  }, [authToken, donationId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isSaving, onClose])

  const setField = (field: keyof DonationDraftInput, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current))
  }

  const cancelEditing = () => {
    if (detail) setForm(toForm(detail))
    setPendingDocuments({})
    setMessage('')
    setHasError(false)
    setIsEditing(false)
  }

  const startEditing = () => {
    setMessage('')
    setHasError(false)
    setIsEditing(true)
  }

  const selectDocument = (type: DonationDocumentType, file?: File) => {
    if (!file) return
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : ''
    if (!['.pdf', '.doc', '.docx'].includes(extension) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setHasError(true)
      setMessage('Seleccione un archivo PDF, DOC o DOCX de hasta 10 MB.')
      return
    }
    setPendingDocuments((current) => ({ ...current, [type]: file }))
    setMessage('')
    setHasError(false)
  }

  const saveChanges = async (event: FormEvent) => {
    event.preventDefault()
    if (!isEditing || !form || isSaving) return
    if (
      !form.tipo_registro.trim() ||
      !form.nombre_proyecto.trim() ||
      !form.tipo_gestion ||
      !form.fecha_recepcion ||
      !form.lugar_recepcion
    ) {
      setHasError(true)
      setMessage('Revise los campos requeridos antes de continuar.')
      return
    }

    setIsSaving(true)
    setMessage('')
    setHasError(false)
    try {
      await updateDonation(donationId, form, authToken)
      for (const [type, file] of Object.entries(pendingDocuments) as [
        DonationDocumentType,
        File,
      ][]) {
        await uploadDonationDocument(donationId, type, file, authToken)
      }
      await loadDetail()
      setPendingDocuments({})
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
    const previewWindow =
      document.mime_type === 'application/pdf' ? window.open('about:blank', '_blank') : null
    if (previewWindow) previewWindow.opener = null
    try {
      const blob = await getDonationDocument(donationId, document.id, authToken)
      const url = URL.createObjectURL(blob)
      if (document.mime_type === 'application/pdf') {
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
        `¿Eliminar lógicamente ${document.nombre_archivo}? El archivo se conservará, pero el índice actual impedirá agregar otro del mismo tipo hasta ajustar el esquema.`,
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

  return (
    <div className="donation-modal-overlay" role="presentation">
      <div className="donation-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <header className="donation-modal-header">
          <div>
            <h2 id="detail-title">Consultar donación</h2>
            <p>Sistema de Gestión de Donaciones Institucionales — CONAPINA</p>
          </div>
          <div className="donation-modal-header-actions">
            {!isEditing && (
              <button
                className="detail-edit-button"
                type="button"
                onClick={startEditing}
                disabled={!detail || isSaving}
              >
                Editar
              </button>
            )}
            <button className="donation-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" /></svg>
            </button>
          </div>
        </header>

        <form className="donation-modal-form" onSubmit={saveChanges}>
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

                <section className="donation-form-section">
                  <div className="donation-section-heading"><span>Sección 1</span><h3>Información general del donativo</h3></div>
                  <div className="donation-fields-grid">
                    <div className="donation-field"><label>Tipo de registro *</label><input value={form.tipo_registro} onChange={(event) => setField('tipo_registro', event.target.value)} disabled={!isEditing} /></div>
                    <div className="donation-field"><label>Estado</label><input value={detail.estado} readOnly /></div>
                    <div className="donation-field donation-field--wide"><label>Nombre del proyecto / donativo *</label><input value={form.nombre_proyecto} onChange={(event) => setField('nombre_proyecto', event.target.value)} disabled={!isEditing} /></div>
                    <div className="donation-field"><label>Tipo de gestión *</label><select value={form.tipo_gestion} onChange={(event) => setField('tipo_gestion', event.target.value)} disabled={!isEditing}><option value="">Seleccione una opción</option>{managementTypes.map((value) => <option key={value}>{value}</option>)}</select></div>
                    <div className="donation-field"><label>Departamento / Sección / Otros</label><input value={form.dpto_seccion} onChange={(event) => setField('dpto_seccion', event.target.value)} disabled={!isEditing} /></div>
                    <div className="donation-field"><label>Fecha de recepción *</label><input type="date" value={form.fecha_recepcion} onChange={(event) => setField('fecha_recepcion', event.target.value)} disabled={!isEditing} /></div>
                    <div className="donation-field"><label>Lugar de recepción *</label><select value={form.lugar_recepcion} onChange={(event) => setField('lugar_recepcion', event.target.value)} disabled={!isEditing}><option value="">Seleccione una opción</option>{receptionPlaces.map((value) => <option key={value}>{value}</option>)}</select></div>
                    <div className="donation-field donation-field--wide"><label>Observaciones</label><textarea rows={3} value={form.observaciones} onChange={(event) => setField('observaciones', event.target.value)} disabled={!isEditing} /></div>
                  </div>

                  <div className="supporting-documents">
                    <div className="supporting-documents-heading"><div><span>Sub-Sección 1.2</span><h4>Memorándums</h4><p>Documentos activos asociados al donativo.</p></div><strong>{documents.length} activos</strong></div>
                    <div className="attachment-grid">
                      {documentSlots.map((slot) => {
                        const document = documents.find((item) => item.tipo_documento === slot.type)
                        const pending = pendingDocuments[slot.type]
                        return (
                          <article className="attachment-card" key={slot.type}>
                            <div className="attachment-card-heading"><div className="attachment-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6V2Zm2 2v16h9V8h-4V4H8Zm7 1.4V6h.6L15 5.4ZM10 11h5v2h-5v-2Zm0 4h5v2h-5v-2Z" /></svg></div><div><h5>{slot.title}</h5><p>{document ? `${document.nombre_archivo} · ${formatBytes(document.size_bytes)}` : pending ? `${pending.name} · ${formatBytes(pending.size)}` : 'Sin documento'}</p></div></div>
                            {document ? (
                              <div className="document-actions"><button type="button" onClick={() => void viewDocument(document)}>Ver</button>{isEditing && <><button type="button" disabled title="Requiere ajustar el índice UNIQUE para conservar historial">Reemplazar</button><button className="document-action--danger" type="button" onClick={() => void removeDocument(document)}>Eliminar</button></>}</div>
                            ) : isEditing ? (
                              <div className="attachment-picker"><input className="attachment-file-input" id={`detail-${slot.type}`} type="file" accept=".pdf,.doc,.docx" onChange={(event) => { selectDocument(slot.type, event.target.files?.[0]); event.currentTarget.value = '' }} /><label htmlFor={`detail-${slot.type}`}>{pending ? 'Reemplazar selección' : 'Seleccionar archivo'}</label><span>{pending?.name ?? 'Ningún archivo seleccionado'}</span></div>
                            ) : <p className="document-empty-copy">Sin documento</p>}
                          </article>
                        )
                      })}
                    </div>
                  </div>
                </section>
              </>
            )}
            {detail && <div className={`donation-form-message${hasError ? ' donation-form-message--error' : ''}`} role={hasError ? 'alert' : 'status'}>{message}</div>}
          </div>

          {isEditing && (
            <footer className="donation-modal-footer">
              <button className="modal-secondary-button" type="button" onClick={cancelEditing} disabled={isSaving}>Cancelar edición</button>
              <button className="modal-primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar cambios'}</button>
            </footer>
          )}
        </form>
      </div>
    </div>
  )
}

export default DonationDetailModal
