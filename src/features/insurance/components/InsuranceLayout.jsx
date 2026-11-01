import AppShell from '../../family/components/AppShell'
import { clearSession } from '../../family/session'

export default function InsuranceLayout({ children }) {
  function signOut() {
    clearSession()
    window.location.reload()
  }

  return <AppShell onSignOut={signOut}>{children}</AppShell>
}
