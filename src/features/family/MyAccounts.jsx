import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FamilyApi } from './api'
import AppShell from './components/AppShell'
import Banner from './components/Banner'
import Money from './components/Money'
import { clearSession, isLoggedIn } from './session'

export default function MyAccounts() {
  const [accounts, setAccounts] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isLoggedIn()) return
    FamilyApi.getMyAccounts().then(setAccounts).catch((e) => setError(e.message))
  }, [])

  if (!isLoggedIn()) return <Navigate to="/login" replace />

  function signOut() {
    clearSession()
    window.location.href = '/login'
  }

  return (
    <AppShell onSignOut={signOut}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: 18 }}>Your accounts</h1>
      <Banner>{error}</Banner>
      {accounts === null && !error && <p className="muted">Loading…</p>}
      {accounts?.length === 0 && <div className="card empty">No deposit accounts found.</div>}
      {accounts?.map((a) => (
        <div key={a.accountId} className="card row-between">
          <div className="stack">
            <strong>{a.productName || 'Deposit Account'}</strong>
            <span className="muted">{a.accountId}</span>
          </div>
          <span className="money">
            <Money amount={a.balance} currency={a.currency} />
          </span>
        </div>
      ))}
    </AppShell>
  )
}
