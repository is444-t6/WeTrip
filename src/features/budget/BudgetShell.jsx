import { useNavigate } from '@tanstack/react-router'
import AppShell from '../family/components/AppShell'
import { clearSession } from '../family/session'

export default function BudgetShell({ children }) {
  const navigate = useNavigate()

  function signOut() {
    clearSession()
    navigate({ to: '/family' })
  }

  return <AppShell onSignOut={signOut}>{children}</AppShell>
}