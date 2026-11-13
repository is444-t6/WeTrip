import { Link } from '@tanstack/react-router'
import { ChartIcon, FamilyIcon, GlobeIcon, MilesIcon, ScanIcon, ShieldIcon } from './Icons'

// The six things people open the app to do. A red dot on Family flags
// requests waiting for a parent.
export default function QuickActions({ pendingApprovals = 0 }) {
  const items = [
    { to: '/pay', label: 'Scan to Pay', icon: <ScanIcon /> },
    { to: '/family', label: 'Family', icon: <FamilyIcon />, dot: pendingApprovals > 0 },
    { to: '/fx', label: 'SmartFX', icon: <GlobeIcon /> },
    { to: '/insurance', label: 'Insurance', icon: <ShieldIcon /> },
    { to: '/budget', label: 'Budget', icon: <ChartIcon /> },
    { to: '/miles', label: 'Miles', icon: <MilesIcon /> },
  ]
  return (
    <nav className="card quick" aria-label="Quick actions">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="quick-item">
          <span className="quick-icon">
            {i.icon}
            {i.dot && <span className="dot" aria-label="needs attention" />}
          </span>
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
