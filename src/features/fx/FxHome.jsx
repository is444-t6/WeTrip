import { Link } from '@tanstack/react-router'
import { useChildren } from '../family/queries'
import { useCurrentUser } from '../auth/useCurrentUser'
import { useChildTrips } from '../family/tripQueries'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import NewTripForm from './components/NewTripForm'
import TripCard from './components/TripCard'
import PastTrips from '../../components/PastTrips'
import { useTrips } from './queries'
import { splitTrips } from './status'
import SignedOutCard from '../../components/SignedOutCard'

export default function FxHome() {
  const { role, familyLinkId: ownLinkId } = useCurrentUser()
  const { data: children } = useChildren()
  const parentTrips = useTrips()
  // A child's trips hang off their own link; useTrips only knows a parent's children.
  const childTrips = useChildTrips(role === 'Child' ? ownLinkId : undefined)
  const { data: trips, error, isLoading } = role === 'Child' ? childTrips : parentTrips
  const { active, ended } = splitTrips(trips)
  const hasChildren = (children ?? []).some((c) => c.status === 'Active')
  // Trips are per linked child, so a customer with nobody linked has none to show.
  const nothingLinked = role === 'None' || (role === 'Parent' && children && !hasChildren)

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip trips" />

  function signOut() {
    clearSession()
    window.location.reload()
  }

  return (
    <AppShell onSignOut={signOut}>
      <Banner>{error?.message}</Banner>

      <div className="row-between" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Trips</h1>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {role === 'Child'
          ? 'Your trips, what is in each pot and how to pay from it.'
          : "Lock each trip's money at today's rate. If the rate moves your way first, SmartFX locks it for you."}
      </p>

      <h2 className="section-title">Your trips</h2>
      {isLoading && <p className="muted">Loading…</p>}
      {nothingLinked && (
        <div className="card empty">
          <p style={{ margin: '0 0 8px' }}>
            Trips are planned for a child, and no child is linked to your account yet.
          </p>
          <Link to="/family">Link a child in Family</Link>
        </div>
      )}
      {!nothingLinked && trips?.length === 0 && (
        <div className="card empty">
          {role === 'Parent' ? 'No trips yet. Plan one below.' : 'No trips yet.'}
        </div>
      )}
      {active.map((t) => (
        <TripCard key={t.tripId} trip={t} role={role} />
      ))}
      <PastTrips trips={ended}>{(t) => <TripCard key={t.tripId} trip={t} role={role} />}</PastTrips>

      {role === 'Parent' && hasChildren && (
        <>
          <h2 className="section-title">Start a trip</h2>
          <NewTripForm />
        </>
      )}
    </AppShell>
  )
}
