import { TextCodec } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'

export type Section5CatalogItem = {
  id: string
  codigo: string
  nombre: string
}

type CatalogDefinition = {
  table: string
  listQuery: string
  validateOneQuery: string
  validateManyQuery: string
}

const definitions = {
  safekeepingWarehouse: {
    table: 'catalogo_almacenes_resguardo',
    listQuery: `SELECT id, codigo, nombre FROM catalogo_almacenes_resguardo WHERE activo = true ORDER BY codigo ASC;`,
    validateOneQuery: `SELECT id FROM catalogo_almacenes_resguardo WHERE id = $catalog_id AND activo = true LIMIT 1;`,
    validateManyQuery: '',
  },
  distributionPlace: {
    table: 'catalogo_lugares_distribucion',
    listQuery: `SELECT id, codigo, nombre FROM catalogo_lugares_distribucion WHERE activo = true ORDER BY codigo ASC;`,
    validateOneQuery: '',
    validateManyQuery: `SELECT id FROM catalogo_lugares_distribucion WHERE id IN $catalog_ids AND activo = true;`,
  },
  destinationWarehouse: {
    table: 'catalogo_almacenes_destino',
    listQuery: `SELECT id, codigo, nombre FROM catalogo_almacenes_destino WHERE activo = true ORDER BY codigo ASC;`,
    validateOneQuery: `SELECT id FROM catalogo_almacenes_destino WHERE id = $catalog_id AND activo = true LIMIT 1;`,
    validateManyQuery: '',
  },
} satisfies Record<string, CatalogDefinition>

function parseCatalogId(value: string, table: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== table) throw new Error()
  return recordId
}

function mapItem(record: { id: unknown; codigo?: unknown; nombre?: unknown }): Section5CatalogItem {
  return {
    id: String(record.id),
    codigo: String(record.codigo ?? ''),
    nombre: String(record.nombre ?? ''),
  }
}

class Section5CatalogRepository {
  constructor(private readonly definition: CatalogDefinition) {}

  async listActive(): Promise<Section5CatalogItem[]> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[
        { id: unknown; codigo?: unknown; nombre?: unknown }[],
      ]>(this.definition.listQuery)
      return records.map(mapItem)
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }

  async validateActiveId(value: string): Promise<boolean> {
    let recordId: ReturnType<typeof parseCatalogId>
    try {
      recordId = parseCatalogId(value, this.definition.table)
    } catch {
      return false
    }

    try {
      const database = await getSurreal()
      const [records] = await database.query<[{ id: unknown }[]]>(
        this.definition.validateOneQuery,
        { catalog_id: recordId },
      )
      return records.length === 1 && String(records[0]?.id) === String(recordId)
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }

  async validateActiveIds(values: string[]): Promise<boolean> {
    let recordIds: ReturnType<typeof parseCatalogId>[]
    try {
      recordIds = values.map((value) => parseCatalogId(value, this.definition.table))
    } catch {
      return false
    }

    const canonicalIds = recordIds.map(String)
    if (new Set(canonicalIds).size !== canonicalIds.length) return false

    try {
      const database = await getSurreal()
      const [records] = await database.query<[{ id: unknown }[]]>(
        this.definition.validateManyQuery,
        { catalog_ids: recordIds },
      )
      return (
        records.length === canonicalIds.length &&
        records.every((record) => canonicalIds.includes(String(record.id)))
      )
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }
}

export const safekeepingWarehouseCatalogRepository = new Section5CatalogRepository(
  definitions.safekeepingWarehouse,
)
export const distributionPlaceCatalogRepository = new Section5CatalogRepository(
  definitions.distributionPlace,
)
export const destinationWarehouseCatalogRepository = new Section5CatalogRepository(
  definitions.destinationWarehouse,
)
