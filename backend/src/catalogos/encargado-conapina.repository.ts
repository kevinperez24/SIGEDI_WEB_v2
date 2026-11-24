import { TextCodec } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getPersonalSurreal } from '../database/personal-surreal.ts'

export type ConapinaReceptionManager = {
  id: string
  nombre: string
  cargo: string
}

const LIST_RECEPTION_MANAGERS_QUERY = `
  SELECT
    id,
    Nombres,
    Apellidos,
    string::concat(Nombres, " ", Apellidos) AS nombre,
    plaza AS cargo
  FROM Personal
  ORDER BY Nombres ASC, Apellidos ASC;
`

const FIND_RECEPTION_MANAGER_QUERY = `
  SELECT
    id,
    string::concat(Nombres, " ", Apellidos) AS nombre,
    plaza AS cargo
  FROM Personal
  WHERE id = $personal_id
  LIMIT 1;
`

function personalRecordId(value: string) {
  const recordId = TextCodec.parseRecordId(value)
  if (recordId.table.name !== 'Personal') throw new Error()
  return recordId
}

function mapManager(record: Record<string, unknown>): ConapinaReceptionManager {
  return {
    id: String(record.id),
    nombre: String(record.nombre ?? '').trim(),
    cargo: String(record.cargo ?? '').trim(),
  }
}

export class ConapinaReceptionManagerRepository {
  async list(): Promise<ConapinaReceptionManager[]> {
    try {
      const database = await getPersonalSurreal()
      const [records] = await database.query<[Record<string, unknown>[]]>(
        LIST_RECEPTION_MANAGERS_QUERY,
      )
      return records.map(mapManager)
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }

  async findById(value: string): Promise<ConapinaReceptionManager | null> {
    let recordId: ReturnType<typeof personalRecordId>
    try {
      recordId = personalRecordId(value)
    } catch {
      return null
    }

    try {
      const database = await getPersonalSurreal()
      const [records] = await database.query<[Record<string, unknown>[]]>(
        FIND_RECEPTION_MANAGER_QUERY,
        { personal_id: recordId },
      )
      return records[0] ? mapManager(records[0]) : null
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }
}
