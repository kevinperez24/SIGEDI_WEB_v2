import { Surreal } from 'surrealdb'
import { getConfig } from '../config.ts'
import { DatabaseConnectionError } from './errors.ts'

let personalConnectionPromise: Promise<Surreal> | undefined

async function openPersonalConnection(): Promise<Surreal> {
  const config = getConfig().personalSurreal
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

export function getPersonalSurreal(): Promise<Surreal> {
  personalConnectionPromise ??= openPersonalConnection().catch((error: unknown) => {
    personalConnectionPromise = undefined
    throw error
  })
  return personalConnectionPromise
}

export async function closePersonalSurreal(): Promise<void> {
  const currentConnection = personalConnectionPromise
  personalConnectionPromise = undefined
  if (!currentConnection) return
  const database = await currentConnection.catch(() => undefined)
  await database?.close().catch(() => undefined)
}
