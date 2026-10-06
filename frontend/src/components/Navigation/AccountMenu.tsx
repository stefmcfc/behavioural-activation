import { useId, useState, type SubmitEvent } from 'react'
import { authApi } from '../../services/authApi'
import { getErrorMessage } from '../../utils/getErrorMessage'
import styles from './AccountMenu.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

interface AccountMenuProps {
  readonly username: string
  readonly onLogout: () => void
  readonly onPasswordChanged: () => void
}

function PersonIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="8" cy="6.3" r="2.1" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M3.4 12.8a5 5 0 0 1 9.2 0"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AccountMenu({ username, onLogout, onPasswordChanged }: AccountMenuProps) {
  const panelId = useId()
  const titleId = useId()
  const formTitleId = useId()
  const currentPasswordId = useId()
  const newPasswordId = useId()
  const confirmNewPasswordId = useId()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [currentPasswordTouchedEmpty, setCurrentPasswordTouchedEmpty] = useState(false)
  const [newPasswordTouchedEmpty, setNewPasswordTouchedEmpty] = useState(false)
  const [confirmNewPasswordTouchedEmpty, setConfirmNewPasswordTouchedEmpty] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentPasswordInvalid = currentPasswordTouchedEmpty && !currentPassword.trim()
  const newPasswordInvalid = newPasswordTouchedEmpty && !newPassword.trim()
  const confirmNewPasswordInvalid = confirmNewPasswordTouchedEmpty && !confirmNewPassword.trim()

  const handleChangePassword = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setCurrentPasswordTouchedEmpty(!currentPassword.trim())
      setNewPasswordTouchedEmpty(!newPassword.trim())
      setConfirmNewPasswordTouchedEmpty(!confirmNewPassword.trim())
      return
    }

    if (newPassword !== confirmNewPassword) {
      setFormError("Passwords don't match.")
      return
    }

    setIsSubmitting(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      onPasswordChanged()
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    // display:contents (see CSS) -- this wrapper exists purely so :has() can detect the panel's
    // open state and style the trigger accordingly; it introduces no layout box of its own, so
    // the trigger remains a direct flex item of the header exactly as before.
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        popoverTarget={panelId}
        aria-label="Account"
      >
        <PersonIcon />
      </button>
      {/* Positioned via CSS anchor positioning -- see SettingsMenu.tsx's comment for why a
          DOM-tree relative/absolute wrapper doesn't work once the popover is open (top-layer
          promotion changes its containing block to the viewport). */}
      <div id={panelId} popover="auto" aria-labelledby={titleId} className={styles.panel}>
        <h2 id={titleId} className={styles.panelTitle}>
          Account
        </h2>
        <p className={styles.username}>{username}</p>
        <button type="button" className={styles.logoutButton} onClick={onLogout}>
          Log out
        </button>

        <h3 id={formTitleId} className={styles.formTitle}>
          Change password
        </h3>
        <form onSubmit={handleChangePassword} noValidate aria-labelledby={formTitleId}>
          <div className={styles.field}>
            <label htmlFor={currentPasswordId}>Current password</label>
            <input
              id={currentPasswordId}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              aria-invalid={currentPasswordInvalid ? 'true' : undefined}
              aria-describedby={currentPasswordInvalid ? `${currentPasswordId}-error` : undefined}
              onChange={(event) => {
                setCurrentPassword(event.target.value)
                if (event.target.value.trim()) {
                  setCurrentPasswordTouchedEmpty(false)
                }
              }}
              onBlur={() => setCurrentPasswordTouchedEmpty(!currentPassword.trim())}
            />
            {currentPasswordInvalid && (
              <p id={`${currentPasswordId}-error`} className={styles.fieldError}>
                Current password is required.
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor={newPasswordId}>New password</label>
            <input
              id={newPasswordId}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              aria-invalid={newPasswordInvalid ? 'true' : undefined}
              aria-describedby={newPasswordInvalid ? `${newPasswordId}-error` : undefined}
              onChange={(event) => {
                setNewPassword(event.target.value)
                if (event.target.value.trim()) {
                  setNewPasswordTouchedEmpty(false)
                }
              }}
              onBlur={() => setNewPasswordTouchedEmpty(!newPassword.trim())}
            />
            {newPasswordInvalid && (
              <p id={`${newPasswordId}-error`} className={styles.fieldError}>
                New password is required.
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor={confirmNewPasswordId}>Confirm new password</label>
            <input
              id={confirmNewPasswordId}
              name="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmNewPassword}
              aria-invalid={confirmNewPasswordInvalid ? 'true' : undefined}
              aria-describedby={
                confirmNewPasswordInvalid ? `${confirmNewPasswordId}-error` : undefined
              }
              onChange={(event) => {
                setConfirmNewPassword(event.target.value)
                if (event.target.value.trim()) {
                  setConfirmNewPasswordTouchedEmpty(false)
                }
              }}
              onBlur={() => setConfirmNewPasswordTouchedEmpty(!confirmNewPassword.trim())}
            />
            {confirmNewPasswordInvalid && (
              <p id={`${confirmNewPasswordId}-error`} className={styles.fieldError}>
                Confirm new password is required.
              </p>
            )}
          </div>

          {formError && <p role="alert">{formError}</p>}
          {isSubmitting && <output>Changing password…</output>}

          <button
            type="submit"
            className={`${styles.changePasswordButton} ${buttonStyles.primary}`}
            disabled={isSubmitting}
          >
            Change password
          </button>
        </form>
      </div>
    </div>
  )
}
