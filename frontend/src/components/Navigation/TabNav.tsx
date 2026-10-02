import { NavLink } from 'react-router-dom'
import styles from './TabNav.module.css'

const TABS = [
  { to: '/activities', label: 'Activities' },
  { to: '/planner', label: 'Weekly Planner' },
  { to: '/today', label: 'Today' },
] as const

export function TabNav() {
  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.list}>
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
