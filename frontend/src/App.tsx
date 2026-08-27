import { useCallback, useEffect, useState } from 'react'
import { LoginPage } from './components/LoginPage'
import { authApi } from './services/authApi'

type SessionState =
  | { status: 'checking' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; username: string }

function App() {
  const [session, setSession] = useState<SessionState>({ status: 'checking' })

  useEffect(() => {
    let cancelled = false

    authApi
      .me()
      .then((user) => {
        if (!cancelled) {
          setSession({ status: 'authenticated', username: user.username })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession({ status: 'unauthenticated' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleLoginSuccess = useCallback((username: string) => {
    setSession({ status: 'authenticated', username })
  }, [])

  const handleLogout = useCallback(async () => {
    await authApi.logout()
    setSession({ status: 'unauthenticated' })
  }, [])

  if (session.status === 'checking') {
    return (
      <main>
        <p role="status">Loading…</p>
      </main>
    )
  }

  if (session.status === 'unauthenticated') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <main>
      <h1>Behavioural Activation Planner</h1>
      <p>Logged in as {session.username}</p>
      <button type="button" onClick={handleLogout}>
        Log out
      </button>
    </main>
  )
}

export default App
