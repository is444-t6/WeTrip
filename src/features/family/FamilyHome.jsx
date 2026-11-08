import { useNavigate } from '@tanstack/react-router'
import { useRole } from './queries'
import { isLoggedIn, clearSession } from './session'
import ParentHome from './ParentHome'
import ChildHome from './ChildHome'
import ChildInvite from './ChildInvite'
import AppShell from './components/AppShell'
import AuthShell from './components/AuthShell'
import Banner from './components/Banner'
import { usePageTitle } from '../../lib/usePageTitle'

export default function FamilyHome() {
  const { data: role, error } = useRole()
  const navigate = useNavigate()
  usePageTitle(isLoggedIn() ? 'Family' : 'Sign in')

  if (!isLoggedIn()) {
    return (
      <AuthShell>
        <span className="eyebrow">WeTrip Family</span>
        <h2>You're not signed in yet.</h2>
        <p>Sign in to see balances, manage the kids&rsquo; budgets and keep every trip on track.</p>
        <button
          className="btn"
          style={{ width: '100%' }}
          onClick={() => navigate({ to: '/family/dev-login' })}
        >
          Continue to sign in
        </button>
        <p className="auth-footnote">Demo build · shared family wallet</p>
      </AuthShell>
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
