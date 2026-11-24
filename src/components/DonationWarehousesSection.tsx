import DatePicker from './form/DatePicker'
import FormSelect from './form/FormSelect'
import type { Section5CatalogItem } from '../services/donations'
import './DonationWarehousesSection.css'

export type DonationWarehouseProductDraft = {
  id: string
  brandId: string
  productId: string
  quantity: string
  unitPrice: string
  editing: boolean
}

export type ProductBrandCatalogItem = {
  id: string
  nombre: string
}

export type ProductCatalogItem = {
  id: string
  nombre: string
  brandId: string
}

export type DonationWarehouseDraft = {
  id: string
  warehouseId: string
  supplierId: string
  receptionDate: string
  description: string
  expanded: boolean
  products: DonationWarehouseProductDraft[]
}

type DonationWarehousesSectionProps = {
  value: DonationWarehouseDraft[]
  warehouses: readonly Section5CatalogItem[]
  onChange: (value: DonationWarehouseDraft[]) => void
  disabled?: boolean
  warehousesLoading?: boolean
  warehousesError?: string
  onRetryWarehouses?: () => void
  brands?: readonly ProductBrandCatalogItem[]
  products?: readonly ProductCatalogItem[]
}

let temporaryIdSequence = 0

function createTemporaryId(prefix: 'warehouse' | 'product'): string {
  temporaryIdSequence += 1
  return `${prefix}-${Date.now()}-${temporaryIdSequence}`
}

function createWarehouse(): DonationWarehouseDraft {
  return {
    id: createTemporaryId('warehouse'),
    warehouseId: '',
    supplierId: '',
    receptionDate: '',
    description: '',
    expanded: true,
    products: [],
  }
}

function createProduct(): DonationWarehouseProductDraft {
  return {
    id: createTemporaryId('product'),
    brandId: '',
    productId: '',
    quantity: '',
    unitPrice: '',
    editing: true,
  }
}

function calculateProductTotal(product: DonationWarehouseProductDraft): number {
  const quantity = Number(product.quantity)
  const unitPrice = Number(product.unitPrice)
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0
  return Math.max(0, quantity) * Math.max(0, unitPrice)
}

function formatUsd(value: number): string {
  return `$ ${value.toFixed(2)}`
}

function hasWarehouseData(warehouse: DonationWarehouseDraft): boolean {
  return Boolean(
    warehouse.warehouseId
      || warehouse.supplierId
      || warehouse.receptionDate
      || warehouse.description.trim()
      || warehouse.products.length,
  )
}

function DonationWarehousesSection({
  value,
  warehouses,
  onChange,
  disabled = false,
  warehousesLoading = false,
  warehousesError = '',
  onRetryWarehouses,
  brands = [],
  products = [],
}: DonationWarehousesSectionProps) {
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
    updateWarehouse(warehouseId, (warehouse) => ({
      ...warehouse,
      products: warehouse.products.filter((product) => product.id !== productId),
    }))
  }

  return (
    <div className="donation-warehouses">
      <div className="donation-warehouses-toolbar">
        <div>
          <h4>Almacenes asociados</h4>
          <p>Organice los productos de la donación por almacén.</p>
        </div>
        <button
          className="modal-primary-button donation-warehouse-add"
          type="button"
          onClick={() => onChange([...value, createWarehouse()])}
          disabled={disabled}
        >
          <span aria-hidden="true">＋</span>
          Agregar almacén
        </button>
      </div>

      <p className="donation-warehouses-notice" role="note">
        Vista previa frontend. Esta sección aún no se incluye en el guardado del donativo.
      </p>

      {value.length === 0 ? (
        <div className="donation-warehouses-empty">
          <strong>Sin almacenes agregados</strong>
          <span>Agregue un almacén para organizar sus productos.</span>
        </div>
      ) : (
        <div className="donation-warehouse-list">
          {value.map((warehouse, warehouseIndex) => {
            const contentId = `${warehouse.id}-content`
            return (
              <article
                className={`donation-warehouse-card${warehouse.expanded ? '' : ' is-collapsed'}`}
                key={warehouse.id}
              >
                <header className="donation-warehouse-card-header">
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
                    <span className="donation-warehouse-number">{warehouseIndex + 1}</span>
                    <span>
                      <strong>Almacén {warehouseIndex + 1}</strong>
                      <small>{warehouse.products.length} producto{warehouse.products.length === 1 ? '' : 's'}</small>
                    </span>
                    <span className="donation-warehouse-chevron" aria-hidden="true">⌄</span>
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
                </header>

                <div className="donation-warehouse-card-content" id={contentId}>
                  <div className="donation-warehouse-card-content-inner">
                    <div className="donation-warehouse-fields">
                      <div className="donation-field">
                        <label htmlFor={`${warehouse.id}-warehouse`}>Seleccionar almacén</label>
                        <FormSelect
                          id={`${warehouse.id}-warehouse`}
                          value={warehouse.warehouseId}
                          options={warehouses.map((item) => ({ value: item.id, label: item.nombre }))}
                          onChange={(warehouseId) => updateWarehouse(warehouse.id, (current) => ({
                            ...current,
                            warehouseId,
                          }))}
                          placeholder="Seleccione un almacén"
                          searchable
                          disabled={disabled}
                          loading={warehousesLoading}
                          error={warehousesError}
                          onRetry={onRetryWarehouses}
                        />
                      </div>

                      <div className="donation-field">
                        <label htmlFor={`${warehouse.id}-supplier`}>Seleccionar proveedor</label>
                        <FormSelect
                          id={`${warehouse.id}-supplier`}
                          value={warehouse.supplierId}
                          options={[]}
                          onChange={() => undefined}
                          placeholder="Catálogo no disponible"
                          disabled
                        />
                        <small className="donation-warehouse-catalog-note">
                          Catálogo de proveedores pendiente de integración.
                        </small>
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
                          <h5 id={`${warehouse.id}-products-title`}>Productos</h5>
                          <p>Agregue los productos asociados exclusivamente a este almacén.</p>
                        </div>
                        <button
                          className="modal-secondary-button"
                          type="button"
                          onClick={() => addProduct(warehouse.id)}
                          disabled={disabled}
                        >
                          Agregar producto
                        </button>
                      </div>

                      {warehouse.products.length === 0 ? (
                        <p className="donation-products-empty">Aún no hay productos en este almacén.</p>
                      ) : (
                        <ol className="donation-product-list">
                          {warehouse.products.map((product, productIndex) => {
                            const availableProducts = product.brandId
                              ? products.filter((item) => item.brandId === product.brandId)
                              : []
                            const selectedBrand = brands.find((item) => item.id === product.brandId)
                            const selectedProduct = products.find((item) => item.id === product.productId)
                            const total = calculateProductTotal(product)

                            return (
                              <li className="donation-product-card" key={product.id}>
                                <header className="donation-product-card-header">
                                  <span className="donation-product-number">{productIndex + 1}</span>
                                  <span>
                                    <strong>{selectedProduct?.nombre ?? `Producto ${productIndex + 1}`}</strong>
                                    <small>{selectedBrand?.nombre ?? 'Marca sin seleccionar'}</small>
                                  </span>
                                  <div className="donation-product-actions">
                                    <button
                                      type="button"
                                      onClick={() => updateProduct(
                                        warehouse.id,
                                        product.id,
                                        (current) => ({ ...current, editing: !current.editing }),
                                      )}
                                      disabled={disabled}
                                    >
                                      {product.editing ? 'Listo' : 'Editar'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeProduct(warehouse.id, product.id)}
                                      disabled={disabled}
                                      aria-label={`Quitar producto ${productIndex + 1} del almacén ${warehouseIndex + 1}`}
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                </header>

                                {product.editing ? (
                                  <div className="donation-product-fields">
                                    <div className="donation-field">
                                      <label htmlFor={`${product.id}-brand`}>Marcas disponibles</label>
                                      <FormSelect
                                        id={`${product.id}-brand`}
                                        value={product.brandId}
                                        options={brands.map((item) => ({ value: item.id, label: item.nombre }))}
                                        onChange={(brandId) => updateProduct(
                                          warehouse.id,
                                          product.id,
                                          (current) => ({ ...current, brandId, productId: '' }),
                                        )}
                                        placeholder={brands.length ? 'Seleccione una marca' : 'Sin marcas disponibles'}
                                        disabled={disabled || brands.length === 0}
                                      />
                                      {brands.length === 0 && (
                                        <small className="donation-product-catalog-note">
                                          Catálogo de marcas pendiente de integración.
                                        </small>
                                      )}
                                    </div>

                                    <div className="donation-field">
                                      <label htmlFor={`${product.id}-product`}>Productos disponibles</label>
                                      <FormSelect
                                        id={`${product.id}-product`}
                                        value={product.productId}
                                        options={availableProducts.map((item) => ({
                                          value: item.id,
                                          label: item.nombre,
                                        }))}
                                        onChange={(productId) => updateProduct(
                                          warehouse.id,
                                          product.id,
                                          (current) => ({ ...current, productId }),
                                        )}
                                        placeholder={product.brandId
                                          ? 'Sin productos disponibles'
                                          : 'Seleccione primero una marca'}
                                        searchable
                                        noResultsText="Sin coincidencias"
                                        disabled={disabled || !product.brandId || availableProducts.length === 0}
                                      />
                                      {products.length === 0 && (
                                        <small className="donation-product-catalog-note">
                                          Catálogo de productos pendiente de integración.
                                        </small>
                                      )}
                                    </div>

                                    <div className="donation-field">
                                      <label htmlFor={`${product.id}-quantity`}>Cantidad</label>
                                      <input
                                        id={`${product.id}-quantity`}
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
                                    </div>

                                    <div className="donation-field">
                                      <label htmlFor={`${product.id}-unit-price`}>Precio unitario</label>
                                      <div className="donation-money-input">
                                        <span aria-hidden="true">$</span>
                                        <input
                                          id={`${product.id}-unit-price`}
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
                                    </div>

                                    <div className="donation-field donation-product-total">
                                      <label htmlFor={`${product.id}-total`}>Total</label>
                                      <input
                                        id={`${product.id}-total`}
                                        value={formatUsd(total)}
                                        readOnly
                                        aria-readonly="true"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <dl className="donation-product-summary">
                                    <div><dt>Cantidad</dt><dd>{product.quantity || '0'}</dd></div>
                                    <div><dt>Precio unitario</dt><dd>{formatUsd(Number(product.unitPrice) || 0)}</dd></div>
                                    <div><dt>Total</dt><dd>{formatUsd(total)}</dd></div>
                                  </dl>
                                )}
                              </li>
                            )
                          })}
                        </ol>
                      )}
                    </section>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DonationWarehousesSection
