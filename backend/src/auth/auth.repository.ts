import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'
import type { DatabaseUser } from './auth.types.ts'

const FIND_USER_QUERY = `
  SELECT
    id,
    usuario,
    nombres,
    apellidos,
    correo,
    roles,
    estado,
    intentos_fallidos,
    ultimo_login,
    bloqueo_hasta,
    cambio_password_requerido,
    crypto::argon2::compare(password_hash, $password) AS password_correcta
  FROM usuarios
  WHERE usuario = $usuario
  LIMIT 1;
`

const RECORD_FAILED_ATTEMPT_QUERY = `
  UPDATE $record_id
  SET
    intentos_fallidos = (intentos_fallidos ?? 0) + 1,
    actualizado_en = time::now()
  RETURN NONE;
`

const RECORD_SUCCESS_QUERY = `
  UPDATE $record_id
  SET
    intentos_fallidos = 0,
    ultimo_login = time::now(),
    actualizado_en = time::now()
  RETURN NONE;
`

export interface AuthRepository {
  findUserAndVerifyPassword(username: string, password: string): Promise<DatabaseUser | null>
  recordFailedAttempt(recordId: unknown): Promise<void>
  recordSuccessfulLogin(recordId: unknown): Promise<void>
}

async function runQuery(
  query: string,
  bindings: Record<string, unknown>,
): Promise<unknown[]> {
  try {
    const database = await getSurreal()
    return await database.query(query, bindings)
  } catch (error) {
    if (error instanceof DatabaseConnectionError) throw error
    throw new DatabaseQueryError()
  }
}

export class SurrealAuthRepository implements AuthRepository {
  async findUserAndVerifyPassword(
    username: string,
    password: string,
  ): Promise<DatabaseUser | null> {
    const [users] = await runQuery(FIND_USER_QUERY, {
      usuario: username,
      password,
    })

    if (!Array.isArray(users)) throw new DatabaseQueryError()
    return (users[0] as DatabaseUser | undefined) ?? null
  }

  async recordFailedAttempt(recordId: unknown): Promise<void> {
    await runQuery(RECORD_FAILED_ATTEMPT_QUERY, { record_id: recordId })
  }

  async recordSuccessfulLogin(recordId: unknown): Promise<void> {
    await runQuery(RECORD_SUCCESS_QUERY, { record_id: recordId })
  }
}
