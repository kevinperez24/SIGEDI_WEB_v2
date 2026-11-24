import { TextCodec } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'

export type CityCatalogItem = {
  id: string
  codigo: string
  ciudad: string
  departamento: string
}

const LIST_ACTIVE_CITIES_QUERY = `
  SELECT id, codigo, ciudad, departamento
  FROM catalogo_ciudades_departamentos
  WHERE activo = true
  ORDER BY ciudad ASC;
`

const VALIDATE_CITY_QUERY = `
  SELECT id
  FROM catalogo_ciudades_departamentos
  WHERE id = $ciudad_id AND activo = true
  LIMIT 1;
`

function cityRecordId(value: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== 'catalogo_ciudades_departamentos') throw new Error()
  return recordId
}

export class CityCatalogRepository {
  async listActive(): Promise<CityCatalogItem[]> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[
        { id: unknown; codigo?: unknown; ciudad?: unknown; departamento?: unknown }[],
      ]>(LIST_ACTIVE_CITIES_QUERY)
      return records.map((record) => ({
        id: String(record.id),
        codigo: String(record.codigo ?? ''),
        ciudad: String(record.ciudad ?? ''),
        departamento: String(record.departamento ?? ''),
      }))
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }

  async validateActiveId(value: string): Promise<boolean> {
    let recordId: ReturnType<typeof cityRecordId>
    try {
      recordId = cityRecordId(value)
    } catch {
      return false
    }

    try {
      const database = await getSurreal()
      const [records] = await database.query<[{ id: unknown }[]]>(VALIDATE_CITY_QUERY, {
        ciudad_id: recordId,
      })
      return records.length === 1 && String(records[0]?.id) === String(recordId)
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }
}
