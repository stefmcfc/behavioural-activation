import { useState, type SubmitEvent } from 'react'
import { authApi } from '../services/authApi'
import { getErrorMessage } from '../utils/getErrorMessage'
import styles from './LoginPage.module.css'
import buttonStyles from '../styles/buttonVariants.module.css'

interface LoginPageProps {
  readonly onLoginSuccess: (username: string) => void
  readonly sessionExpired?: boolean
  readonly passwordChanged?: boolean
}

export function LoginPage({
  onLoginSuccess,
  sessionExpired = false,
  passwordChanged = false,
}: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameTouchedEmpty, setUsernameTouchedEmpty] = useState(false)
  const [passwordTouchedEmpty, setPasswordTouchedEmpty] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const usernameInvalid = usernameTouchedEmpty && !username.trim()
  const passwordInvalid = passwordTouchedEmpty && !password.trim()

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    if (!username.trim() || !password.trim()) {
      setUsernameTouchedEmpty(!username.trim())
      setPasswordTouchedEmpty(!password.trim())
      return
    }

    setIsSubmitting(true)
    try {
      const user = await authApi.login({ username, password })
      onLoginSuccess(user.username)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.shell}>
      <h1>Log in</h1>
      {sessionExpired && (
        <p className={styles.sessionExpiredNotice} role="alert">
          Your session has expired. Please log in again.
        </p>
      )}
      {passwordChanged && (
        <p className={styles.sessionExpiredNotice} role="alert">
          Password changed. Please log in with your new password.
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            aria-invalid={usernameInvalid ? 'true' : undefined}
            aria-describedby={usernameInvalid ? 'username-error' : undefined}
            onChange={(event) => {
              setUsername(event.target.value)
              if (event.target.value.trim()) {
                setUsernameTouchedEmpty(false)
              }
            }}
            onBlur={() => setUsernameTouchedEmpty(!username.trim())}
          />
          {usernameInvalid && (
            <p id="username-error" className={styles.fieldError}>
              Username is required.
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={passwordInvalid ? 'true' : undefined}
            aria-describedby={passwordInvalid ? 'password-error' : undefined}
            onChange={(event) => {
              setPassword(event.target.value)
              if (event.target.value.trim()) {
                setPasswordTouchedEmpty(false)
              }
            }}
            onBlur={() => setPasswordTouchedEmpty(!password.trim())}
          />
          {passwordInvalid && (
            <p id="password-error" className={styles.fieldError}>
              Password is required.
            </p>
          )}
        </div>

        {submitError && <p role="alert">{submitError}</p>}
        {isSubmitting && <output>Logging in…</output>}

        <div className={styles.actions}>
          <button type="submit" className={buttonStyles.primary} disabled={isSubmitting}>
            Log in
          </button>
        </div>
      </form>
    </main>
  )
}
