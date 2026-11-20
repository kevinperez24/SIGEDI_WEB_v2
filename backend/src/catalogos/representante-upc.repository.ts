import { TextCodec } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'

export type UpcRepresentative = {
  id: string
  codigo: string
  nombre: string
}

const LIST_ACTIVE_REPRESENTATIVES_QUERY = `
  SELECT id, codigo, nombre
  FROM catalogo_representantes_upc
  WHERE activo = true
  ORDER BY codigo ASC;
`

const VALIDATE_REPRESENTATIVE_QUERY = `
  SELECT id
  FROM catalogo_representantes_upc
  WHERE id = $representante_id AND activo = true
  LIMIT 1;
`

function representativeRecordId(value: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== 'catalogo_representantes_upc') throw new Error()
  return recordId
}

export class UpcRepresentativeCatalogRepository {
  async listActive(): Promise<UpcRepresentative[]> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[
        { id: unknown; codigo?: unknown; nombre?: unknown }[],
      ]>(LIST_ACTIVE_REPRESENTATIVES_QUERY)
      return records.map((record) => ({
        id: String(record.id),
        codigo: String(record.codigo ?? ''),
        nombre: String(record.nombre ?? ''),
      }))
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }

  async validateActiveId(value: string): Promise<boolean> {
    let recordId: ReturnType<typeof representativeRecordId>
    try {
      recordId = representativeRecordId(value)
    } catch {
      return false
    }

    try {
      const database = await getSurreal()
      const [records] = await database.query<[{ id: unknown }[]]>(
        VALIDATE_REPRESENTATIVE_QUERY,
        { representante_id: recordId },
      )
      return records.length === 1 && String(records[0]?.id) === String(recordId)
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }
}
