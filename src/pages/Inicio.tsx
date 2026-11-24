import { useCallback, useEffect, useState } from 'react'
import type { AuthenticatedUser } from '../services/auth'
import { deleteDonation, getDonations } from '../services/donations'
import type { DonationListItem } from '../services/donations'
import DonationDraftModal from '../components/DonationDraftModal'
import DonationDetailModal from '../components/DonationDetailModal'
import conapinaLogo from '../assets/Logo-CONAPINA-siglas-negativo.png'
import DonativoMonetarioForm from './DonativoMonetarioForm'
import './Inicio.css'

type InicioProps = {
  user: AuthenticatedUser
  authToken: string
  onLogout: () => void
}

type ActiveView =
  | 'inicio'
  | 'donaciones'
  | 'registro-donacion'
  | 'detalle-donacion'
  | 'donativos-monetarios'
  | 'registro-donativo-monetario'

type WorkspaceHeroProps = {
  eyebrow: string
  title: string
  description: string
  titleId: string
}

const DONATIONS_PER_PAGE = 10
const VIEW_PATHS: Record<ActiveView, string> = {
  inicio: '/inicio',
  donaciones: '/donaciones',
  'registro-donacion': '/donaciones/registro',
  'detalle-donacion': '/donaciones/detalle',
  'donativos-monetarios': '/donativos-monetarios',
  'registro-donativo-monetario': '/donativos-monetarios/registro',
}

function viewFromPath(pathname: string): ActiveView {
  const matchedView = (Object.entries(VIEW_PATHS) as Array<[ActiveView, string]>).find(
    ([, path]) => path === pathname,
  )

  return matchedView?.[0] ?? 'inicio'
}

function WorkspaceHero({ eyebrow, title, description, titleId }: WorkspaceHeroProps) {
  return (
    <section className="workspace-hero" aria-labelledby={titleId}>
      <div className="workspace-hero-content">
        <p className="workspace-eyebrow">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  )
}

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
  const [activeView, setActiveView] = useState<ActiveView>(() =>
    viewFromPath(window.location.pathname),
  )
  const [selectedDonationId, setSelectedDonationId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('id'),
  )
  const [donations, setDonations] = useState<DonationListItem[]>([])
  const [isDonationsLoading, setIsDonationsLoading] = useState(true)
  const [donationsError, setDonationsError] = useState(false)
  const [donationsPage, setDonationsPage] = useState(1)
  const [donationToDelete, setDonationToDelete] = useState<DonationListItem | null>(null)
  const [isDeletingDonation, setIsDeletingDonation] = useState(false)
  const [deletionMessage, setDeletionMessage] = useState('')
  const [deletionError, setDeletionError] = useState('')
  const fullName = `${user.nombres} ${user.apellidos}`.trim() || user.usuario
  const userRole = user.roles.length > 0 ? user.roles.join(' · ') : 'Sin rol asignado'
  const userInitials =
    [user.nombres, user.apellidos]
      .map((name) => name.trim().charAt(0))
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || user.usuario.slice(0, 2).toUpperCase()

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
    if (activeView === 'inicio' || activeView === 'donaciones') void loadDonations()
  }, [activeView, loadDonations])

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(viewFromPath(window.location.pathname))
      setSelectedDonationId(new URLSearchParams(window.location.search).get('id'))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (view: ActiveView) => {
    const path = VIEW_PATHS[view]
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setActiveView(view)
  }

  const navigateToDonationDetail = (donationId: string) => {
    const query = new URLSearchParams({ id: donationId })
    window.history.pushState({}, '', `${VIEW_PATHS['detalle-donacion']}?${query}`)
    setSelectedDonationId(donationId)
    setActiveView('detalle-donacion')
  }

  const handleDeleteDonation = async () => {
    if (!donationToDelete || isDeletingDonation) return
    setIsDeletingDonation(true)
    setDeletionError('')
    try {
      const message = await deleteDonation(donationToDelete.id, authToken)
      setDonationToDelete(null)
      setDeletionMessage(message)
      await loadDonations()
    } catch (error) {
      setDeletionError(
        error instanceof Error ? error.message : 'No fue posible eliminar la donación.',
      )
    } finally {
      setIsDeletingDonation(false)
    }
  }

  const donationKpiValue = isDonationsLoading
    ? 'Cargando…'
    : donationsError
      ? 'No disponible'
      : donations.length.toLocaleString('es-SV')
  const donationKpiClass = isDonationsLoading
    ? 'information-value--pending'
    : donationsError
      ? 'information-value--error'
      : undefined
  const donationSummaryCards = [
    { label: 'Total de donaciones', value: donationKpiValue, valueClass: undefined },
    {
      label: 'Donaciones en proceso',
      value: donations
        .filter((donation) => donation.estado === 'EN_PROCESO')
        .length.toLocaleString('es-SV'),
      valueClass: undefined,
    },
    {
      label: 'Donaciones finalizadas',
      value: donations
        .filter((donation) => donation.estado === 'FINALIZADO')
        .length.toLocaleString('es-SV'),
      valueClass: 'information-value--success',
    },
  ]

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
          <div className="dashboard-logo">
            <img src={conapinaLogo} alt="CONAPINA" />
          </div>
          <div>
            <p className="dashboard-title">SIGEDI</p>
            <p className="dashboard-subtitle">
              Sistema de Gestión de Donaciones Institucionales
            </p>
          </div>
        </div>

        <div className="dashboard-user">
          <div className="header-user-identity">
            <strong>{fullName}</strong>
            <span>{userRole}</span>
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar" aria-label="Navegación principal">
          <div className="sidebar-profile">
            <div className="sidebar-avatar" aria-hidden="true">
              {userInitials}
            </div>
            <div className="sidebar-profile-copy">
              <strong>{fullName}</strong>
              <span>{userRole}</span>
            </div>
          </div>

          <div className="sidebar-divider" />
          <p className="sidebar-section-label">Módulos</p>
          <nav>
            <button
              className={`nav-item${activeView === 'inicio' ? ' nav-item--active' : ''}`}
              type="button"
              onClick={() => navigateTo('inicio')}
              aria-pressed={activeView === 'inicio'}
            >
              <span className="nav-icon nav-icon--home" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="m4 10 8-7 8 7v10H5a1 1 0 0 1-1-1v-9Z" />
                  <path d="M9 20v-6h6v6" />
                </svg>
              </span>
              <span>Inicio</span>
            </button>
            <button
              className={`nav-item${activeView === 'donaciones' || activeView === 'registro-donacion' || activeView === 'detalle-donacion' ? ' nav-item--active' : ''}`}
              type="button"
              onClick={() => navigateTo('donaciones')}
              aria-pressed={activeView === 'donaciones' || activeView === 'registro-donacion' || activeView === 'detalle-donacion'}
            >
              <span className="nav-icon nav-icon--donations" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 8h16v12H4z" />
                  <path d="M3 8h18M12 8v12M5 4h5a2 2 0 0 1 2 2v2H7a2 2 0 0 1-2-2V4Zm14 0h-5a2 2 0 0 0-2 2v2h5a2 2 0 0 0 2-2V4Z" />
                </svg>
              </span>
              <span>Donativos</span>
            </button>
            <button
              className={`nav-item${activeView === 'donativos-monetarios' || activeView === 'registro-donativo-monetario' ? ' nav-item--active' : ''}`}
              type="button"
              onClick={() => navigateTo('donativos-monetarios')}
              aria-pressed={
                activeView === 'donativos-monetarios' ||
                activeView === 'registro-donativo-monetario'
              }
            >
              <span className="nav-icon nav-icon--monetary" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path d="M7 9h.01M17 15h.01M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
                </svg>
              </span>
              <span>Donativos Monetarios</span>
            </button>
          </nav>
        </aside>

        {activeView === 'inicio' ? (
          <main className="dashboard-main dashboard-view" id="inicio" key="inicio">
            <WorkspaceHero
              eyebrow="MI ESPACIO DE TRABAJO"
              title="Bienvenido a SIGEDI · Sistema de Gestión de Donaciones Institucionales"
              description="Consulte y gestione la información de donaciones institucionales."
              titleId="workspace-title"
            />

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
              </div>
              <div className="information-grid information-grid--single">
                <article className="information-card" aria-live="polite">
                  <p>Total de donaciones</p>
                  <strong className={donationKpiClass}>
                    {donationKpiValue}
                  </strong>
                </article>
              </div>
            </section>
          </main>
        ) : activeView === 'donaciones' ? (
          <main className="dashboard-main dashboard-view" id="donaciones" key="donaciones">
            <WorkspaceHero
              eyebrow="MÓDULO DE DONATIVOS"
              title="Gestión de Donaciones Institucionales"
              description="Registre, consulte y administre las donaciones institucionales."
              titleId="donations-title"
            />

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
                onClick={() => navigateTo('registro-donacion')}
              >
                Registrar nueva donación
              </button>
            </section>

            <section className="information-section" aria-labelledby="donation-summary-title">
              <div className="information-heading">
                <h2 id="donation-summary-title">Resumen de donaciones</h2>
              </div>
              <div className="information-grid">
                {donationSummaryCards.map((card) => (
                  <article className="information-card" key={card.label}>
                    <p>{card.label}</p>
                    <strong
                      className={donationKpiClass ?? card.valueClass}
                    >
                      {isDonationsLoading || donationsError ? donationKpiValue : card.value}
                    </strong>
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
                            donation.lugar_recepcion
                              .map((place) => place.nombre)
                              .join(' · '),
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
                                <div className="donation-row-actions">
                                <button
                                  className="view-donation-button"
                                  type="button"
                                  onClick={() => navigateToDonationDetail(donation.id)}
                                >
                                  Ver
                                </button>
                                <button
                                  className="delete-donation-button"
                                  type="button"
                                  onClick={() => {
                                    setDeletionMessage('')
                                    setDeletionError('')
                                    setDonationToDelete(donation)
                                  }}
                                >
                                  Eliminar
                                </button>
                                </div>
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
        ) : activeView === 'registro-donacion' ? (
          <DonationDraftModal
            creatorName={fullName}
            authToken={authToken}
            onClose={() => navigateTo('donaciones')}
            onSaved={loadDonations}
          />
        ) : activeView === 'detalle-donacion' ? (
          selectedDonationId ? (
            <DonationDetailModal
              donationId={selectedDonationId}
              authToken={authToken}
              onClose={() => {
                setSelectedDonationId(null)
                navigateTo('donaciones')
              }}
              onUpdated={() => void loadDonations()}
            />
          ) : (
            <main className="dashboard-main dashboard-view" id="detalle-donacion-no-disponible">
              <p className="donations-list-status">No fue posible identificar el donativo.</p>
              <button className="primary-action-button" type="button" onClick={() => navigateTo('donaciones')}>
                Volver al listado
              </button>
            </main>
          )
        ) : activeView === 'donativos-monetarios' ? (
          <main
            className="dashboard-main dashboard-view"
            id="donativos-monetarios"
            key="donativos-monetarios"
          >
            <WorkspaceHero
              eyebrow="MÓDULO DE DONATIVOS MONETARIOS"
              title="Gestión de Donativos Monetarios"
              description="Registre, consulte y administre los donativos monetarios institucionales."
              titleId="monetary-donations-title"
            />

            <section
              className="module-card module-card--action"
              aria-labelledby="monetary-module-title"
            >
              <div className="module-card-content">
                <div className="module-icon module-icon--monetary" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="6" width="18" height="12" rx="2" />
                    <path d="M7 9h.01M17 15h.01M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
                  </svg>
                </div>
                <div>
                  <h2 id="monetary-module-title">Registro de Donativos Monetarios</h2>
                  <p>Gestión y seguimiento de los donativos monetarios institucionales.</p>
                </div>
              </div>
              <button
                className="primary-action-button"
                type="button"
                onClick={() => navigateTo('registro-donativo-monetario')}
              >
                Registrar Donación Monetaria
              </button>
            </section>

            <section className="information-section" aria-labelledby="monetary-summary-title">
              <div className="information-heading">
                <h2 id="monetary-summary-title">Resumen de donativos monetarios</h2>
              </div>
              <div className="information-grid">
                {['Total de donativos monetarios', 'En proceso', 'Finalizados'].map((label) => (
                  <article className="information-card" key={label}>
                    <p>{label}</p>
                    <strong aria-label="Sin datos disponibles">—</strong>
                    <span className="information-note">Sin datos disponibles</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="donations-list" aria-labelledby="monetary-list-title">
              <div className="donations-list-heading">
                <h2 id="monetary-list-title">Listado de donativos monetarios</h2>
                <span>Integración pendiente</span>
              </div>
              <p className="donations-list-status">
                Aún no hay datos disponibles. El listado se habilitará en una fase posterior.
              </p>
            </section>
          </main>
        ) : (
          <DonativoMonetarioForm
            authToken={authToken}
            onBack={() => navigateTo('donativos-monetarios')}
          />
        )}
      </div>

      {deletionMessage && (
        <div className="donation-deletion-notice" role="status">
          <span>{deletionMessage}</span>
          <button type="button" onClick={() => setDeletionMessage('')} aria-label="Cerrar mensaje">
            ×
          </button>
        </div>
      )}

      {donationToDelete && (
        <div className="donation-confirmation-overlay" role="presentation">
          <section
            className="donation-confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-donation-title"
            aria-describedby="delete-donation-description"
          >
            <h2 id="delete-donation-title">Eliminar donación</h2>
            <p id="delete-donation-description">
              ¿Está seguro de eliminar esta donación? Esta acción eliminará también los
              documentos relacionados y no podrá deshacerse.
            </p>
            {deletionError && <p className="donation-confirmation-error" role="alert">{deletionError}</p>}
            <div className="donation-confirmation-actions">
              <button
                type="button"
                className="donation-confirmation-cancel"
                disabled={isDeletingDonation}
                onClick={() => setDonationToDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="donation-confirmation-delete"
                disabled={isDeletingDonation}
                onClick={() => void handleDeleteDonation()}
              >
                {isDeletingDonation ? 'Eliminando...' : 'Eliminar donación'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default Inicio
