import { useTrip } from '../../fx/queries'
import { useFamilyLinkId } from '../queries'
import { useChildTrips } from '../tripQueries'
import { foreignLeft, nextTrip, tripTiming } from '../trips'
import Money from './Money'

// The child's own view of their next trip: how much foreign money is left to
// spend. Renders nothing until there is a trip, so a child without one sees
// the page exactly as before.
export default function MyTripCard() {
  const familyLinkId = useFamilyLinkId().data
  const { data: trips } = useChildTrips(familyLinkId)
  const trip = nextTrip(trips)
  const detail = useTrip(trip?.tripId)
  if (!trip) return null

  const { left, spent, pct } = foreignLeft(trip, detail.data?.spends)
  const funded = Number(trip.lockedForeign) > 0

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
      ) : (
        <p className="muted">Your parent is still setting aside money for this trip.</p>
      )}
    </div>
  )
}
