import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FamilyApi } from './api'
import { isLoggedIn, clearSession } from './session'
import ParentHome from './ParentHome'
import ChildHome from './ChildHome'
import ChildInvite from './ChildInvite'
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

  if (!isLoggedIn()) {
    return (
      <div className="center-page">
        <div className="card center-card" style={{ textAlign: 'center' }}>
          <div className="brand-mark" style={{ margin: '0 auto 14px' }}>
            <svg viewBox="0 0 24 24" fill="none" width={15} height={15} xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9-9-4.03-9-9Z" stroke="#fff" strokeWidth="1.6" />
              <path d="M7.5 12.5 10.5 15.5 16.5 9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>WeTrip Family</h2>
          <p className="muted">You're not signed in yet.</p>
          <Link to="/family/dev-login"><button style={{ width: '100%', marginTop: 8 }}>Continue to sign in</button></Link>
        </div>
      </div>
    )
  }

  function signOut() {
    clearSession()
    window.location.reload()
  }

  return (
    <AppShell onSignOut={signOut}>
      {error && <Banner>{error}</Banner>}
      {!role && !error && <p className="muted">Loading…</p>}
      {role === 'Parent' && <ParentHome />}
      {(role === 'Child') && <ChildHome />}
      {(role === 'Pending' || role === 'None') && <ChildInvite />}
    </AppShell>
  )
}
