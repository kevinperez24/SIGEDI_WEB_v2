import { TextCodec } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'

export type ReceptionPlace = {
  id: string
  codigo: string
  nombre: string
}

const LIST_ACTIVE_RECEPTION_PLACES_QUERY = `
  SELECT id, codigo, nombre
  FROM catalogo_lugares_recepcion
  WHERE activo = true
  ORDER BY codigo ASC;
`

const VALIDATE_RECEPTION_PLACES_QUERY = `
  SELECT id
  FROM catalogo_lugares_recepcion
  WHERE id IN $lugar_ids AND activo = true;
`

function receptionPlaceRecordId(value: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== 'catalogo_lugares_recepcion') throw new Error()
  return recordId
}

export class ReceptionPlaceCatalogRepository {
  async listActive(): Promise<ReceptionPlace[]> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[
        { id: unknown; codigo?: unknown; nombre?: unknown }[],
      ]>(LIST_ACTIVE_RECEPTION_PLACES_QUERY)
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

  async validateActiveIds(values: string[]): Promise<boolean> {
    let recordIds: ReturnType<typeof receptionPlaceRecordId>[]

    try {
      recordIds = values.map(receptionPlaceRecordId)
    } catch {
      return false
    }

    const canonicalIds = recordIds.map(String)
    if (new Set(canonicalIds).size !== canonicalIds.length) return false

    try {
      const database = await getSurreal()
      const [records] = await database.query<[{ id: unknown }[]]>(
        VALIDATE_RECEPTION_PLACES_QUERY,
        { lugar_ids: recordIds },
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
