import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './components/LoginPage'
import { ActivityBank } from './components/ActivityBank/ActivityBank'
import { WeeklyPlanner } from './components/WeeklyPlanner/WeeklyPlanner'
import { TodayView } from './components/WeeklyPlanner/TodayView'
import { WeeklySummary } from './components/WeeklySummary/WeeklySummary'
import { TabNav } from './components/Navigation/TabNav'
import { SettingsMenu } from './components/Navigation/SettingsMenu'
import { AccountMenu } from './components/Navigation/AccountMenu'
import { authApi } from './services/authApi'
import { setUnauthorizedHandler } from './services/client'
import styles from './App.module.css'

type SessionState =
  | { status: 'checking' }
  | { status: 'unauthenticated'; expired?: boolean }
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

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession((current) =>
        current.status === 'authenticated'
          ? { status: 'unauthenticated', expired: true }
          : current,
      )
    })

    return () => {
      setUnauthorizedHandler(null)
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
        <output>Loading…</output>
      </main>
    )
  }

  if (session.status === 'unauthenticated') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} sessionExpired={session.expired === true} />
  }

  return (
    <main className={styles.shell} data-testid="app-shell">
      <div className={styles.headerRow}>
        <h1>Behavioural Activation Planner</h1>
        <div className={styles.headerActions}>
          <SettingsMenu />
          <AccountMenu username={session.username} onLogout={handleLogout} />
        </div>
      </div>
      <TabNav />
      <Routes>
        <Route path="/" element={<Navigate to="/activities" replace />} />
        <Route path="/activities" element={<ActivityBank />} />
        <Route path="/planner" element={<WeeklyPlanner />} />
        <Route path="/today" element={<TodayView />} />
        <Route path="/summary" element={<WeeklySummary />} />
        <Route path="/settings" element={<Navigate to="/activities" replace />} />
      </Routes>
    </main>
  )
}

export default App
