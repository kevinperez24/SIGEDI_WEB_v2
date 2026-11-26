import type { DonationActaSummary, DonationIncome } from '../services/donations'
import './DonationProvisionalActsSection.css'

type DonationProvisionalActsSectionProps = {
  incomes: DonationIncome[]
  actas: DonationActaSummary[]
  isLoading: boolean
  pendingAction: string
  onGenerate: (incomeId: string) => void
  onView: (acta: DonationActaSummary) => void
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatDate(value: string): string {
  if (!value) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(value))
}

function DonationProvisionalActsSection({
  incomes, actas, isLoading, pendingAction, onGenerate, onView,
}: DonationProvisionalActsSectionProps) {
  const activeFinal = actas.find((acta) => acta.es_acta_final)
  const orderedIncomes = [...incomes].sort(
    (first, second) => first.numero_entrega - second.numero_entrega,
  )

  return (
    <section className="donation-form-section donation-provisional-acts" id="donation-section-11-panel" role="tabpanel" aria-labelledby="donation-section-11-tab">
      <div className="donation-section-heading">
        <span>Sección 11</span>
        <h3>Actas de recepción</h3>
      </div>

      {isLoading ? (
        <p className="provisional-acts-state">Cargando recepciones y actas...</p>
      ) : orderedIncomes.length === 0 ? (
        <p className="provisional-acts-state">Aún no existen recepciones para generar actas.</p>
      ) : (
        <div className="provisional-income-list">
          {orderedIncomes.map((income, index) => {
            const expectedActaType = income.tipo_recepcion === 'FINAL' ? 'FINAL' : 'PROVISIONAL'
            const visibleActa = actas.find((acta) =>
              acta.tipo_acta === expectedActaType
              && acta.numero_entrega === income.numero_entrega,
            )
            const subtotal = income.productos.reduce(
              (total, product) => total + Math.round(product.total_price * 100), 0,
            )
            const priorDeliveriesAreDocumented = orderedIncomes.slice(0, index).every(
              (priorIncome) => actas.some((acta) =>
                acta.tipo_acta === 'PROVISIONAL'
                && acta.numero_entrega === priorIncome.numero_entrega,
              ),
            )
            const isGenerating = pendingAction === income.id

            return (
              <article className="provisional-income-card" key={income.id}>
                <header>
                  <span>{income.numero_entrega}</span>
                  <div><h4>Entrega {income.numero_entrega}</h4><p>{income.nombre_almacen || 'Almacén no indicado'}</p></div>
                  <strong>{formatUsd(subtotal)}</strong>
                </header>
                <dl>
                  <div><dt>Fecha</dt><dd>{formatDate(income.fecha_recepcion_donacion)}</dd></div>
                  <div><dt>Productos</dt><dd>{income.productos.length}</dd></div>
                  <div><dt>Tipo de recepción</dt><dd>{income.tipo_recepcion}</dd></div>
                  <div><dt>Estado</dt><dd>{income.estado_recepcion.replace('_', ' ')}</dd></div>
                  <div><dt>Acta</dt><dd className={visibleActa ? 'has-acta' : ''}>{visibleActa ? visibleActa.codigo_acta : 'Sin acta'}</dd></div>
                </dl>
                <div className="provisional-income-actions">
                  {visibleActa && <button type="button" onClick={() => onView(visibleActa)}>Ver acta</button>}
                  {(!activeFinal || visibleActa?.es_acta_final) && (
                    <button
                      className="is-primary"
                      type="button"
                      onClick={() => {
                        if (income.tipo_recepcion === 'FINAL' && !visibleActa) {
                          const confirmed = window.confirm('Esta recepción será marcada como final. El sistema consolidará las entregas registradas y relacionará las actas provisionales anteriores. Después del cierre no podrán agregarse nuevas recepciones.')
                          if (!confirmed) return
                        }
                        onGenerate(income.id)
                      }}
                      disabled={Boolean(pendingAction) || !priorDeliveriesAreDocumented}
                      title={!priorDeliveriesAreDocumented ? 'Genere primero las actas provisionales anteriores.' : undefined}
                    >
                      {isGenerating ? 'Generando...' : visibleActa
                        ? `Regenerar acta ${income.tipo_recepcion === 'FINAL' ? 'final' : 'provisional'}`
                        : `Generar acta ${income.tipo_recepcion === 'FINAL' ? 'final' : 'provisional'}`}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default DonationProvisionalActsSection
