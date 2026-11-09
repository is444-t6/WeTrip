import { Link } from '@tanstack/react-router'
import { useCurrentUser } from '../auth/useCurrentUser'
import { isLoggedIn, clearSession } from '../auth/session'
import ParentHome from './ParentHome'
import ChildHome from './ChildHome'
import ChildInvite from './ChildInvite'
import AppShell, { BrandMark } from '../../components/AppShell'
import Banner from '../../components/Banner'

export default function FamilyHome() {
  const { role, error } = useCurrentUser()

  if (!isLoggedIn()) {
    return (
      <div className="center-page">
        <div className="card center-card" style={{ textAlign: 'center' }}>
          <BrandMark alt="WeTrip" size={48} style={{ margin: '0 auto 12px' }} />
          <h2>WeTrip Family</h2>
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
      {error && <Banner>{error.message}</Banner>}
      {!role && !error && <p className="muted">Loading…</p>}
      {role === 'Parent' && <ParentHome />}
      {role === 'Child' && <ChildHome />}
      {(role === 'Pending' || role === 'None') && <ChildInvite />}
      {role && !['Parent', 'Child', 'Pending', 'None'].includes(role) && (
        <div className="card empty">
          <p>Your family link isn't active.</p>
          <p className="muted">
            If you think this is a mistake, ask your parent to link you again from their WeTrip
            Family screen.
          </p>
        </div>
      )}
    </AppShell>
  )
}
