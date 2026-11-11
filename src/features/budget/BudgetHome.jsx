import { Link } from '@tanstack/react-router'
import { useCurrentUser } from '../auth/useCurrentUser'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import SignedOutCard from '../../components/SignedOutCard'
import { useChildren } from '../family/queries'
import { useChildTrips } from '../family/tripQueries'
import { useTrips } from '../fx/queries'
import { day } from '../trips/trip'

export default function BudgetHome() {
  const { role, familyLinkId, error: roleError } = useCurrentUser()
  const children = useChildren()
  const parentTrips = useTrips()
  // A child's trips hang off their own link; useTrips only knows a parent's children.
  const childTrips = useChildTrips(role === 'Child' ? familyLinkId : undefined)
  const { data: trips, error, isLoading } = role === 'Child' ? childTrips : parentTrips
  // useTrips waits for the children list, so a parent is still loading until it arrives.
  const loading = isLoading || (!role && !roleError) || (role === 'Parent' && children.isLoading)

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip Budget" />

  function signOut() {
    clearSession()
    window.location.reload()
  }

  return (
    <AppShell onSignOut={signOut}>
      <h1>Budget</h1>
      <p className="muted">Open a trip to see spending against its category budgets.</p>
      <Banner>{(error || roleError)?.message}</Banner>
      {loading && <p className="muted">Loading…</p>}
      {!loading && !error && !trips?.length && (
        <div className="card empty">
          <p style={{ margin: '0 0 8px' }}>No trips yet, so there is no budget to open.</p>
          <Link to="/fx">Go to Trips</Link>
        </div>
      )}
      <div className="explore-grid">
        {trips?.map((t) => (
          <Link
            key={t.tripId}
            to="/budget/$tripId"
            params={{ tripId: String(t.tripId) }}
            className="card explore-card"
          >
            <strong>{t.destination}</strong>
            <span className="muted">
              {day(t.tripStartDate)} → {day(t.tripEndDate)}
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
