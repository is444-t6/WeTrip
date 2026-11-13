import { Link, useNavigate } from '@tanstack/react-router'
import AppShell from '../../../components/AppShell'
import { clearSession, isLoggedIn } from '../../auth/session'
import { getCustomerId } from '../customer'
import '../scantopay.css'

export default function PayLayout({ title, children }) {
  const navigate = useNavigate()
  const customerId = getCustomerId()

  function signOut() {
    clearSession()
    navigate({ to: '/family' })
  }

  return (
    <AppShell onSignOut={isLoggedIn() ? signOut : undefined}>
      <h1 style={{ margin: 0 }}>{title}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Customer <span className="money">{customerId}</span>
      </p>
      <nav className="tabs" aria-label="Payments" style={{ marginTop: 16 }}>
        <Link
          to="/pay"
          className="tab"
          activeOptions={{ exact: true }}
          activeProps={{ className: 'tab active' }}
        >
          Scan to Pay
        </Link>
        <Link to="/pay/history" className="tab" activeProps={{ className: 'tab active' }}>
          My Payments
        </Link>
      </nav>
      {children}
    </AppShell>
  )
}
