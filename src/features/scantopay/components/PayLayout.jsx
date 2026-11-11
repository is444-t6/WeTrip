import { useNavigate } from '@tanstack/react-router'
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
      {children}
    </AppShell>
  )
}
