import { Link } from '@tanstack/react-router'
import { tenorFor } from '../../fx/api'
import { useRate } from '../../fx/queries'
import { useChildTrips } from '../tripQueries'
import { lockMessage, lockSummary, statusBadge, tripTiming } from '../trips'
import Banner from './Banner'
import Money from './Money'

const day = (value) => String(value).slice(0, 10)

function TripRow({ trip }) {
  const ended = trip.status === 'Completed' || trip.status === 'Cancelled'
  const period = tenorFor(trip.tripStartDate)
  // No rate lookup for a finished trip: nobody is deciding anything about it.
  const rate = useRate(ended ? undefined : trip.currency, period)

  const target = Number(trip.targetBudgetSgd) || 0
  const locked = Number(trip.lockedSgd) || 0
  const pct = target ? Math.min(100, (locked / target) * 100) : 0
  const summary = lockSummary(trip, rate.data?.forwardRate)

  return (
    <div className="card">
      <div className="row-between">
        <div className="stack">
          <strong>{trip.destination}</strong>
          <span className="muted">
            {day(trip.tripStartDate)} → {day(trip.tripEndDate)} · {tripTiming(trip)}
          </span>
        </div>
        <span className={`badge ${statusBadge(trip.status)}`}>{trip.status}</span>
      </div>

      <div className="progress" style={{ marginTop: 14 }}>
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
        <span className="muted">Target rate</span>
        <span className="money">
          {Number(trip.targetRate).toFixed(4)} {trip.currency}
        </span>
      </div>
      {!ended && (
        <div className="row-between">
          <span className="muted">Today's {period} forward</span>
          <span className="money">
            {rate.data?.forwardRate
              ? `${Number(rate.data.forwardRate).toFixed(4)} ${trip.currency}`
              : '—'}
          </span>
        </div>
      )}

      {!ended && (
        <p className="muted" style={{ marginTop: 10 }}>
          {lockMessage(summary, { currency: trip.currency, period })}
        </p>
      )}

      <Link to="/fx/trips/$tripId" params={{ tripId: String(trip.tripId) }}>
        <button className="secondary" style={{ width: '100%', marginTop: 14 }}>
          Open trip
        </button>
      </Link>
    </div>
  )
}

// Everything SmartFX knows about this child's trips, on the child's Family page.
export default function TripsPanel({ familyLinkId }) {
  const { data: trips, error, isLoading } = useChildTrips(Number(familyLinkId))

  return (
    <>
      <Banner>{error?.message}</Banner>
      {isLoading && <p className="muted">Loading…</p>}
      {trips?.length === 0 && (
        <div className="card empty">
          No trips planned yet. Set one up under <Link to="/fx">SmartFX</Link>.
        </div>
      )}
      {trips?.map((t) => (
        <TripRow key={t.tripId} trip={t} />
      ))}
    </>
  )
}
