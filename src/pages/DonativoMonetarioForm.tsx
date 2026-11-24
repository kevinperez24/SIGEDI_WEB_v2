import { useCallback, useEffect, useState } from 'react'
import DatePicker from '../components/form/DatePicker'
import FormSelect from '../components/form/FormSelect'
import {
  getConapinaReceptionManagers,
  getCities,
  getUpcRepresentatives,
  type CityCatalogItem,
  type ConapinaReceptionManager,
  type UpcRepresentative,
} from '../services/donations'
import './DonativoMonetarioForm.css'

type DonativoMonetarioFormProps = {
  authToken: string
  onBack: () => void
}

type MonetaryPhotoSlot = 'photo1' | 'photo2'
type MonetaryPhotos = Record<MonetaryPhotoSlot, File | null>

const managementTypes = [
  'En el marco de un proyecto',
  'Ofrecimiento',
  'Solicitud',
  'Asistencia Humanitaria',
] as const

const paymentMethods = ['Transferencia', 'Cheque'] as const
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const allowedPhotoExtensions = new Set(['.jpg', '.jpeg', '.png'])
const allowedPhotoMimeTypes = new Set(['image/jpeg', 'image/png'])

const duiPattern = /^\d{8}-\d$/

function formatDui(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  return digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits
}

function validatePhoto(file: File): string {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!allowedPhotoExtensions.has(extension) || !allowedPhotoMimeTypes.has(file.type)) {
    return 'Seleccione una imagen JPG, JPEG o PNG.'
  }
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return 'La imagen debe tener un tamaño máximo de 10 MB.'
  }
  return ''
}

function formatPhotoSize(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

function MonetaryPhotoPreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return previewUrl ? (
    <img
      className="monetary-photo-preview"
      src={previewUrl}
      alt={`Vista previa de ${file.name}`}
    />
  ) : null
}

function DonativoMonetarioForm({ authToken, onBack }: DonativoMonetarioFormProps) {
  const [activeSection, setActiveSection] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [managementType, setManagementType] = useState('')
  const [projectName, setProjectName] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [donationAmount, setDonationAmount] = useState<number | null>(null)
  const [donationAmountDisplay, setDonationAmountDisplay] = useState('')
  const [destinationCenter, setDestinationCenter] = useState('')
  const [objective, setObjective] = useState('')
  const [donorName, setDonorName] = useState('')
  const [donorPosition, setDonorPosition] = useState('')
  const [donorDui, setDonorDui] = useState('')
  const [donorEntity, setDonorEntity] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [donationPurpose, setDonationPurpose] = useState('')
  const [upcRepresentativeId, setUpcRepresentativeId] = useState('')
  const [receptionManagerId, setReceptionManagerId] = useState('')
  const [actFramework, setActFramework] = useState('')
  const [actEntityName, setActEntityName] = useState('')
  const [actDonationObjective, setActDonationObjective] = useState('')
  const [actSuppliesDestination, setActSuppliesDestination] = useState('')
  const [actDistributionResponsible, setActDistributionResponsible] = useState('')
  const [signedAgreementDate, setSignedAgreementDate] = useState('')
  const [actCityId, setActCityId] = useState('')
  const [photos, setPhotos] = useState<MonetaryPhotos>({ photo1: null, photo2: null })
  const [photoErrors, setPhotoErrors] = useState<Partial<Record<MonetaryPhotoSlot, string>>>({})
  const [upcRepresentatives, setUpcRepresentatives] = useState<UpcRepresentative[]>([])
  const [upcRepresentativesLoading, setUpcRepresentativesLoading] = useState(true)
  const [upcRepresentativesError, setUpcRepresentativesError] = useState('')
  const [receptionManagers, setReceptionManagers] = useState<ConapinaReceptionManager[]>([])
  const [receptionManagersLoading, setReceptionManagersLoading] = useState(true)
  const [receptionManagersError, setReceptionManagersError] = useState('')
  const [cities, setCities] = useState<CityCatalogItem[]>([])
  const [citiesLoading, setCitiesLoading] = useState(true)
  const [citiesError, setCitiesError] = useState('')
  const [managementTypeTouched, setManagementTypeTouched] = useState(false)
  const [projectNameTouched, setProjectNameTouched] = useState(false)
  const [donationAmountTouched, setDonationAmountTouched] = useState(false)
  const [donorDuiTouched, setDonorDuiTouched] = useState(false)
  const managementTypeError = managementTypeTouched && !managementType
  const projectNameError = projectNameTouched && !projectName.trim()
  const donationAmountError =
    donationAmountTouched &&
    donationAmountDisplay !== '' &&
    (donationAmount === null || donationAmount <= 0)
  const donorDuiError = donorDuiTouched && donorDui !== '' && !duiPattern.test(donorDui)

  const updateDonationAmount = (value: string) => {
    const sanitized = value.replace(/[^\d.]/g, '')
    const [integerPart = '', ...decimalParts] = sanitized.split('.')
    const normalized =
      decimalParts.length > 0
        ? `${integerPart}.${decimalParts.join('').slice(0, 2)}`
        : integerPart
    const parsed = normalized === '' || normalized === '.' ? null : Number(normalized)
    setDonationAmountDisplay(normalized)
    setDonationAmount(parsed !== null && Number.isFinite(parsed) ? parsed : null)
  }

  const finishDonationAmount = () => {
    setDonationAmountTouched(true)
    if (donationAmount !== null && donationAmount > 0) {
      setDonationAmountDisplay(donationAmount.toFixed(2))
    }
  }

  const loadUpcRepresentatives = useCallback(async () => {
    setUpcRepresentativesLoading(true)
    setUpcRepresentativesError('')
    try {
      setUpcRepresentatives(await getUpcRepresentatives(authToken))
    } catch {
      setUpcRepresentativesError('No fue posible cargar los representantes UPC.')
    } finally {
      setUpcRepresentativesLoading(false)
    }
  }, [authToken])

  const loadReceptionManagers = useCallback(async () => {
    setReceptionManagersLoading(true)
    setReceptionManagersError('')
    try {
      setReceptionManagers(await getConapinaReceptionManagers(authToken))
    } catch {
      setReceptionManagersError('No fue posible cargar los encargados de recepción.')
    } finally {
      setReceptionManagersLoading(false)
    }
  }, [authToken])

  const loadCities = useCallback(async () => {
    setCitiesLoading(true)
    setCitiesError('')
    try {
      setCities(await getCities(authToken))
    } catch {
      setCitiesError('No fue posible cargar las ciudades.')
    } finally {
      setCitiesLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    void loadUpcRepresentatives()
    void loadReceptionManagers()
    void loadCities()
  }, [loadCities, loadReceptionManagers, loadUpcRepresentatives])

  const goToPreviousSection = () => {
    setActiveSection((current) =>
      current === 6 ? 5 : current === 5 ? 4 : current === 4 ? 3 : current === 3 ? 2 : 1,
    )
  }

  const goToNextSection = () => {
    setActiveSection((current) =>
      current === 1 ? 2 : current === 2 ? 3 : current === 3 ? 4 : current === 4 ? 5 : 6,
    )
  }

  const updatePhoto = (slot: MonetaryPhotoSlot, file?: File) => {
    if (!file) return
    const validationError = validatePhoto(file)
    if (validationError) {
      setPhotoErrors((current) => ({ ...current, [slot]: validationError }))
      return
    }
    setPhotos((current) => ({ ...current, [slot]: file }))
    setPhotoErrors((current) => ({ ...current, [slot]: undefined }))
  }

  const removePhoto = (slot: MonetaryPhotoSlot) => {
    setPhotos((current) => ({ ...current, [slot]: null }))
    setPhotoErrors((current) => ({ ...current, [slot]: undefined }))
  }

  return (
    <main
      className="dashboard-main dashboard-view monetary-registration-page"
      id="registro-donativo-monetario"
      key="registro-donativo-monetario"
    >
      <header className="monetary-registration-heading">
        <p>DONATIVOS MONETARIOS</p>
        <h1>Registrar Donación Monetaria</h1>
        <span>Complete la información inicial del registro monetario.</span>
      </header>

      <form className="monetary-folder" onSubmit={(event) => event.preventDefault()} noValidate>
        <div className="monetary-folder-tabs" role="tablist" aria-label="Secciones del formulario">
          <button
            id="monetary-section-one-tab"
            className={activeSection === 1 ? 'is-active' : undefined}
            type="button"
            role="tab"
            aria-selected={activeSection === 1}
            aria-controls="monetary-section-one-panel"
            onClick={() => setActiveSection(1)}
          >
            <span>Sección 1</span>
            Registro de Donación Monetaria
          </button>
          <button
            id="monetary-section-two-tab"
            className={activeSection === 2 ? 'is-active' : undefined}
            type="button"
            role="tab"
            aria-label="Sección 2 · Detalle de Recibo"
            aria-selected={activeSection === 2}
            aria-controls="monetary-section-two-panel"
            onClick={() => setActiveSection(2)}
          >
            <span>Sección 2</span>
            Detalle de Recibo
          </button>
          <button
            id="monetary-section-three-tab"
            className={activeSection === 3 ? 'is-active' : undefined}
            type="button"
            role="tab"
            aria-label="Sección 3 · Información del Donante"
            aria-selected={activeSection === 3}
            aria-controls="monetary-section-three-panel"
            onClick={() => setActiveSection(3)}
          >
            <span>Sección 3</span>
            Información del Donante
          </button>
          <button
            id="monetary-section-four-tab"
            className={activeSection === 4 ? 'is-active' : undefined}
            type="button"
            role="tab"
            aria-label="Sección 4 · Recepción de Donación"
            aria-selected={activeSection === 4}
            aria-controls="monetary-section-four-panel"
            onClick={() => setActiveSection(4)}
          >
            <span>Sección 4</span>
            Recepción de Donación
          </button>
          <button
            id="monetary-section-five-tab"
            className={activeSection === 5 ? 'is-active' : undefined}
            type="button"
            role="tab"
            aria-label="Sección 5 · Acta de Recepción"
            aria-selected={activeSection === 5}
            aria-controls="monetary-section-five-panel"
            onClick={() => setActiveSection(5)}
          >
            <span>Sección 5</span>
            Acta de Recepción
          </button>
          <button
            id="monetary-section-six-tab"
            className={activeSection === 6 ? 'is-active' : undefined}
            type="button"
            role="tab"
            aria-label="Sección 6 · Registro Fotográfico"
            aria-selected={activeSection === 6}
            aria-controls="monetary-section-six-panel"
            onClick={() => setActiveSection(6)}
          >
            <span>Sección 6</span>
            Registro Fotográfico
          </button>
        </div>

        {activeSection === 1 ? (
          <section
            className="monetary-folder-panel"
            id="monetary-section-one-panel"
            key="monetary-section-one-panel"
            role="tabpanel"
            aria-labelledby="monetary-section-one-tab"
          >
            <header className="monetary-folder-panel-heading">
              <div>
                <span>SECCIÓN 1</span>
                <h2>Registro de Donación Monetaria</h2>
              </div>
              <p>Información general para identificar el donativo monetario.</p>
            </header>

            <div className="monetary-fields-grid">
              <div
                className="monetary-field"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setManagementTypeTouched(true)
                  }
                }}
              >
                <label htmlFor="monetary-management-type">
                  Tipo de gestión <span aria-hidden="true">*</span>
                </label>
                <FormSelect
                  id="monetary-management-type"
                  name="tipoGestion"
                  value={managementType}
                  options={managementTypes}
                  onChange={setManagementType}
                  placeholder="Seleccione el tipo de gestión"
                  required
                  ariaInvalid={managementTypeError}
                  ariaDescribedBy={managementTypeError ? 'monetary-management-error' : undefined}
                />
                {managementTypeError && (
                  <p className="monetary-field-error" id="monetary-management-error" role="alert">
                    Debe seleccionar el tipo de gestión.
                  </p>
                )}
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-project-name">
                  Nombre del proyecto <span aria-hidden="true">*</span>
                </label>
                <input
                  id="monetary-project-name"
                  name="nombreProyecto"
                  type="text"
                  value={projectName}
                  placeholder="Ingrese el nombre del proyecto"
                  required
                  aria-invalid={projectNameError || undefined}
                  aria-describedby={projectNameError ? 'monetary-project-error' : undefined}
                  onChange={(event) => setProjectName(event.target.value)}
                  onBlur={() => setProjectNameTouched(true)}
                />
                {projectNameError && (
                  <p className="monetary-field-error" id="monetary-project-error" role="alert">
                    Debe ingresar el nombre del proyecto.
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : activeSection === 2 ? (
          <section
            className="monetary-folder-panel"
            id="monetary-section-two-panel"
            key="monetary-section-two-panel"
            role="tabpanel"
            aria-labelledby="monetary-section-two-tab"
          >
            <header className="monetary-folder-panel-heading">
              <div>
                <span>02 · DETALLE DE RECIBO DE DONACIÓN MONETARIA</span>
                <h2>Detalle de Recibo de Donación Monetaria</h2>
              </div>
              <p>Información de entrega y destino del donativo monetario.</p>
            </header>

            <div className="monetary-fields-grid">
              <div className="monetary-field">
                <label htmlFor="monetary-delivery-location">
                  Se realiza la entrega en las instalaciones de:
                </label>
                <input
                  id="monetary-delivery-location"
                  type="text"
                  value={deliveryLocation}
                  onChange={(event) => setDeliveryLocation(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-delivery-time">Hora de Entrega</label>
                <input
                  id="monetary-delivery-time"
                  type="time"
                  lang="es-SV"
                  step="60"
                  value={deliveryTime}
                  onChange={(event) => setDeliveryTime(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-delivery-date">Fecha de Entrega</label>
                <DatePicker
                  id="monetary-delivery-date"
                  value={deliveryDate}
                  onChange={setDeliveryDate}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-donation-amount">Monto Donación</label>
                <div
                  className={`monetary-currency-control${donationAmountError ? ' is-invalid' : ''}`}
                >
                  <span aria-hidden="true">$</span>
                  <input
                    id="monetary-donation-amount"
                    type="text"
                    inputMode="decimal"
                    value={donationAmountDisplay}
                    placeholder="0.00"
                    aria-invalid={donationAmountError || undefined}
                    aria-describedby={donationAmountError ? 'monetary-amount-error' : undefined}
                    onChange={(event) => updateDonationAmount(event.target.value)}
                    onBlur={finishDonationAmount}
                  />
                </div>
                {donationAmountError && (
                  <p className="monetary-field-error" id="monetary-amount-error" role="alert">
                    El monto debe ser mayor que cero.
                  </p>
                )}
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-destination-center">Destinadas para el centro</label>
                <input
                  id="monetary-destination-center"
                  type="text"
                  value={destinationCenter}
                  onChange={(event) => setDestinationCenter(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-objective">Con el objetivo</label>
                <textarea
                  id="monetary-objective"
                  value={objective}
                  rows={3}
                  onChange={(event) => setObjective(event.target.value)}
                />
              </div>
            </div>
          </section>
        ) : activeSection === 3 ? (
          <section
            className="monetary-folder-panel"
            id="monetary-section-three-panel"
            key="monetary-section-three-panel"
            role="tabpanel"
            aria-labelledby="monetary-section-three-tab"
          >
            <header className="monetary-folder-panel-heading">
              <div>
                <span>03 · INFORMACIÓN DEL DONANTE</span>
                <h2>Información del Donante</h2>
              </div>
              <p>Datos de identificación y propósito del donativo monetario.</p>
            </header>

            <div className="monetary-fields-grid">
              <div className="monetary-field">
                <label htmlFor="monetary-donor-name">Nombre del donante o representante</label>
                <input
                  id="monetary-donor-name"
                  type="text"
                  value={donorName}
                  onChange={(event) => setDonorName(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-donor-position">Cargo del donante o representante</label>
                <input
                  id="monetary-donor-position"
                  type="text"
                  value={donorPosition}
                  onChange={(event) => setDonorPosition(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-donor-dui">DUI de donante o representante</label>
                <input
                  id="monetary-donor-dui"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={donorDui}
                  placeholder="00000000-0"
                  aria-invalid={donorDuiError || undefined}
                  aria-describedby={donorDuiError ? 'monetary-donor-dui-error' : undefined}
                  onChange={(event) => setDonorDui(formatDui(event.target.value))}
                  onBlur={() => setDonorDuiTouched(true)}
                />
                {donorDuiError && (
                  <p className="monetary-field-error" id="monetary-donor-dui-error" role="alert">
                    Ingrese un DUI con formato 00000000-0.
                  </p>
                )}
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-donor-entity">Nombre de la entidad</label>
                <input
                  id="monetary-donor-entity"
                  type="text"
                  value={donorEntity}
                  onChange={(event) => setDonorEntity(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-payment-method">Transferencia o Cheque</label>
                <FormSelect
                  id="monetary-payment-method"
                  name="medioDonacion"
                  value={paymentMethod}
                  options={paymentMethods}
                  onChange={setPaymentMethod}
                  placeholder="Seleccione una opción"
                />
              </div>

              <div className="monetary-field monetary-field--wide">
                <label htmlFor="monetary-donation-purpose">Propósito de la Donación</label>
                <textarea
                  id="monetary-donation-purpose"
                  value={donationPurpose}
                  rows={3}
                  onChange={(event) => setDonationPurpose(event.target.value)}
                />
              </div>
            </div>
          </section>
        ) : activeSection === 4 ? (
          <section
            className="monetary-folder-panel"
            id="monetary-section-four-panel"
            key="monetary-section-four-panel"
            role="tabpanel"
            aria-labelledby="monetary-section-four-tab"
          >
            <header className="monetary-folder-panel-heading">
              <div>
                <span>04 · INFORMACIÓN DE RECEPCIÓN DE DONACIÓN</span>
                <h2>Información de Recepción de Donación</h2>
              </div>
              <p>Personal institucional asociado a la recepción del donativo monetario.</p>
            </header>

            <div className="monetary-fields-grid">
              <div className="monetary-field">
                <label htmlFor="monetary-upc-representative">Representante UPC</label>
                <FormSelect
                  id="monetary-upc-representative"
                  name="representanteUpc"
                  value={upcRepresentativeId}
                  options={upcRepresentatives.map((representative) => ({
                    value: representative.id,
                    label: representative.nombre,
                  }))}
                  onChange={setUpcRepresentativeId}
                  placeholder="Buscar representante UPC..."
                  searchable
                  loading={upcRepresentativesLoading}
                  error={upcRepresentativesError}
                  onRetry={() => void loadUpcRepresentatives()}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-reception-manager">
                  Seleccionar encargado de recepción
                </label>
                <FormSelect
                  id="monetary-reception-manager"
                  name="encargadoRecepcion"
                  value={receptionManagerId}
                  options={receptionManagers.map((manager) => ({
                    value: manager.id,
                    label: manager.nombre,
                  }))}
                  onChange={setReceptionManagerId}
                  placeholder="Buscar encargado de recepción..."
                  searchable
                  loading={receptionManagersLoading}
                  error={receptionManagersError}
                  onRetry={() => void loadReceptionManagers()}
                />
              </div>
            </div>
          </section>
        ) : activeSection === 5 ? (
          <section
            className="monetary-folder-panel"
            id="monetary-section-five-panel"
            key="monetary-section-five-panel"
            role="tabpanel"
            aria-labelledby="monetary-section-five-tab"
          >
            <header className="monetary-folder-panel-heading">
              <div>
                <span>05 · DETALLE DE ACTA DE RECEPCIÓN DE DONACIÓN</span>
                <h2>Detalle de Acta de Recepción de Donación</h2>
              </div>
              <p>Información que formará parte del acta de recepción del donativo monetario.</p>
            </header>

            <div className="monetary-fields-grid">
              <div className="monetary-field">
                <label htmlFor="monetary-act-framework">Marco del acta</label>
                <input
                  id="monetary-act-framework"
                  type="text"
                  value={actFramework}
                  onChange={(event) => setActFramework(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-act-entity">Nombre de la entidad</label>
                <input
                  id="monetary-act-entity"
                  type="text"
                  value={actEntityName}
                  onChange={(event) => setActEntityName(event.target.value)}
                />
              </div>

              <div className="monetary-field monetary-field--wide">
                <label htmlFor="monetary-act-objective">Objetivo de la donación</label>
                <textarea
                  id="monetary-act-objective"
                  value={actDonationObjective}
                  rows={3}
                  onChange={(event) => setActDonationObjective(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-act-supplies-destination">
                  ¿Dónde serán entregados los insumos?
                </label>
                <textarea
                  id="monetary-act-supplies-destination"
                  value={actSuppliesDestination}
                  rows={3}
                  onChange={(event) => setActSuppliesDestination(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-act-distribution-responsible">
                  ¿La distribución y entrega se realizará por?
                </label>
                <textarea
                  id="monetary-act-distribution-responsible"
                  value={actDistributionResponsible}
                  rows={3}
                  onChange={(event) => setActDistributionResponsible(event.target.value)}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-signed-agreement-date">Fecha del acuerdo firmado</label>
                <DatePicker
                  id="monetary-signed-agreement-date"
                  value={signedAgreementDate}
                  onChange={setSignedAgreementDate}
                />
              </div>

              <div className="monetary-field">
                <label htmlFor="monetary-act-city">Ciudad</label>
                <FormSelect
                  id="monetary-act-city"
                  name="ciudadActa"
                  value={actCityId}
                  options={cities.map((city) => ({
                    value: city.id,
                    label: city.ciudad,
                  }))}
                  onChange={setActCityId}
                  placeholder="Buscar ciudad..."
                  searchable
                  loading={citiesLoading}
                  error={citiesError}
                  onRetry={() => void loadCities()}
                />
              </div>
            </div>
          </section>
        ) : (
          <section
            className="monetary-folder-panel"
            id="monetary-section-six-panel"
            key="monetary-section-six-panel"
            role="tabpanel"
            aria-labelledby="monetary-section-six-tab"
          >
            <header className="monetary-folder-panel-heading">
              <div>
                <span>06 · REGISTRO FOTOGRÁFICO</span>
                <h2>Registro Fotográfico</h2>
              </div>
              <p>Seleccione hasta dos imágenes para documentar el donativo monetario.</p>
            </header>

            <div className="monetary-photo-grid">
              {(['photo1', 'photo2'] as const).map((slot, index) => {
                const file = photos[slot]
                const errorId = `monetary-${slot}-error`
                return (
                  <article className="monetary-photo-card" key={slot}>
                    <div className="monetary-photo-heading">
                      <div className="monetary-photo-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M4 5h4l1.5-2h5L16 5h4v16H4V5Zm2 2v12h12V7h-3l-1.5-2h-3L9 7H6Zm6 2.5A3.5 3.5 0 1 1 12 16.5 3.5 3.5 0 0 1 12 9.5Zm0 2A1.5 1.5 0 1 0 12 14.5 1.5 1.5 0 0 0 12 11.5Z" />
                        </svg>
                      </div>
                      <div>
                        <h3>Fotografía {index + 1}</h3>
                        <p>JPG, JPEG o PNG · máximo 10 MB</p>
                      </div>
                    </div>

                    {file ? (
                      <>
                        <MonetaryPhotoPreview file={file} />
                        <div className="monetary-photo-file">
                          <strong>{file.name}</strong>
                          <span>{formatPhotoSize(file.size)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="monetary-photo-empty">Sin fotografía seleccionada</div>
                    )}

                    <div className="monetary-photo-actions">
                      <input
                        className="monetary-photo-input"
                        id={`monetary-${slot}-input`}
                        type="file"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        aria-invalid={Boolean(photoErrors[slot]) || undefined}
                        aria-describedby={photoErrors[slot] ? errorId : undefined}
                        onChange={(event) => {
                          updatePhoto(slot, event.target.files?.[0])
                          event.currentTarget.value = ''
                        }}
                      />
                      <label htmlFor={`monetary-${slot}-input`}>
                        {file ? 'Cambiar' : 'Seleccionar imagen'}
                      </label>
                      {file && (
                        <button type="button" onClick={() => removePhoto(slot)}>
                          Quitar
                        </button>
                      )}
                    </div>

                    {photoErrors[slot] && (
                      <p className="monetary-photo-error" id={errorId} role="alert">
                        {photoErrors[slot]}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        <footer className="monetary-folder-actions">
          <p>La persistencia de este formulario se habilitará en una fase posterior.</p>
          <div>
            <button type="button" onClick={onBack}>Volver</button>
            {activeSection > 1 && (
              <button type="button" onClick={goToPreviousSection}>
                Anterior
              </button>
            )}
            {activeSection < 6 && (
              <button className="is-primary" type="button" onClick={goToNextSection}>
                Siguiente
              </button>
            )}
          </div>
        </footer>
      </form>
    </main>
  )
}

export default DonativoMonetarioForm
