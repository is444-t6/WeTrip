import { Link } from '@tanstack/react-router'
import { useRole } from '../family/queries'
import { clearSession, isLoggedIn } from '../family/session'
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
          <h2>WeTrip SmartFX</h2>
          <p className="muted">You're not signed in yet.</p>
          <Link to="/family/dev-login"><button style={{ width: '100%', marginTop: 8 }}>Continue to sign in</button></Link>
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
        <h2 style={{ margin: 0 }}>SmartFX</h2>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Lock a trip budget at today's rate. If the market moves your way first, SmartFX locks it for you.
      </p>

      <div className="section-title">{role === 'Child' ? "Your trips" : "Trip goals"}</div>
      {isLoading && <p className="muted">Loading…</p>}
      {trips?.length === 0 && <div className="card empty">No trip goals yet.</div>}
      {trips?.map((t) => <TripCard key={t.tripId} trip={t} />)}

      {role === 'Parent' && (
        <>
          <div className="section-title">Start a trip</div>
          <NewTripForm />
        </>
      )}
    </AppShell>
  )
}
