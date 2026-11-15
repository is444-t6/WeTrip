import { Link } from '@tanstack/react-router'
import AppShell from '../../../components/AppShell'
import { clearSession } from '../../auth/session'

export default function InsuranceLayout({ children }) {
  function signOut() {
    clearSession()
    window.location.assign('/')
  }

  return (
    <AppShell
      onSignOut={signOut}
      secondaryNav={
        <nav className="insurance-tabs" aria-label="Insurance">
          <Link
            to="/insurance"
            className="insurance-tab"
            activeOptions={{ exact: true }}
            activeProps={{ 'data-active': 'true' }}
          >
            Buy insurance
          </Link>
          <Link
            to="/insurance/policies"
            className="insurance-tab"
            activeProps={{ 'data-active': 'true' }}
          >
            My insurance
          </Link>
        </nav>
      }
    >
      {children}
    </AppShell>
  )
}
