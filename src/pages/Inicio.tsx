import { useCallback, useEffect, useState } from 'react'
import type { AuthenticatedUser } from '../services/auth'
import { getDonations } from '../services/donations'
import type { DonationListItem } from '../services/donations'
import DonationDraftModal from '../components/DonationDraftModal'
import DonationDetailModal from '../components/DonationDetailModal'
import './Inicio.css'

type InicioProps = {
  user: AuthenticatedUser
  authToken: string
  onLogout: () => void
}

const informationCards = [
  { label: 'Total de donaciones', value: '0' },
  { label: 'Registros recientes', value: '0' },
  { label: 'Estado del sistema', value: 'Disponible' },
]

const donationSummaryCards = [
  { label: 'Total de donaciones', value: '0' },
  { label: 'Donaciones en proceso', value: '0' },
  { label: 'Donaciones finalizadas', value: '0' },
]

type ActiveView = 'inicio' | 'donaciones'

const DONATIONS_PER_PAGE = 10

function formatReceptionDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function managementTypeClass(value: string): string {
  const classes: Record<string, string> = {
    Ofrecimiento: 'management-badge--offer',
    Solicitud: 'management-badge--request',
    'Asistencia Humanitaria': 'management-badge--humanitarian',
    'En el marco de un proyecto': 'management-badge--project',
  }

  return classes[value] ?? 'management-badge--default'
}

function Inicio({ user, authToken, onLogout }: InicioProps) {
  const [activeView, setActiveView] = useState<ActiveView>('inicio')
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false)
  const [selectedDonationId, setSelectedDonationId] = useState<string | null>(null)
  const [donations, setDonations] = useState<DonationListItem[]>([])
  const [isDonationsLoading, setIsDonationsLoading] = useState(false)
  const [donationsError, setDonationsError] = useState(false)
  const [donationsPage, setDonationsPage] = useState(1)
  const fullName = `${user.nombres} ${user.apellidos}`.trim() || user.usuario

  const loadDonations = useCallback(async () => {
    setIsDonationsLoading(true)
    setDonationsError(false)

    try {
      const loadedDonations = await getDonations(authToken)
      setDonations(loadedDonations)
      setDonationsPage((current) =>
        Math.min(current, Math.max(1, Math.ceil(loadedDonations.length / DONATIONS_PER_PAGE))),
      )
    } catch {
      setDonationsError(true)
    } finally {
      setIsDonationsLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    if (activeView === 'donaciones') void loadDonations()
  }, [activeView, loadDonations])

  const totalDonationPages = Math.max(
    1,
    Math.ceil(donations.length / DONATIONS_PER_PAGE),
  )
  const visibleDonations = donations.slice(
    (donationsPage - 1) * DONATIONS_PER_PAGE,
    donationsPage * DONATIONS_PER_PAGE,
  )

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-logo" aria-hidden="true">
            S
          </div>
          <div>
            <p className="dashboard-title">SIGEDI</p>
            <p className="dashboard-subtitle">
              Sistema de Gestión de Donaciones Institucionales
            </p>
          </div>
        </div>

        <div className="dashboard-user">
          <div className="dashboard-user-copy">
            <span>Sesión iniciada como</span>
            <strong>{fullName}</strong>
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar" aria-label="Navegación principal">
          <nav>
            <button
              className={`nav-item${activeView === 'inicio' ? ' nav-item--active' : ''}`}
              type="button"
              onClick={() => setActiveView('inicio')}
              aria-pressed={activeView === 'inicio'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12 3 9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8Z" />
              </svg>
              Inicio
            </button>
            <button
              className={`nav-item${activeView === 'donaciones' ? ' nav-item--active' : ''}`}
              type="button"
              onClick={() => setActiveView('donaciones')}
              aria-pressed={activeView === 'donaciones'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16v14H4V5Zm2 2v2h12V7H6Zm0 4v6h12v-6H6Zm2 1h4v4H8v-4Z" />
              </svg>
              Donaciones
            </button>
          </nav>
        </aside>

        {activeView === 'inicio' ? (
          <main className="dashboard-main" id="inicio">
            <div className="welcome-copy">
              <p className="section-eyebrow">Panel principal</p>
              <h1>Bienvenido al Sistema de Gestión de Donaciones Institucionales</h1>
              <p>Consulte el estado general y acceda a los módulos institucionales.</p>
            </div>

            <section className="module-card" aria-labelledby="module-title">
              <div className="module-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M20 7h-3.2A5 5 0 0 0 12 3a5 5 0 0 0-4.8 4H4a2 2 0 0 0-2 2v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2Zm-8-2a3 3 0 0 1 2.8 2H9.2A3 3 0 0 1 12 5Zm8 13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5h6v1h4v-1h6v5Zm0-7h-6V9h6v2ZM4 9h6v2H4V9Z" />
                </svg>
              </div>
              <div>
                <h2 id="module-title">Módulo de Donaciones</h2>
                <p>Gestión y consulta de registros institucionales</p>
              </div>
            </section>

            <section className="information-section" aria-labelledby="summary-title">
              <div className="information-heading">
                <h2 id="summary-title">Resumen general</h2>
                <span>Datos de ejemplo</span>
              </div>
              <div className="information-grid">
                {informationCards.map((card) => (
                  <article className="information-card" key={card.label}>
                    <p>{card.label}</p>
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </div>
            </section>
          </main>
        ) : (
          <main className="dashboard-main" id="donaciones">
            <div className="welcome-copy">
              <p className="section-eyebrow">Módulo de Donaciones</p>
              <h1>Gestión de Donaciones Institucionales</h1>
              <p>Registre, consulte y administre las donaciones institucionales.</p>
            </div>

            <section
              className="module-card module-card--action"
              aria-labelledby="donation-module-title"
            >
              <div className="module-card-content">
                <div className="module-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 7h-3.2A5 5 0 0 0 12 3a5 5 0 0 0-4.8 4H4a2 2 0 0 0-2 2v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2Zm-8-2a3 3 0 0 1 2.8 2H9.2A3 3 0 0 1 12 5Zm8 13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5h6v1h4v-1h6v5Zm0-7h-6V9h6v2ZM4 9h6v2H4V9Z" />
                  </svg>
                </div>
                <div>
                  <h2 id="donation-module-title">Registro de Donaciones</h2>
                  <p>Gestión y seguimiento de los registros de donaciones institucionales.</p>
                </div>
              </div>
              <button
                className="primary-action-button"
                type="button"
                onClick={() => setIsDonationModalOpen(true)}
              >
                Registrar nueva donación
              </button>
            </section>

            <section className="information-section" aria-labelledby="donation-summary-title">
              <div className="information-heading">
                <h2 id="donation-summary-title">Resumen de donaciones</h2>
                <span>Datos de ejemplo</span>
              </div>
              <div className="information-grid">
                {donationSummaryCards.map((card) => (
                  <article className="information-card" key={card.label}>
                    <p>{card.label}</p>
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="donations-list" aria-labelledby="donations-list-title">
              <div className="donations-list-heading">
                <h2 id="donations-list-title">Listado de donaciones</h2>
                {!isDonationsLoading && !donationsError && (
                  <span>{donations.length} registros</span>
                )}
              </div>

              {isDonationsLoading ? (
                <p className="donations-list-status">Cargando...</p>
              ) : donationsError ? (
                <p className="donations-list-status donations-list-status--error" role="alert">
                  No fue posible cargar las donaciones.
                </p>
              ) : donations.length === 0 ? (
                <p className="donations-list-status">
                  Aún no existen registros de donaciones.
                </p>
              ) : (
                <>
                  <div className="donations-table-wrapper">
                    <table className="donations-table">
                      <thead>
                        <tr>
                          <th scope="col">Correlativo de acta</th>
                          <th scope="col">Nombre del proyecto / donativo</th>
                          <th scope="col">Tipo de gestión</th>
                          <th scope="col">Fecha de recepción</th>
                          <th scope="col">Estado</th>
                          <th scope="col">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDonations.map((donation) => {
                          const secondaryProjectInfo = [
                            donation.dpto_seccion,
                            donation.lugar_recepcion,
                          ]
                            .filter(Boolean)
                            .join(' · ')

                          return (
                            <tr key={donation.id}>
                              <td>
                                <span className="correlative-badge">
                                  {donation.correlativo_acta || 'Por asignar'}
                                </span>
                              </td>
                              <td>
                                <strong className="donation-project-name">
                                  {donation.nombre_proyecto}
                                </strong>
                                {secondaryProjectInfo && (
                                  <span className="donation-project-meta">
                                    {secondaryProjectInfo}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  className={`management-badge ${managementTypeClass(
                                    donation.tipo_gestion,
                                  )}`}
                                >
                                  {donation.tipo_gestion}
                                </span>
                              </td>
                              <td>{formatReceptionDate(donation.fecha_recepcion)}</td>
                              <td>
                                <span
                                  className={`donation-status-badge donation-status-badge--${donation.estado.toLowerCase()}`}
                                >
                                  {donation.estado.replace('_', ' ')}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="view-donation-button"
                                  type="button"
                                  onClick={() => setSelectedDonationId(donation.id)}
                                >
                                  Ver
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <nav className="donations-pagination" aria-label="Paginación de donaciones">
                    <button
                      type="button"
                      onClick={() => setDonationsPage((current) => current - 1)}
                      disabled={donationsPage === 1}
                    >
                      Anterior
                    </button>
                    <span>
                      Página {donationsPage} de {totalDonationPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDonationsPage((current) => current + 1)}
                      disabled={donationsPage === totalDonationPages}
                    >
                      Siguiente
                    </button>
                  </nav>
                </>
              )}
            </section>
          </main>
        )}
      </div>

      {isDonationModalOpen && (
        <DonationDraftModal
          creatorName={fullName}
          authToken={authToken}
          onClose={() => setIsDonationModalOpen(false)}
          onSaved={() => void loadDonations()}
        />
      )}

      {selectedDonationId && (
        <DonationDetailModal
          donationId={selectedDonationId}
          authToken={authToken}
          onClose={() => setSelectedDonationId(null)}
          onUpdated={() => void loadDonations()}
        />
      )}
    </div>
  )
}

export default Inicio
