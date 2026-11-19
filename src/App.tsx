import { useState } from 'react'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import type { AuthenticatedSession } from './services/auth'

function App() {
  const [session, setSession] = useState<AuthenticatedSession | null>(null)

  if (session) {
    return (
      <Inicio
        user={session.user}
        authToken={session.authToken}
        onLogout={() => setSession(null)}
      />
    )
  }

  return <Login onLoginSuccess={setSession} />
}

export default App
