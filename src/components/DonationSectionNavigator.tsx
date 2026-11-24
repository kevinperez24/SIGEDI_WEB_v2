import './DonationSectionNavigator.css'

export const donationSections = [
  { number: 1, label: 'Información general' },
  { number: 2, label: 'Representante UPC' },
  { number: 3, label: 'Acuerdo de Donación' },
  { number: 4, label: 'Comprobante' },
  { number: 5, label: 'Resguardo y distribución' },
  { number: 6, label: 'Almacenes y Productos' },
  { number: 7, label: 'Documentación de Acta' },
  { number: 8, label: 'Donante o Representante' },
  { number: 9, label: 'Encargado de Recepción' },
  { number: 10, label: 'Registro Fotográfico' },
] as const

export type DonationSectionNumber = (typeof donationSections)[number]['number']

type DonationSectionNavigatorProps = {
  activeSection: DonationSectionNumber
  invalidSections?: ReadonlySet<DonationSectionNumber>
  onChange: (section: DonationSectionNumber) => void
}

function DonationSectionNavigator({
  activeSection,
  invalidSections = new Set(),
  onChange,
}: DonationSectionNavigatorProps) {
  const activeIndex = donationSections.findIndex((section) => section.number === activeSection)

  return (
    <aside className="donation-section-navigator" aria-label="Índice del formulario">
      <div className="donation-section-progress">
        <span>Progreso</span>
        <strong>{activeIndex + 1} de {donationSections.length}</strong>
        <div aria-hidden="true">
          <span style={{ width: `${((activeIndex + 1) / donationSections.length) * 100}%` }} />
        </div>
      </div>

      <label className="donation-section-compact" htmlFor="donation-section-selector">
        Sección actual
        <select
          id="donation-section-selector"
          value={activeSection}
          onChange={(event) => onChange(Number(event.target.value) as DonationSectionNumber)}
        >
          {donationSections.map((section) => (
            <option value={section.number} key={section.number}>
              Sección {section.number} · {section.label}
              {invalidSections.has(section.number) ? ' · Revisar' : ''}
            </option>
          ))}
        </select>
      </label>

      <nav className="donation-section-index" aria-label="Secciones de donativos">
        {donationSections.map((section) => {
          const isActive = section.number === activeSection
          const isInvalid = invalidSections.has(section.number)
          return (
            <button
              id={`donation-section-${section.number}-tab`}
              className={`${isActive ? 'is-active' : ''}${isInvalid ? ' is-invalid' : ''}`}
              type="button"
              aria-current={isActive ? 'step' : undefined}
              aria-invalid={isInvalid || undefined}
              key={section.number}
              onClick={() => onChange(section.number)}
            >
              <span>{section.number}</span>
              <strong>{section.label}</strong>
              <small>{isInvalid ? 'Revisar' : isActive ? 'Actual' : ''}</small>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export default DonationSectionNavigator
