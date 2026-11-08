import { useNavigate } from '@tanstack/react-router'
import { useRole } from '../family/queries'
import { clearSession, isLoggedIn } from '../family/session'
import AppShell from '../family/components/AppShell'
import AuthShell from '../family/components/AuthShell'
import Banner from '../family/components/Banner'
import NewTripForm from './components/NewTripForm'
import TripCard from './components/TripCard'
import { useTrips } from './queries'
import { usePageTitle } from '../../lib/usePageTitle'

export default function FxHome() {
  usePageTitle('SmartFX')
  const { data: role } = useRole()
  const navigate = useNavigate()
  const { data: trips, error, isLoading } = useTrips()

  if (!isLoggedIn()) {
    return (
      <AuthShell>
        <span className="eyebrow">WeTrip SmartFX</span>
        <h2>You're not signed in yet.</h2>
        <p>Sign in to watch rates and lock your next trip at the right time.</p>
        <button
          className="btn"
          style={{ width: '100%' }}
          onClick={() => navigate({ to: '/family/dev-login' })}
        >
          Continue to sign in
        </button>
      </AuthShell>
    )
  }

  function signOut() {
    clearSession()
    window.location.reload()
  }

  return (
    <AppShell onSignOut={signOut}>
      <Banner>{error?.message}</Banner>

      <section className="page-intro">
        <span className="chip">Live rate watch</span>
        <h1>SmartFX</h1>
        <p>
          Lock a trip budget at today&rsquo;s rate. If the market moves your way first, SmartFX
          locks it for you.
        </p>
      </section>

      <h2 className="section-title">{role === 'Child' ? 'Your trips' : 'Trip goals'}</h2>
      {isLoading && <p className="muted">Loading…</p>}
      {trips?.length === 0 && <div className="card empty">No trips yet.</div>}
      <div className="trips-grid">
        {trips?.map((t) => (
          <TripCard key={t.tripId} trip={t} />
        ))}
      </div>

      {role === 'Parent' && (
        <>
          <h2 className="section-title">Start a trip</h2>
          <NewTripForm />
        </>
      )}
    </AppShell>
  )
}
