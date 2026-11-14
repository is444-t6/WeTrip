import { Link } from '@tanstack/react-router'
import { ChartIcon, GlobeIcon, ScanIcon, ShieldIcon } from './Icons'

// Shortcuts to what the nav bar does not already hold. Home, Trips, Family and
// Pay are one tap away in the nav, so they are not repeated here. Locking rates
// and buying cover are the parent's jobs.
export default function QuickActions({ role }) {
  const items =
    role === 'Parent'
      ? [
          { to: '/fx', label: 'Lock a rate', icon: <GlobeIcon /> },
          { to: '/insurance', label: 'Insurance', icon: <ShieldIcon /> },
          { to: '/budget', label: 'Budgets', icon: <ChartIcon /> },
        ]
      : [
          { to: '/budget', label: 'Budgets', icon: <ChartIcon /> },
          { to: '/pay/history', label: 'My payments', icon: <ScanIcon /> },
        ]
  return (
    <nav className="card quick" aria-label="Quick actions">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="quick-item">
          <span className="quick-icon">{i.icon}</span>
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
