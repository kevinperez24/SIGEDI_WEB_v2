import { config as loadEnvironment } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvironment({ path: resolve(backendDirectory, '.env'), quiet: true })

type EnvironmentKey =
  | 'SURREAL_URL'
  | 'SURREAL_NAMESPACE'
  | 'SURREAL_DATABASE'
  | 'SURREAL_USERNAME'
  | 'SURREAL_PASSWORD'

function requireEnvironment(key: EnvironmentKey): string {
  const value = process.env[key]?.trim()

  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${key}`)
  }

  return value
}

function readPort(): number {
  const rawPort = process.env.PORT?.trim() || '3001'
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT debe ser un número entero entre 1 y 65535.')
  }

  return port
}

export type AppConfig = {
  port: number
  frontendOrigin: readonly string[]
  surreal: {
    url: string
    namespace: string
    database: string
    username: string
    password: string
  }
}

let cachedConfig: AppConfig | undefined

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig

  cachedConfig = {
    port: readPort(),
    frontendOrigin: ['http://localhost:5173', 'http://localhost:5174'],
    surreal: {
      url: requireEnvironment('SURREAL_URL'),
      namespace: requireEnvironment('SURREAL_NAMESPACE'),
      database: requireEnvironment('SURREAL_DATABASE'),
      username: requireEnvironment('SURREAL_USERNAME'),
      password: requireEnvironment('SURREAL_PASSWORD'),
    },
  }

  return cachedConfig
}
