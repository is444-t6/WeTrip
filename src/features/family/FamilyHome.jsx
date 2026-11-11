import { useCurrentUser } from '../auth/useCurrentUser'
import { isLoggedIn, clearSession } from '../auth/session'
import ParentHome from './ParentHome'
import ChildHome from './ChildHome'
import ChildInvite from './ChildInvite'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import SignedOutCard from '../../components/SignedOutCard'

export default function FamilyHome() {
  const { role, error } = useCurrentUser()

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip Family" />

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
