import { Surreal } from 'surrealdb'
import { getConfig } from '../config.ts'
import { DatabaseConnectionError } from './errors.ts'

let connectionPromise: Promise<Surreal> | undefined

async function openConnection(): Promise<Surreal> {
  const config = getConfig().surreal
  const database = new Surreal()

  try {
    await database.connect(config.url, {
      namespace: config.namespace,
      database: config.database,
      authentication: {
        namespace: config.namespace,
        database: config.database,
        username: config.username,
        password: config.password,
      },
    })

    return database
  } catch {
    await database.close().catch(() => undefined)
    throw new DatabaseConnectionError()
  }
}

export function getSurreal(): Promise<Surreal> {
  connectionPromise ??= openConnection().catch((error: unknown) => {
    connectionPromise = undefined
    throw error
  })

  return connectionPromise
}

export async function closeSurreal(): Promise<void> {
  const currentConnection = connectionPromise
  connectionPromise = undefined

  if (!currentConnection) return

  const database = await currentConnection.catch(() => undefined)
  await database?.close().catch(() => undefined)
}
