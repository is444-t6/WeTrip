import { useTrip } from '../../fx/queries'
import { useChildDashboard } from '../queries'
import { foreignLeft, tripTiming } from '../trips'
import Money from '../../../components/Money'

// The child's own view of their next trip: how much foreign money is left to
// spend. GetChildDashboard names the trip (Family_Composite reads it from
// SmartFX); the SmartFX trip itself adds the foreign amount and the spends.
// Renders nothing until there is a trip, so a child without one sees the page
// exactly as before.
export default function MyTripCard() {
  const { data: dash } = useChildDashboard()
  const next = dash?.nextTrip?.tripId ? dash.nextTrip : null
  const detail = useTrip(next?.tripId)
  if (!next) return null

  const trip = { ...next, ...detail.data?.trip }
  const { left, spent, pct } = foreignLeft(trip, detail.data?.spends)
  const funded = Number(trip.lockedForeign) > 0
  const setAside = Number(trip.lockedSgd) > 0

  return (
    <div className="card">
      <div className="card-header">
        <h3>My trip to {trip.destination}</h3>
        <span className="muted">{tripTiming(trip)}</span>
      </div>
      {funded ? (
        <>
          <div className="row-between">
            <span className="money">
              <Money amount={left} currency={trip.currency} />
            </span>
            <span className="muted">left to spend</span>
          </div>
          <div className="progress">
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="muted">
            <Money amount={spent} currency={trip.currency} /> spent of{' '}
            <Money amount={trip.lockedForeign} currency={trip.currency} />
          </p>
        </>
      ) : detail.isLoading ? (
        <p className="muted">Loading…</p>
      ) : setAside ? (
        // SmartFX could not be reached for the foreign amount; the dashboard
        // still knows how much was set aside.
        <p className="muted">
          <Money amount={trip.lockedSgd} /> set aside for this trip.
        </p>
      ) : (
        <p className="muted">Your parent is still setting aside money for this trip.</p>
      )}
    </div>
  )
}
