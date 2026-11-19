import type { AuthRepository } from './auth.repository.ts'
import type { AuthResult, DatabaseUser, SafeUser } from './auth.types.ts'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function isFutureDate(value: unknown): boolean {
  if (value === null || value === undefined) return false

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value))
  return Number.isFinite(timestamp) && timestamp > Date.now()
}

function toSafeUser(user: DatabaseUser): SafeUser {
  return {
    id: asString(user.id),
    usuario: asString(user.usuario),
    nombres: asString(user.nombres),
    apellidos: asString(user.apellidos),
    correo: asString(user.correo),
    roles: Array.isArray(user.roles)
      ? user.roles.filter((role): role is string => typeof role === 'string')
      : [],
    cambioPasswordRequerido: user.cambio_password_requerido === true,
  }
}

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async authenticate(username: string, password: string): Promise<AuthResult> {
    const user = await this.repository.findUserAndVerifyPassword(username, password)

    if (!user) return { ok: false, reason: 'USER_NOT_FOUND' }
    if (user.estado !== 'ACTIVO') return { ok: false, reason: 'USER_INACTIVE' }
    if (isFutureDate(user.bloqueo_hasta)) return { ok: false, reason: 'USER_BLOCKED' }

    if (user.password_correcta !== true) {
      await this.repository.recordFailedAttempt(user.id)
      return { ok: false, reason: 'WRONG_PASSWORD' }
    }

    await this.repository.recordSuccessfulLogin(user.id)
    return { ok: true, user: toSafeUser(user) }
  }
}
