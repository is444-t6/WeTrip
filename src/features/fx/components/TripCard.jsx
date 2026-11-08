import { useNavigate } from '@tanstack/react-router'
import Money from '../../family/components/Money'
import { tripStatus } from '../status'

export default function TripCard({ trip }) {
  const navigate = useNavigate()
  const target = Number(trip.targetBudgetSgd) || 0
  const locked = Number(trip.lockedSgd) || 0
  const pct = target ? Math.min(100, (locked / target) * 100) : 0
  const status = tripStatus(trip.status)

  return (
    <article className="card trip-card">
      <div className="trip-top">
        <div>
          <strong>{trip.destination}</strong>
          <div className="trip-meta">
            {String(trip.tripStartDate).slice(0, 10)} → {String(trip.tripEndDate).slice(0, 10)}
            {trip.childNickname ? ` · ${trip.childNickname}` : ''}
          </div>
        </div>
        <span className={`badge ${status.tone}`}>{status.label}</span>
      </div>

      <div className="progress" style={{ marginTop: 18 }}>
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

      <div className="trip-rate">
        <span className="muted">Rate</span>
        <span className="money">
          {trip.currentRate ? `${Number(trip.currentRate).toFixed(4)} ${trip.currency}` : '—'}
          <span className="muted"> / target {Number(trip.targetRate).toFixed(4)}</span>
        </span>
      </div>

      <button
        className="secondary"
        style={{ width: '100%', marginTop: 16 }}
        onClick={() =>
          navigate({ to: '/fx/trips/$tripId', params: { tripId: String(trip.tripId) } })
        }
      >
        Open trip
      </button>
    </article>
  )
}
