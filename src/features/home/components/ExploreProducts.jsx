import { Link } from '@tanstack/react-router'
import { ChartIcon, GlobeIcon, ScanIcon, ShieldIcon } from './Icons'

const PRODUCTS = [
  {
    to: '/insurance',
    icon: <ShieldIcon />,
    title: 'Travel insurance',
    text: 'Compare plans and cover your whole family in a few taps.',
  },
  {
    to: '/fx',
    icon: <GlobeIcon />,
    title: 'SmartFX',
    text: 'Lock in a good exchange rate before you fly.',
  },
  {
    to: '/budget',
    icon: <ChartIcon />,
    title: 'Trip budget',
    text: 'Set limits by category and keep spending on track.',
  },
  {
    to: '/pay',
    icon: <ScanIcon />,
    title: 'Scan to Pay',
    text: 'Pay any QR code now, or spread it over months.',
  },
]

export default function ExploreProducts() {
  return (
    <div className="explore-grid">
      {PRODUCTS.map((p) => (
        <Link key={p.to} to={p.to} className="card explore-card">
          <span className="quick-icon">{p.icon}</span>
          <strong>{p.title}</strong>
          <span className="muted">{p.text}</span>
        </Link>
      ))}
    </div>
  )
}
