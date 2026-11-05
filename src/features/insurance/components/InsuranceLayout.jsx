import { Link, useNavigate } from '@tanstack/react-router'
import AppShell from '../../family/components/AppShell'
import { clearSession } from '../../family/session'

export default function InsuranceLayout({ children }) {
  const navigate = useNavigate()

  function signOut() {
    clearSession()
    navigate({ to: '/family' })
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
            Buy Insurance
          </Link>
          <Link
            to="/insurance/policies"
            className="insurance-tab"
            activeProps={{ 'data-active': 'true' }}
          >
            My Insurance
          </Link>
        </nav>
      }
    >
      {children}
    </AppShell>
  )
}
