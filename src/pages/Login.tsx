import { FormEvent, useState } from 'react'
import { login, LoginError } from '../services/auth'
import type { AuthenticatedSession } from '../services/auth'
import conapinaLogo from '../assets/logo-conapina-negativo.png.png'
import './Login.css'

type FormErrors = {
  username?: string
  password?: string
}

type StatusMessage = {
  type: 'success' | 'error'
  text: string
}

type LoginProps = {
  onLoginSuccess: (session: AuthenticatedSession) => void
}

function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isLoading) return

    const nextErrors: FormErrors = {}

    if (!username.trim()) {
      nextErrors.username = 'El usuario es requerido.'
    }

    if (!password) {
      nextErrors.password = 'Debe ingresar una contraseña.'
    }

    setErrors(nextErrors)
    setStatusMessage(null)

    if (Object.keys(nextErrors).length > 0) return

    setIsLoading(true)

    try {
      const authenticatedSession = await login(username.trim(), password)
      setStatusMessage({ type: 'success', text: 'Inicio de sesión correcto.' })
      onLoginSuccess(authenticatedSession)
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text:
          error instanceof LoginError
            ? error.message
            : 'No fue posible iniciar sesión en este momento.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUsernameChange = (value: string) => {
    setUsername(value)
    if (errors.username && value.trim()) {
      setErrors((current) => ({ ...current, username: undefined }))
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (errors.password && value) {
      setErrors((current) => ({ ...current, password: undefined }))
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-institutional">
          <div className="login-logo-panel">
            <img
              className="login-logo"
              src={conapinaLogo}
              alt="Consejo Nacional de la Primera Infancia, Niñez y Adolescencia"
            />
          </div>

          <div className="login-brand-copy">
            <p className="login-brand-label">Plataforma institucional</p>
            <p className="login-brand-name">SIGEDI</p>
            <p className="login-brand-description">
              Sistema de Gestión de Donaciones Institucionales
            </p>
          </div>
        </div>

        <div className="login-authentication">
          <div className="login-card">
            <header className="login-header">
              <p className="login-eyebrow">Acceso institucional</p>
              <h1 id="login-title">Iniciar sesión</h1>
              <p className="login-subtitle">
                Ingrese sus credenciales para continuar a SIGEDI.
              </p>
            </header>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="form-field">
                <label htmlFor="username">Usuario</label>
                <div className="input-control">
                  <span className="input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-8a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 10c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Zm-7 6c.3-2.1 3.4-4 7-4s6.7 1.9 7 4H5Z" />
                    </svg>
                  </span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(event) => handleUsernameChange(event.target.value)}
                    placeholder="Ingrese su usuario"
                    autoComplete="username"
                    required
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={errors.username ? 'username-error' : undefined}
                  />
                </div>
                {errors.username && (
                  <p className="field-error" id="username-error" role="alert">
                    {errors.username}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="password">Contraseña</label>
                <div className="password-control input-control">
                  <span className="input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9h14v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Zm7 11H7v-7h10v7Zm-6-5h2v3h-2v-3Z" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => handlePasswordChange(event.target.value)}
                    placeholder="Ingrese su contraseña"
                    autoComplete="current-password"
                    required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m3.3 2.3 18.4 18.4-1.4 1.4-3.2-3.2A11.6 11.6 0 0 1 12 20C5 20 1 12 1 12a20.8 20.8 0 0 1 4.2-5.4L1.9 3.7l1.4-1.4ZM6.7 8.1A15.7 15.7 0 0 0 3.3 12c1.1 1.8 4.3 6 8.7 6 1.2 0 2.4-.3 3.5-.8l-2-2a4 4 0 0 1-4.7-4.7l-2.1-2.4ZM12 4c7 0 11 8 11 8a20 20 0 0 1-3.1 4.4L18.5 15a16.2 16.2 0 0 0 2.2-3c-1.1-1.8-4.3-6-8.7-6-.7 0-1.4.1-2 .3L8.4 4.7A11.3 11.3 0 0 1 12 4Zm-.5 4A4 4 0 0 1 16 12.5L11.5 8Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 4C5 4 1 12 1 12s4 8 11 8 11-8 11-8-4-8-11-8Zm0 14c-4.4 0-7.6-4.2-8.7-6C4.4 10.2 7.6 6 12 6s7.6 4.2 8.7 6c-1.1 1.8-4.3 6-8.7 6Zm0-10a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="field-error" id="password-error" role="alert">
                    {errors.password}
                  </p>
                )}
              </div>

              <button className="submit-button" type="submit" disabled={isLoading}>
                {isLoading && <span className="button-spinner" aria-hidden="true" />}
                {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>

              <div
                className={`form-status${
                  statusMessage ? ` form-status--${statusMessage.type}` : ''
                }`}
                role={statusMessage?.type === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {statusMessage && (
                  <p>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {statusMessage.type === 'success' ? (
                        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.4-4.2-4.2L8 10.8l2.8 2.8 5.6-5.6 1.4 1.4-7 7Z" />
                      ) : (
                        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
                      )}
                    </svg>
                    {statusMessage.text}
                  </p>
                )}
              </div>
            </form>

            <footer className="login-footer">Uso exclusivo de personal autorizado</footer>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Login
