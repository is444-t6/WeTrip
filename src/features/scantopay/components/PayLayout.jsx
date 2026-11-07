import { useNavigate } from '@tanstack/react-router'
import AppShell from '../../family/components/AppShell'
import { clearSession, isLoggedIn } from '../../family/session'
import { DEMO_CUSTOMER_ID, getCustomerId } from '../customer'
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
      <h2 style={{ margin: 0 }}>{title}</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        Customer <span className="money">{customerId}</span>
        {customerId === DEMO_CUSTOMER_ID && ' (demo)'}
      </p>
      {children}
    </AppShell>
  )
}
