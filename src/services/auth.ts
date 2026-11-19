const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3001'

export type AuthenticatedUser = {
  id: string
  usuario: string
  nombres: string
  apellidos: string
  correo: string
  roles: string[]
  cambioPasswordRequerido: boolean
}

export type AuthenticatedSession = {
  user: AuthenticatedUser
  authToken: string
}

type LoginResponse =
  | { ok: true; usuario: AuthenticatedUser; authToken: string }
  | { ok: false; message: string }

export class LoginError extends Error {}

export async function login(usuario: string, password: string): Promise<AuthenticatedSession> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password }),
    })
  } catch {
    throw new LoginError('No fue posible iniciar sesión en este momento.')
  }

  let result: LoginResponse | undefined

  try {
    result = (await response.json()) as LoginResponse
  } catch {
    throw new LoginError('No fue posible iniciar sesión en este momento.')
  }

  if (!response.ok || !result.ok) {
    throw new LoginError(
      !result.ok ? result.message : 'No fue posible iniciar sesión en este momento.',
    )
  }

  return { user: result.usuario, authToken: result.authToken }
}
