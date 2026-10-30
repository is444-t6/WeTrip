import { Link } from '@tanstack/react-router'
import Money from '../../family/components/Money'

const badge = {
  Watching: 'pending',
  PartiallyLocked: 'active',
  Locked: 'active',
  Spending: 'active',
  Completed: 'removed',
  Cancelled: 'removed',
}

export default function TripCard({ trip }) {
  const target = Number(trip.targetBudgetSgd) || 0
  const locked = Number(trip.lockedSgd) || 0
  const pct = target ? Math.min(100, (locked / target) * 100) : 0

  return (
    <div className="card">
      <div className="row-between">
        <div className="stack">
          <strong>{trip.destination}</strong>
          <span className="muted">
            {String(trip.tripStartDate).slice(0, 10)} → {String(trip.tripEndDate).slice(0, 10)}
            {trip.childNickname ? ` · ${trip.childNickname}` : ''}
          </span>
        </div>
        <span className={`badge ${badge[trip.status] || 'pending'}`}>{trip.status}</span>
      </div>

      <div className="progress" style={{ marginTop: 16 }}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="row-between muted" style={{ fontSize: '0.82em' }}>
        <span><Money amount={locked} /> locked</span>
        <span>of <Money amount={target} /></span>
      </div>

      <div className="row-between" style={{ marginTop: 12 }}>
        <span className="muted">Rate</span>
        <span className="money">
          {trip.currentRate ? `${Number(trip.currentRate).toFixed(4)} ${trip.currency}` : '—'}
          <span className="muted"> / target {Number(trip.targetRate).toFixed(4)}</span>
        </span>
      </div>

      <Link to="/fx/trips/$tripId" params={{ tripId: String(trip.tripId) }}>
        <button className="secondary" style={{ width: '100%', marginTop: 14 }}>Open trip</button>
      </Link>
    </div>
  )
}
