import styles from './RepeatableIcon.module.css'

export function RepeatableIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label="Repeatable"
    >
      <path
        d="M11.5 2.5l2 2-2 2M4.5 13.5l-2-2 2-2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 8A5.5 5.5 0 0 1 13 5.5M13.5 8A5.5 5.5 0 0 1 3 10.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
