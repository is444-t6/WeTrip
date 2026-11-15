import { Link } from '@tanstack/react-router'
import { ChartIcon, GlobeIcon, MilesIcon, ScanIcon, ShieldIcon } from './Icons'

// Shortcuts to what the nav bar does not already hold. Home, Trips, Family and
// Pay are one tap away in the nav, so they are not repeated here. Locking rates
// and buying cover are the parent's jobs. Miles is for everyone.
export default function QuickActions({ role }) {
  const items =
    role === 'Parent'
      ? [
          { to: '/fx', label: 'Lock a rate', icon: <GlobeIcon /> },
          { to: '/insurance', label: 'Insurance', icon: <ShieldIcon /> },
          { to: '/budget', label: 'Budgets', icon: <ChartIcon /> },
          { to: '/miles', label: 'Miles', icon: <MilesIcon /> },
        ]
      : [
          { to: '/budget', label: 'Budgets', icon: <ChartIcon /> },
          { to: '/pay/history', label: 'My payments', icon: <ScanIcon /> },
          { to: '/miles', label: 'Miles', icon: <MilesIcon /> },
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
