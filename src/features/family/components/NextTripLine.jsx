import { tripTiming } from '../trips'

// One line on the child card. Family_Composite's GetChildren already picks the
// child's next SmartFX trip, so this needs no lookup of its own. When SmartFX
// is down, `trip` is simply missing and the line is left out.
export default function NextTripLine({ trip }) {
  if (!trip?.destination) return null
  return (
    <div className="row-between muted" style={{ marginTop: 10, fontSize: '0.88em' }}>
      <span>
        Next trip: <strong>{trip.destination}</strong>
      </span>
      <span>{tripTiming(trip)}</span>
    </div>
  )
}
