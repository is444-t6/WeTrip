import { Link } from '@tanstack/react-router'
import { useRole } from '../family/queries'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../family/components/AppShell'
import Banner from '../family/components/Banner'
import NewTripForm from './components/NewTripForm'
import TripCard from './components/TripCard'
import { useTrips } from './queries'

export default function FxHome() {
  const { data: role } = useRole()
  const { data: trips, error, isLoading } = useTrips()

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
      {trips?.length === 0 && <div className="card empty">No trip goals yet.</div>}
      {trips?.map((t) => (
        <TripCard key={t.tripId} trip={t} />
      ))}

      {role === 'Parent' && (
        <>
          <h2 className="section-title">Start a trip</h2>
          <NewTripForm />
        </>
      )}
    </AppShell>
  )
}
