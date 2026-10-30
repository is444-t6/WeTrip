import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FamilyApi } from './api'
import { isLoggedIn, clearSession } from './session'
import ParentHome from './ParentHome'
import ChildHome from './ChildHome'
import ChildInvite from './ChildInvite'
import GetStarted from './GetStarted'
import AppShell from './components/AppShell'
import Banner from './components/Banner'

export default function FamilyHome() {
  const [role, setRole] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isLoggedIn()) return
    FamilyApi.getMyFamilyRole()
      .then((r) => setRole(r.role))
      .catch((e) => setError(e.message))
  }, [])

  if (!isLoggedIn()) return <Navigate to="/login" replace />

  function signOut() {
    clearSession()
    window.location.href = '/login'
  }

  return (
    <AppShell onSignOut={signOut}>
      {error && <Banner>{error}</Banner>}
      {!role && !error && <p className="muted">Loading…</p>}
      {role === 'Parent' && <ParentHome />}
      {role === 'Child' && <ChildHome />}
      {role === 'Pending' && <ChildInvite />}
      {role === 'None' && <GetStarted />}
    </AppShell>
  )
}
