import { Link } from '@tanstack/react-router'
import { useTrips } from '../../fx/queries'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useChildTrips } from '../../family/tripQueries'
import { tripWallets } from '../homeData'

// Foreign money set aside for upcoming trips, one chip per trip. A parent sees
// every linked child's trips; a child sees their own.
export default function TripWallets({ role }) {
  const { familyLinkId } = useCurrentUser()
  const parentTrips = useTrips()
  const childTrips = useChildTrips(role === 'Child' ? familyLinkId : undefined)
  const trips = role === 'Child' ? childTrips.data : parentTrips.data
  const wallets = tripWallets(trips)

  return (
    <div className="card">
      <div className="card-header">
        <h3>Trip money</h3>
        <Link to="/fx" className="muted">
          SmartFX
        </Link>
      </div>
      {wallets.length === 0 ? (
        <p className="muted">
          No money set aside for a trip yet. Lock a rate in SmartFX and it will show up here.
        </p>
      ) : (
        <div className="wallet-strip">
          {wallets.map((w) => (
            <Link
              key={w.tripId}
              to="/trips/$tripId"
              params={{ tripId: String(w.tripId) }}
              className="wallet-chip"
            >
              <span className="muted">{w.currency}</span>
              <span className="money">{w.amount.toFixed(2)}</span>
              <span className="muted">{w.destination}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
