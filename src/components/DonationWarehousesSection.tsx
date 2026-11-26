import DatePicker from './form/DatePicker'
import type { DonationIncome, DonationIncomeInput } from '../services/donations'
import './DonationWarehousesSection.css'

export type DonationWarehouseProductDraft = {
  id: string
  recordId?: string
  brandName: string
  productName: string
  quantity: string
  unitPrice: string
  editing: boolean
}

export type DonationWarehouseDraft = {
  id: string
  recordId?: string
  receptionType: 'PARCIAL' | 'FINAL'
  deliveryNumber?: number
  receptionStatus?: 'PENDIENTE_ACTA' | 'DOCUMENTADA' | 'FINALIZADA'
  warehouseName: string
  supplierName: string
  receptionDate: string
  description: string
  expanded: boolean
  products: DonationWarehouseProductDraft[]
}

type DonationWarehousesSectionProps = {
  value: DonationWarehouseDraft[]
  onChange: (value: DonationWarehouseDraft[]) => void
  disabled?: boolean
}

let temporaryIdSequence = 0

function createTemporaryId(prefix: 'warehouse' | 'product'): string {
  temporaryIdSequence += 1
  return `${prefix}-${Date.now()}-${temporaryIdSequence}`
}

function createWarehouse(): DonationWarehouseDraft {
  return {
    id: createTemporaryId('warehouse'),
    receptionType: 'PARCIAL',
    warehouseName: '',
    supplierName: '',
    receptionDate: '',
    description: '',
    expanded: true,
    products: [],
  }
}

function createProduct(): DonationWarehouseProductDraft {
  return {
    id: createTemporaryId('product'),
    brandName: '',
    productName: '',
    quantity: '',
    unitPrice: '',
    editing: true,
  }
}

function parseDecimal(value: string): { coefficient: bigint; scale: number } {
  const match = value.trim().toLowerCase().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/)
  if (!match) return { coefficient: 0n, scale: 0 }
  const fraction = match[3] ?? ''
  const exponent = Number(match[4] ?? 0)
  let coefficient = BigInt(`${match[1] === '-' ? '-' : ''}${match[2]}${fraction}`)
  let scale = fraction.length - exponent
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale)
    scale = 0
  }
  return { coefficient, scale }
}

function multiplyToCents(firstValue: string, secondValue: string): bigint {
  const first = parseDecimal(firstValue)
  const second = parseDecimal(secondValue)
  const product = first.coefficient * second.coefficient
  const productScale = first.scale + second.scale
  if (productScale <= 2) return product * (10n ** BigInt(2 - productScale))
  const divisor = 10n ** BigInt(productScale - 2)
  let cents = product / divisor
  const remainder = product < 0n ? -(product % divisor) : product % divisor
  if (remainder * 2n >= divisor) cents += product < 0n ? -1n : 1n
  return cents
}

function calculateProductTotal(product: DonationWarehouseProductDraft): bigint {
  return multiplyToCents(product.quantity, product.unitPrice)
}

function calculateWarehouseTotal(warehouse: DonationWarehouseDraft): bigint {
  return warehouse.products.reduce(
    (total, product) => total + calculateProductTotal(product),
    0n,
  )
}

function formatUsd(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents
  const dollars = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimal = (absolute % 100n).toString().padStart(2, '0')
  return `${cents < 0n ? '-' : ''}$ ${dollars}.${decimal}`
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h4L19 9a2.12 2.12 0 0 0-3-3L5 17l-1 3Z" />
      <path d="m14.5 7.5 3 3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  )
}

function hasWarehouseData(warehouse: DonationWarehouseDraft): boolean {
  return Boolean(
    warehouse.warehouseName
      || warehouse.supplierName
      || warehouse.receptionDate
      || warehouse.description.trim()
      || warehouse.products.length,
  )
}

function hasProductData(product: DonationWarehouseProductDraft): boolean {
  return Boolean(
    product.brandName.trim()
      || product.productName.trim()
      || product.quantity
      || product.unitPrice,
  )
}

export function donationIncomeToDraft(
  income: DonationIncome,
  expanded = true,
): DonationWarehouseDraft {
  return {
    id: createTemporaryId('warehouse'),
    recordId: income.id,
    receptionType: income.tipo_recepcion,
    deliveryNumber: income.numero_entrega,
    receptionStatus: income.estado_recepcion,
    warehouseName: income.nombre_almacen,
    supplierName: income.nombre_proveedor,
    receptionDate: income.fecha_recepcion_donacion.slice(0, 10),
    description: income.description,
    expanded,
    products: income.productos.map((product) => ({
      id: createTemporaryId('product'),
      recordId: product.id,
      brandName: product.brand_name,
      productName: product.name_product,
      quantity: String(product.amount),
      unitPrice: Number(product.price).toFixed(2),
      editing: false,
    })),
  }
}

export function donationWarehouseToInput(
  warehouse: DonationWarehouseDraft,
): DonationIncomeInput {
  return {
    tipo_recepcion: warehouse.receptionType,
    nombre_almacen: warehouse.warehouseName.trim(),
    nombre_proveedor: warehouse.supplierName.trim(),
    fecha_recepcion_donacion: warehouse.receptionDate,
    description: warehouse.description.trim(),
    productos: warehouse.products.map((product) => ({
      ...(product.recordId ? { id: product.recordId } : {}),
      brand_name: product.brandName.trim(),
      name_product: product.productName.trim(),
      amount: Number(product.quantity),
      price: Number(product.unitPrice),
    })),
  }
}

export function validateDonationWarehouses(
  warehouses: readonly DonationWarehouseDraft[],
): string | null {
  const finalIndexes = warehouses.flatMap((warehouse, index) =>
    warehouse.receptionType === 'FINAL' ? [index] : [],
  )
  if (finalIndexes.length > 1) return 'Solo puede existir una recepción final.'
  if (finalIndexes.length === 1 && finalIndexes[0] !== warehouses.length - 1) {
    return 'La recepción final debe ser la última entrega.'
  }
  for (const warehouse of warehouses) {
    if (!warehouse.warehouseName.trim() || !warehouse.supplierName.trim() || !warehouse.receptionDate) {
      return 'Complete el almacén, proveedor y fecha de cada recepción.'
    }
    for (const product of warehouse.products) {
      if (!product.productName.trim()) return 'Ingrese el nombre de cada producto.'
      if (!Number.isFinite(Number(product.quantity)) || Number(product.quantity) <= 0) {
        return 'La cantidad de cada producto debe ser mayor que cero.'
      }
      if (!Number.isFinite(Number(product.unitPrice)) || Number(product.unitPrice) < 0) {
        return 'El precio unitario no puede ser negativo.'
      }
    }
  }
  return null
}

function DonationWarehousesSection({
  value,
  onChange,
  disabled = false,
}: DonationWarehousesSectionProps) {
  const donationTotal = value.reduce(
    (total, warehouse) => total + calculateWarehouseTotal(warehouse),
    0n,
  )
  const hasFinalReception = value.some((warehouse) => warehouse.receptionType === 'FINAL')
  const updateWarehouse = (
    warehouseId: string,
    update: (warehouse: DonationWarehouseDraft) => DonationWarehouseDraft,
  ) => {
    onChange(value.map((warehouse) => (
      warehouse.id === warehouseId ? update(warehouse) : warehouse
    )))
  }

  const removeWarehouse = (warehouse: DonationWarehouseDraft) => {
    if (
      hasWarehouseData(warehouse)
      && !window.confirm('Este almacén contiene datos. ¿Desea eliminarlo?')
    ) return

    onChange(value.filter((item) => item.id !== warehouse.id))
  }

  const addProduct = (warehouseId: string) => {
    updateWarehouse(warehouseId, (warehouse) => ({
      ...warehouse,
      expanded: true,
      products: [...warehouse.products, createProduct()],
    }))
  }

  const updateProduct = (
    warehouseId: string,
    productId: string,
    update: (product: DonationWarehouseProductDraft) => DonationWarehouseProductDraft,
  ) => {
    updateWarehouse(warehouseId, (warehouse) => ({
      ...warehouse,
      products: warehouse.products.map((product) => (
        product.id === productId ? update(product) : product
      )),
    }))
  }

  const removeProduct = (warehouseId: string, productId: string) => {
    const product = value
      .find((warehouse) => warehouse.id === warehouseId)
      ?.products.find((item) => item.id === productId)
    if (
      product
      && hasProductData(product)
      && !window.confirm('Este producto contiene datos. ¿Desea quitarlo?')
    ) return

    updateWarehouse(warehouseId, (warehouse) => ({
      ...warehouse,
      products: warehouse.products.filter((product) => product.id !== productId),
    }))
  }

  return (
    <div className="donation-warehouses">
      <div className="donation-warehouses-toolbar">
        <span className="donation-warehouses-section-number" aria-hidden="true">6</span>
        <div className="donation-warehouses-toolbar-copy">
          <h4>Almacenes y productos del donativo</h4>
          <p>Agregue los productos y organícelos por almacén y proveedor.</p>
        </div>
        <button
          className="modal-primary-button donation-warehouse-add"
          type="button"
          onClick={() => onChange([...value, createWarehouse()])}
          disabled={disabled || hasFinalReception}
        >
          <span aria-hidden="true">＋</span>
          Agregar otro almacén/proveedor
        </button>
      </div>

      {hasFinalReception && (
        <p className="donation-reception-closed" role="status">
          La recepción de la donación está cerrada. No pueden agregarse nuevas recepciones.
        </p>
      )}

      {value.length === 0 ? (
        <div className="donation-warehouses-empty">
          <strong>Sin almacenes agregados</strong>
          <span>Agregue un almacén para organizar sus productos.</span>
        </div>
      ) : (
        <div className="donation-warehouse-list">
          {value.map((warehouse, warehouseIndex) => {
            const contentId = `${warehouse.id}-content`
            const warehouseTotal = calculateWarehouseTotal(warehouse)
            return (
              <article
                className={`donation-warehouse-card${warehouse.expanded ? ' is-active' : ' is-collapsed'}`}
                key={warehouse.id}
              >
                <header className="donation-warehouse-card-header">
                  <div className="donation-warehouse-heading">
                    <span className="donation-warehouse-number">{warehouseIndex + 1}</span>
                    <span className="donation-warehouse-identity">
                      <strong>{warehouse.warehouseName.trim() || `Almacén ${warehouseIndex + 1}`}</strong>
                      <small>
                        Proveedor: {warehouse.supplierName.trim() || 'No indicado'}
                      </small>
                      <small>
                        Entrega {warehouse.deliveryNumber ?? warehouseIndex + 1} · {warehouse.receptionType === 'FINAL' ? 'Final' : 'Parcial'}
                      </small>
                    </span>
                  </div>
                  <div className="donation-warehouse-header-tools">
                    <strong className="donation-warehouse-header-total">{formatUsd(warehouseTotal)}</strong>
                    <button
                      className="donation-warehouse-toggle"
                      type="button"
                      onClick={() => updateWarehouse(warehouse.id, (current) => ({
                        ...current,
                        expanded: !current.expanded,
                      }))}
                      aria-expanded={warehouse.expanded}
                      aria-controls={contentId}
                    >
                      {warehouse.expanded ? 'Contraer' : 'Expandir'}
                    </button>
                    <button
                      className="donation-warehouse-header-add"
                      type="button"
                      onClick={() => addProduct(warehouse.id)}
                      disabled={disabled}
                    >
                      ＋ Agregar producto a este grupo
                    </button>
                    <button
                      className="donation-warehouse-remove"
                      type="button"
                      onClick={() => removeWarehouse(warehouse)}
                      disabled={disabled}
                      aria-label={`Eliminar almacén ${warehouseIndex + 1}`}
                    >
                      Eliminar
                    </button>
                  </div>
                </header>

                <div
                  className="donation-warehouse-card-content"
                  id={contentId}
                  aria-hidden={!warehouse.expanded}
                  inert={!warehouse.expanded}
                >
                  <div className="donation-warehouse-card-content-inner">
                    <div className="donation-warehouse-fields">
                      <fieldset className="donation-reception-type donation-field donation-field--wide">
                        <legend>Tipo de recepción</legend>
                        <label>
                          <input
                            type="radio"
                            name={`${warehouse.id}-reception-type`}
                            value="PARCIAL"
                            checked={warehouse.receptionType === 'PARCIAL'}
                            onChange={() => updateWarehouse(warehouse.id, (current) => ({
                              ...current,
                              receptionType: 'PARCIAL',
                            }))}
                            disabled={disabled || warehouse.receptionStatus !== undefined
                              && warehouse.receptionStatus !== 'PENDIENTE_ACTA'}
                          />
                          Entrega parcial
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`${warehouse.id}-reception-type`}
                            value="FINAL"
                            checked={warehouse.receptionType === 'FINAL'}
                            onChange={() => updateWarehouse(warehouse.id, (current) => ({
                              ...current,
                              receptionType: 'FINAL',
                            }))}
                            disabled={disabled || warehouse.receptionStatus !== undefined
                              && warehouse.receptionStatus !== 'PENDIENTE_ACTA'}
                          />
                          Entrega final
                        </label>
                      </fieldset>
                      <div className="donation-field">
                        <label htmlFor={`${warehouse.id}-warehouse`}>Nombre de almacén</label>
                        <input
                          id={`${warehouse.id}-warehouse`}
                          value={warehouse.warehouseName}
                          onChange={(event) => updateWarehouse(warehouse.id, (current) => ({
                            ...current,
                            warehouseName: event.target.value,
                          }))}
                          disabled={disabled}
                          maxLength={300}
                          placeholder="Ingrese el nombre del almacén"
                        />
                      </div>

                      <div className="donation-field">
                        <label htmlFor={`${warehouse.id}-supplier`}>Nombre del proveedor</label>
                        <input
                          id={`${warehouse.id}-supplier`}
                          value={warehouse.supplierName}
                          onChange={(event) => updateWarehouse(warehouse.id, (current) => ({
                            ...current,
                            supplierName: event.target.value,
                          }))}
                          disabled={disabled}
                          maxLength={300}
                          placeholder="Ingrese el nombre del proveedor"
                        />
                      </div>

                      <div className="donation-field">
                        <label htmlFor={`${warehouse.id}-date`}>Fecha de recepción de la donación</label>
                        <DatePicker
                          id={`${warehouse.id}-date`}
                          value={warehouse.receptionDate}
                          onChange={(receptionDate) => updateWarehouse(warehouse.id, (current) => ({
                            ...current,
                            receptionDate,
                          }))}
                          disabled={disabled}
                        />
                      </div>

                      <div className="donation-field donation-field--wide">
                        <label htmlFor={`${warehouse.id}-description`}>Descripción de la donación</label>
                        <textarea
                          id={`${warehouse.id}-description`}
                          rows={3}
                          maxLength={5000}
                          value={warehouse.description}
                          onChange={(event) => updateWarehouse(warehouse.id, (current) => ({
                            ...current,
                            description: event.target.value,
                          }))}
                          disabled={disabled}
                          placeholder="Describa la donación recibida en este almacén"
                        />
                      </div>
                    </div>

                    <section className="donation-products" aria-labelledby={`${warehouse.id}-products-title`}>
                      <div className="donation-products-heading">
                        <div>
                          <h5 id={`${warehouse.id}-products-title`}>Productos asociados</h5>
                          <p>Agregue los productos asociados exclusivamente a este almacén.</p>
                        </div>
                      </div>

                      {warehouse.products.length === 0 ? (
                        <p className="donation-products-empty">
                          Aún no hay productos registrados para este almacén.
                        </p>
                      ) : (
                        <ol className="donation-product-list">
                          {warehouse.products.map((product, productIndex) => {
                            const total = calculateProductTotal(product)

                            return (
                              <li
                                className={`donation-product-row${product.editing ? ' is-editing' : ''}`}
                                key={product.id}
                              >
                                <div className="donation-product-main">
                                  {product.editing ? (
                                    <div className="donation-product-main-fields">
                                      <div className="donation-field">
                                        <label htmlFor={`${product.id}-product`}>Producto</label>
                                        <input
                                          id={`${product.id}-product`}
                                          value={product.productName}
                                          onChange={(event) => updateProduct(
                                            warehouse.id,
                                            product.id,
                                            (current) => ({ ...current, productName: event.target.value }),
                                          )}
                                          maxLength={500}
                                          disabled={disabled}
                                          placeholder="Nombre del producto"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="donation-product-identity">
                                      <strong>{product.productName || `Producto ${productIndex + 1}`}</strong>
                                    </span>
                                  )}
                                </div>

                                <div className="donation-product-cell donation-product-brand">
                                  <span>Marca</span>
                                  {product.editing ? (
                                    <input
                                      id={`${product.id}-brand`}
                                      aria-label="Marca"
                                      value={product.brandName}
                                      onChange={(event) => updateProduct(
                                        warehouse.id,
                                        product.id,
                                        (current) => ({ ...current, brandName: event.target.value }),
                                      )}
                                      maxLength={300}
                                      disabled={disabled}
                                      placeholder="Marca"
                                    />
                                  ) : <strong>{product.brandName || 'Sin indicar'}</strong>}
                                </div>

                                <div className="donation-product-cell donation-product-quantity">
                                  <span>Cantidad</span>
                                  {product.editing ? (
                                      <input
                                        id={`${product.id}-quantity`}
                                        aria-label="Cantidad"
                                        type="number"
                                        min="0"
                                        step="1"
                                        inputMode="numeric"
                                        value={product.quantity}
                                        onChange={(event) => {
                                          const quantity = event.target.value
                                          if (quantity === '' || Number(quantity) >= 0) {
                                            updateProduct(warehouse.id, product.id, (current) => ({
                                              ...current,
                                              quantity,
                                            }))
                                          }
                                        }}
                                        disabled={disabled}
                                        placeholder="0"
                                      />
                                  ) : <strong>{product.quantity || '0'}</strong>}
                                </div>

                                <div className="donation-product-cell">
                                  <span>Precio unitario</span>
                                  {product.editing ? (
                                      <div className="donation-money-input">
                                        <span aria-hidden="true">$</span>
                                        <input
                                          id={`${product.id}-unit-price`}
                                          aria-label="Precio unitario"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          inputMode="decimal"
                                          value={product.unitPrice}
                                          onChange={(event) => {
                                            const unitPrice = event.target.value
                                            if (unitPrice === '' || Number(unitPrice) >= 0) {
                                              updateProduct(warehouse.id, product.id, (current) => ({
                                                ...current,
                                                unitPrice,
                                              }))
                                            }
                                          }}
                                          onBlur={() => {
                                            if (product.unitPrice === '') return
                                            updateProduct(warehouse.id, product.id, (current) => ({
                                              ...current,
                                              unitPrice: Number(current.unitPrice).toFixed(2),
                                            }))
                                          }}
                                          disabled={disabled}
                                          placeholder="0.00"
                                        />
                                      </div>
                                  ) : <strong>{formatUsd(multiplyToCents('1', product.unitPrice))}</strong>}
                                </div>

                                <div className="donation-product-cell donation-product-row-total">
                                  <span>Total</span>
                                  <strong>{formatUsd(total)}</strong>
                                </div>

                                <div className="donation-product-row-actions">
                                  <span>Acciones</span>
                                  <div>
                                    <button
                                      type="button"
                                      className={`donation-product-action-button ${product.editing ? 'is-confirm' : 'is-edit'}`}
                                      onClick={() => updateProduct(
                                        warehouse.id,
                                        product.id,
                                        (current) => ({ ...current, editing: !current.editing }),
                                      )}
                                      disabled={disabled}
                                      aria-label={product.editing ? 'Finalizar edición del producto' : 'Editar producto'}
                                      title={product.editing ? 'Listo' : 'Editar producto'}
                                    >
                                      {product.editing ? <CheckIcon /> : <PencilIcon />}
                                    </button>
                                    <button
                                      type="button"
                                      className="donation-product-action-button is-remove"
                                      onClick={() => removeProduct(warehouse.id, product.id)}
                                      disabled={disabled}
                                      aria-label="Quitar producto"
                                      title="Quitar producto"
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            )
                          })}
                        </ol>
                      )}

                      <div className="donation-warehouse-total" aria-live="polite">
                        <span>Total del almacén</span>
                        <strong>{formatUsd(warehouseTotal)}</strong>
                      </div>
                    </section>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="donation-grand-total" aria-live="polite">
        <span>
          <small>Resumen de la Sección 6</small>
          <strong>Total general de la donación</strong>
        </span>
        <b>{formatUsd(donationTotal)}</b>
      </div>
    </div>
  )
}

export default DonationWarehousesSection
