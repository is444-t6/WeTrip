import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FamilyApi } from './api'
import AppShell from './components/AppShell'
import BalanceHero from './components/BalanceHero'
import Banner from './components/Banner'
import { clearSession, isLoggedIn } from './session'

export default function Home() {
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isLoggedIn()) return
    FamilyApi.getMe().then(setMe).catch((e) => setError(e.message))
  }, [])

  if (!isLoggedIn()) return <Navigate to="/login" replace />

  function signOut() {
    clearSession()
    window.location.href = '/login'
  }

  return (
    <AppShell onSignOut={signOut}>
      <Banner>{error}</Banner>
      {me && (
        <BalanceHero
          label={me.displayName || me.customerId}
          amount={me.balance}
          sub="Total deposit balance"
        />
      )}

      <div className="section-title">Where to?</div>
      <Link to="/accounts">
        <div className="card row-between">
          <div>
            <strong>Accounts</strong>
            <p className="muted" style={{ margin: 0 }}>View your deposit accounts</p>
          </div>
          <span className="muted">&rarr;</span>
        </div>
      </Link>
      <Link to="/family">
        <div className="card row-between">
          <div>
            <strong>Family</strong>
            <p className="muted" style={{ margin: 0 }}>Manage children's accounts, budgets &amp; allowances</p>
          </div>
          <span className="muted">&rarr;</span>
        </div>
      </Link>
    </AppShell>
  )
}
