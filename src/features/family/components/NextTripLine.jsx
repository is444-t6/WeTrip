import { useChildTrips } from '../tripQueries'
import { nextTrip, tripTiming } from '../trips'

// One line on the child card. A SmartFX outage must not break the card, so a
// failed or empty lookup just renders nothing.
export default function NextTripLine({ familyLinkId }) {
  const { data } = useChildTrips(Number(familyLinkId))
  const trip = nextTrip(data)
  if (!trip) return null
  return (
    <div className="row-between muted" style={{ marginTop: 10, fontSize: '0.88em' }}>
      <span>
        Next trip: <strong>{trip.destination}</strong>
      </span>
      <span>{tripTiming(trip)}</span>
    </div>
  )
}
