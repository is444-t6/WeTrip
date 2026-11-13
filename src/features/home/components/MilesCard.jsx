import { useMyMiles } from '../../trips/queries'
import { milesLabel } from '../../trips/trip'

// A child's miles, earned by paying on a trip. Hidden while loading and when the
// read fails, so a miles outage never takes the rest of Home down.
export default function MilesCard() {
  const { data } = useMyMiles(true)
  if (!data) return null
  const balance = Number(data.balance) || 0
  return (
    <div className="card" aria-label="Miles">
      <div className="card-header">
        <h3>Miles</h3>
      </div>
      <p style={{ margin: 0 }}>{milesLabel(balance)}</p>
      {balance === 0 && <p className="muted">Pay on a trip to earn miles.</p>}
    </div>
  )
}
