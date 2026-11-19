import { randomBytes } from 'node:crypto'

const SESSION_TTL_MS = 30 * 60 * 1000

type AuthSession = {
  userId: string
  expiresAt: number
}

export class AuthSessionStore {
  private readonly sessions = new Map<string, AuthSession>()

  create(userId: string): string {
    this.removeExpired()
    const token = randomBytes(32).toString('base64url')
    this.sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS })
    return token
  }

  resolve(token: string): string | null {
    const session = this.sessions.get(token)

    if (!session) return null
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token)
      return null
    }

    return session.userId
  }

  private removeExpired(): void {
    const now = Date.now()
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(token)
    }
  }
}
