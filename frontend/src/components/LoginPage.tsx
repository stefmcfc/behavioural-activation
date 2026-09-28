import { useState, type SubmitEvent } from 'react'
import { authApi } from '../services/authApi'
import { ApiError } from '../types/api'

interface LoginPageProps {
  readonly onLoginSuccess: (username: string) => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return 'Something went wrong. Please try again.'
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    if (!username.trim() || !password.trim()) {
      setValidationError('Username and password are required.')
      return
    }

    setValidationError(null)
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
    <main>
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {validationError && <p>{validationError}</p>}
        {submitError && <p role="alert">{submitError}</p>}
        {isSubmitting && <output>Logging in…</output>}

        <button type="submit" disabled={isSubmitting}>
          Log in
        </button>
      </form>
    </main>
  )
}
