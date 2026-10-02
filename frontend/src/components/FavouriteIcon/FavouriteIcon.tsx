import styles from './FavouriteIcon.module.css'

interface FavouriteIconProps {
  readonly filled?: boolean
}

export function FavouriteIcon({ filled = true }: FavouriteIconProps) {
  return (
    <svg
      className={filled ? styles.icon : styles.iconOutline}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label="Favourite"
    >
      <path
        d="M8 1.5l2.02 4.09 4.51.66-3.27 3.18.77 4.49L8 11.77l-4.03 2.15.77-4.49L1.47 6.25l4.51-.66L8 1.5z"
        stroke="currentColor"
        strokeWidth={filled ? 1 : 1.3}
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}
