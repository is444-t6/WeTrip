import { Link } from '@tanstack/react-router'
import Money from '../../../components/Money'
import { tripStatus } from '../status'
import { dayRange, rate as fmtRate, rateText } from '../../../lib/format'

const badge = {
  Watching: 'pending',
  PartiallyLocked: 'active',
  Locked: 'active',
  Spending: 'active',
  Completed: 'removed',
  Cancelled: 'removed',
}

export default function TripCard({ trip, role }) {
  const target = Number(trip.targetBudgetSgd) || 0
  const locked = Number(trip.lockedSgd) || 0
  const pct = target ? Math.min(100, (locked / target) * 100) : 0
  const rate = trip.currentRate || trip.lastCheckedRate

  return (
    <div className="card">
      <div className="row-between trip-head">
        <div className="stack">
          <strong>{trip.destination}</strong>
          <span className="muted">
            {dayRange(trip.tripStartDate, trip.tripEndDate)}
            {trip.childNickname ? ` · ${trip.childNickname}` : ''}
          </span>
        </div>
        <span className={`badge ${badge[trip.status] || 'pending'}`}>
          {tripStatus(trip.status).label}
        </span>
      </div>

      <div className="progress" style={{ marginTop: 16 }}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="row-between muted" style={{ fontSize: '0.82em' }}>
        <span>
          <Money amount={locked} /> locked
        </span>
        <span>
          of <Money amount={target} />
        </span>
      </div>

      <div className="row-between" style={{ marginTop: 12 }}>
        <span className="muted">Last checked</span>
        <span className="money">
          {/* GetTrips carries the watcher's last check, not a live quote. */}
          {rateText(rate, trip.currency)}
          <span className="muted"> · target {fmtRate(trip.targetRate)}</span>
        </span>
      </div>

      <Link
        to="/trips/$tripId"
        params={{ tripId: String(trip.tripId) }}
        className="btn secondary"
        style={{ width: '100%', marginTop: 14 }}
      >
        Open trip
      </Link>
      {role === 'Parent' && (
        <Link
          to="/fx/trips/$tripId"
          params={{ tripId: String(trip.tripId) }}
          className="muted"
          style={{ display: 'block', textAlign: 'center', marginTop: 10 }}
        >
          Manage rates &amp; locks
        </Link>
      )}
    </div>
  )
}
