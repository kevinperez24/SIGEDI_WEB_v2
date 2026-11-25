import { randomUUID } from 'node:crypto'
import { DateTime, Decimal, RecordId, TextCodec } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'
import type {
  DonationIncome,
  DonationIncomeInput,
  DonationIncomeProduct,
} from './donativo-income.types.ts'
import { calculateIncomeProductTotal } from './donativo-income.types.ts'

const FIND_DONATION_QUERY = `SELECT id FROM donativos WHERE id = $donativo_id LIMIT 1;`
const FIND_INCOME_QUERY = `
  SELECT * FROM incomes
  WHERE id = $income_id AND donativo_id = $donativo_id
  LIMIT 1;
`
const LIST_PRODUCTS_QUERY = `
  SELECT * FROM detincomes
  WHERE income_id IN $income_ids
  ORDER BY created_at ASC;
`

type IncomeRecord = Record<string, unknown> & { id: unknown; donativo_id: unknown }
type ProductRecord = Record<string, unknown> & { id: unknown; income_id: unknown }

function logQueryFailure(operation: string, error: unknown): void {
  if (process.env.NODE_ENV === 'production') return
  const message = error instanceof Error ? error.message : 'Error desconocido de SurrealDB.'
  console.error(`[donativo_incomes] ${operation}: ${message}`)
}

function recordId(value: string, table: string) {
  const parsed = TextCodec.parseRecordId(value)
  if (parsed.table.name !== table) throw new DatabaseQueryError()
  return parsed
}

function newRecordId(table: 'incomes' | 'detincomes') {
  return new RecordId(table, randomUUID())
}

function mapProduct(record: ProductRecord): DonationIncomeProduct {
  return {
    id: String(record.id),
    income_id: String(record.income_id),
    brand_name: String(record.brand_name ?? ''),
    name_product: String(record.name_product ?? ''),
    amount: Number(record.amount ?? 0),
    price: Number(record.price ?? 0),
    total_price: Number(record.total_price ?? 0),
    created_by: String(record.created_by ?? ''),
    created_at: String(record.created_at ?? ''),
    updated_by: record.updated_by ? String(record.updated_by) : null,
    updated_at: String(record.updated_at ?? ''),
  }
}

function mapIncome(record: IncomeRecord, products: DonationIncomeProduct[]): DonationIncome {
  return {
    id: String(record.id),
    donativo_id: String(record.donativo_id),
    nombre_almacen: String(record.nombre_almacen ?? ''),
    nombre_proveedor: String(record.nombre_proveedor ?? ''),
    fecha_recepcion_donacion: String(record.fecha_recepcion_donacion ?? ''),
    description: String(record.description ?? ''),
    created_by: String(record.created_by ?? ''),
    created_at: String(record.created_at ?? ''),
    updated_by: record.updated_by ? String(record.updated_by) : null,
    updated_at: String(record.updated_at ?? ''),
    productos: products,
  }
}

function buildProductStatements(
  products: DonationIncomeInput['productos'],
  incomeId: ReturnType<typeof recordId>,
  currentUser: string,
): { query: string; bindings: Record<string, unknown> } {
  const bindings: Record<string, unknown> = {}
  const statements = products.map((product, index) => {
    const productId = product.id
      ? recordId(product.id, 'detincomes')
      : newRecordId('detincomes')
    bindings[`product_id_${index}`] = productId
    bindings[`brand_name_${index}`] = product.brand_name
    bindings[`name_product_${index}`] = product.name_product
    bindings[`amount_${index}`] = new Decimal(String(product.amount))
    bindings[`price_${index}`] = new Decimal(String(product.price))
    bindings[`total_price_${index}`] = new Decimal(
      String(calculateIncomeProductTotal(product.amount, product.price)),
    )
    bindings[`product_created_by_${index}`] = currentUser
    bindings[`product_income_id_${index}`] = incomeId
    bindings[`product_updated_by_${index}`] = currentUser
    return product.id
      ? `
      UPDATE $product_id_${index} MERGE {
        brand_name: $brand_name_${index},
        name_product: $name_product_${index},
        amount: $amount_${index},
        price: $price_${index},
        total_price: $total_price_${index},
        updated_by: $product_updated_by_${index}
      };
    `
      : `
      CREATE $product_id_${index} CONTENT {
        income_id: $product_income_id_${index},
        brand_name: $brand_name_${index},
        name_product: $name_product_${index},
        amount: $amount_${index},
        price: $price_${index},
        total_price: $total_price_${index},
        created_by: $product_created_by_${index},
        updated_by: NONE
      };
    `
  })
  return { query: statements.join('\n'), bindings }
}

export interface DonationIncomeRepository {
  create(donativoId: string, createdBy: string, input: DonationIncomeInput): Promise<DonationIncome | null>
  list(donativoId: string): Promise<DonationIncome[] | null>
  update(
    donativoId: string,
    incomeId: string,
    updatedBy: string,
    input: DonationIncomeInput,
  ): Promise<DonationIncome | null>
  delete(donativoId: string, incomeId: string): Promise<boolean>
}

export class SurrealDonationIncomeRepository implements DonationIncomeRepository {
  async create(
    donativoId: string,
    createdBy: string,
    input: DonationIncomeInput,
  ): Promise<DonationIncome | null> {
    let createdIncomeId: ReturnType<typeof newRecordId> | undefined
    try {
      const database = await getSurreal()
      const donationId = recordId(donativoId, 'donativos')
      recordId(createdBy, 'usuarios')
      const [donations] = await database.query<[{ id: unknown }[]]>(FIND_DONATION_QUERY, {
        donativo_id: donationId,
      })
      if (!donations[0]) return null

      const incomeId = newRecordId('incomes')
      createdIncomeId = incomeId
      const productStatements = buildProductStatements(input.productos, incomeId, createdBy)
      await database.query(
        `
          CREATE $income_id CONTENT {
            donativo_id: $donativo_id,
            nombre_almacen: $nombre_almacen,
            nombre_proveedor: $nombre_proveedor,
            fecha_recepcion_donacion: $fecha_recepcion_donacion,
            description: $description,
            created_by: $created_by,
            updated_by: NONE
          };
        `,
        {
          income_id: incomeId,
          donativo_id: donationId,
          nombre_almacen: input.nombre_almacen,
          nombre_proveedor: input.nombre_proveedor,
          fecha_recepcion_donacion: new DateTime(`${input.fecha_recepcion_donacion}T00:00:00.000Z`),
          description: input.description,
          created_by: createdBy,
          ...productStatements.bindings,
        },
      )
      if (input.productos.length > 0) {
        await database.query(
          `
            BEGIN TRANSACTION;
            ${productStatements.query}
            COMMIT TRANSACTION;
          `,
          productStatements.bindings,
        )
      }
      const created = await this.findOwned(database, donationId, incomeId)
      if (!created) throw new DatabaseQueryError()
      return created
    } catch (error) {
      if (createdIncomeId) {
        const database = await getSurreal().catch(() => null)
        await database?.query(
          `
            DELETE detincomes WHERE income_id = $income_id;
            DELETE $income_id;
          `,
          { income_id: createdIncomeId },
        ).catch(() => undefined)
      }
      logQueryFailure('create', error)
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) throw error
      throw new DatabaseQueryError()
    }
  }

  async list(donativoId: string): Promise<DonationIncome[] | null> {
    try {
      const database = await getSurreal()
      const donationId = recordId(donativoId, 'donativos')
      const [donations] = await database.query<[{ id: unknown }[]]>(FIND_DONATION_QUERY, {
        donativo_id: donationId,
      })
      if (!donations[0]) return null
      const [incomes] = await database.query<[IncomeRecord[]]>(
        `SELECT * FROM incomes WHERE donativo_id = $donativo_id ORDER BY created_at ASC;`,
        { donativo_id: donationId },
      )
      if (incomes.length === 0) return []
      const incomeIds = incomes.map((income) => income.id)
      const [products] = await database.query<[ProductRecord[]]>(LIST_PRODUCTS_QUERY, {
        income_ids: incomeIds,
      })
      const mappedProducts = products.map(mapProduct)
      return incomes.map((income) => mapIncome(
        income,
        mappedProducts.filter((product) => product.income_id === String(income.id)),
      ))
    } catch (error) {
      logQueryFailure('list', error)
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) throw error
      throw new DatabaseQueryError()
    }
  }

  async update(
    donativoId: string,
    incomeIdValue: string,
    updatedBy: string,
    input: DonationIncomeInput,
  ): Promise<DonationIncome | null> {
    try {
      const database = await getSurreal()
      const donationId = recordId(donativoId, 'donativos')
      const incomeId = recordId(incomeIdValue, 'incomes')
      recordId(updatedBy, 'usuarios')
      const existing = await this.findOwned(database, donationId, incomeId)
      if (!existing) return null
      const existingProductIds = new Set(existing.productos.map((product) => product.id))
      if (input.productos.some((product) => product.id && !existingProductIds.has(product.id))) {
        return null
      }
      const retainedProductIds = input.productos.flatMap((product) => (
        product.id ? [recordId(product.id, 'detincomes')] : []
      ))
      const productStatements = buildProductStatements(input.productos, incomeId, updatedBy)
      await database.query(
        `
          UPDATE $income_id MERGE {
            nombre_almacen: $nombre_almacen,
            nombre_proveedor: $nombre_proveedor,
            fecha_recepcion_donacion: $fecha_recepcion_donacion,
            description: $description,
            updated_by: $updated_by
          };
        `,
        {
          income_id: incomeId,
          nombre_almacen: input.nombre_almacen,
          nombre_proveedor: input.nombre_proveedor,
          fecha_recepcion_donacion: new DateTime(`${input.fecha_recepcion_donacion}T00:00:00.000Z`),
          description: input.description,
          updated_by: updatedBy,
        },
      )
      await database.query(
        `
          BEGIN TRANSACTION;
          DELETE detincomes
          WHERE income_id = $income_id AND id NOT IN $retained_product_ids;
          ${productStatements.query}
          COMMIT TRANSACTION;
        `,
        {
          income_id: incomeId,
          retained_product_ids: retainedProductIds,
          ...productStatements.bindings,
        },
      )
      return this.findOwned(database, donationId, incomeId)
    } catch (error) {
      logQueryFailure('update', error)
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) throw error
      throw new DatabaseQueryError()
    }
  }

  async delete(donativoId: string, incomeIdValue: string): Promise<boolean> {
    try {
      const database = await getSurreal()
      const donationId = recordId(donativoId, 'donativos')
      const incomeId = recordId(incomeIdValue, 'incomes')
      if (!(await this.findOwned(database, donationId, incomeId))) return false
      await database.query(
        `
          BEGIN TRANSACTION;
          DELETE detincomes WHERE income_id = $income_id;
          DELETE $income_id;
          COMMIT TRANSACTION;
        `,
        { income_id: incomeId },
      )
      return true
    } catch (error) {
      logQueryFailure('delete', error)
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) throw error
      throw new DatabaseQueryError()
    }
  }

  private async findOwned(
    database: Awaited<ReturnType<typeof getSurreal>>,
    donationId: ReturnType<typeof recordId>,
    incomeId: ReturnType<typeof recordId>,
  ): Promise<DonationIncome | null> {
    const [incomes] = await database.query<[IncomeRecord[]]>(FIND_INCOME_QUERY, {
      donativo_id: donationId,
      income_id: incomeId,
    })
    const income = incomes[0]
    if (!income) return null
    const [products] = await database.query<[ProductRecord[]]>(
      `SELECT * FROM detincomes WHERE income_id = $income_id ORDER BY created_at ASC;`,
      { income_id: incomeId },
    )
    return mapIncome(income, products.map(mapProduct))
  }
}
