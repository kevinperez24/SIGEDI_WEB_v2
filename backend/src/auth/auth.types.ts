export type DatabaseUser = {
  id: unknown
  usuario: unknown
  nombres: unknown
  apellidos: unknown
  correo: unknown
  roles: unknown
  estado: unknown
  intentos_fallidos: unknown
  ultimo_login: unknown
  bloqueo_hasta: unknown
  cambio_password_requerido: unknown
  password_correcta: unknown
}

export type SafeUser = {
  id: string
  usuario: string
  nombres: string
  apellidos: string
  correo: string
  roles: string[]
  cambioPasswordRequerido: boolean
}

export type AuthFailureReason =
  | 'USER_NOT_FOUND'
  | 'USER_INACTIVE'
  | 'USER_BLOCKED'
  | 'WRONG_PASSWORD'

export type AuthResult =
  | { ok: true; user: SafeUser }
  | { ok: false; reason: AuthFailureReason }
