import { Link } from '@tanstack/react-router'
import AppShell from '../../../components/AppShell'
import { clearSession, isLoggedIn } from '../../auth/session'
import '../scantopay.css'

export default function PayLayout({ title, children }) {
  // Signing out lands on the front door, as it does from every other screen.
  function signOut() {
    clearSession()
    window.location.assign('/')
  }

  return (
    <AppShell onSignOut={isLoggedIn() ? signOut : undefined}>
      <h1 style={{ margin: 0 }}>{title}</h1>
      <nav className="tabs" aria-label="Payments" style={{ marginTop: 16 }}>
        <Link
          to="/pay"
          className="tab"
          // /pay?tripId=… is still the scan tab.
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={{ className: 'tab active' }}
        >
          Scan to Pay
        </Link>
        <Link to="/pay/history" className="tab" activeProps={{ className: 'tab active' }}>
          My payments
        </Link>
      </nav>
      {children}
    </AppShell>
  )
}
