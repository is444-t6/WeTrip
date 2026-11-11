import { Link } from '@tanstack/react-router'
import { useChildren } from '../family/queries'
import { useCurrentUser } from '../auth/useCurrentUser'
import { useChildTrips } from '../family/tripQueries'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import NewTripForm from './components/NewTripForm'
import TripCard from './components/TripCard'
import { useTrips } from './queries'

export default function FxHome() {
  const { role, familyLinkId: ownLinkId } = useCurrentUser()
  const { data: children } = useChildren()
  const parentTrips = useTrips()
  // A child's trips hang off their own link; useTrips only knows a parent's children.
  const childTrips = useChildTrips(role === 'Child' ? ownLinkId : undefined)
  const { data: trips, error, isLoading } = role === 'Child' ? childTrips : parentTrips
  const hasChildren = (children ?? []).some((c) => c.status === 'Active')
  // Trips are per linked child, so a customer with nobody linked has none to show.
  const nothingLinked = role === 'None' || (role === 'Parent' && children && !hasChildren)

  if (!isLoggedIn()) {
    return (
      <div className="center-page">
        <div className="card center-card" style={{ textAlign: 'center' }}>
          <h1>WeTrip SmartFX</h1>
          <p className="muted">You're not signed in yet.</p>
          <Link to="/login">
            <button style={{ width: '100%', marginTop: 8 }}>Continue to sign in</button>
          </Link>
        </div>
      </div>
    )
  }

  function signOut() {
    clearSession()
    window.location.reload()
  }

  return (
    <AppShell onSignOut={signOut}>
      <Banner>{error?.message}</Banner>

      <div className="row-between" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>SmartFX</h1>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Lock a trip budget at today's rate. If the market moves your way first, SmartFX locks it for
        you.
      </p>

      <h2 className="section-title">{role === 'Child' ? 'Your trips' : 'Trip goals'}</h2>
      {isLoading && <p className="muted">Loading…</p>}
      {nothingLinked && (
        <div className="card empty">
          <p style={{ margin: '0 0 8px' }}>
            Trip goals are set up for a child, and no child is linked to your account yet.
          </p>
          <Link to="/family">Link a child in Family</Link>
        </div>
      )}
      {!nothingLinked && trips?.length === 0 && (
        <div className="card empty">No trip goals yet.</div>
      )}
      {trips?.map((t) => (
        <TripCard key={t.tripId} trip={t} role={role} />
      ))}

      {role === 'Parent' && hasChildren && (
        <>
          <h2 className="section-title">Start a trip</h2>
          <NewTripForm />
        </>
      )}
    </AppShell>
  )
}
