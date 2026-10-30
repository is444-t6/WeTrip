import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { setDevSession, getSessionToken, clearSession } from './session'

// Stands in for WeTrip's real login while ValidateSessionStub (Task 12.4
// Option C) is wired up server-side. Writes customerId:accountId:name into
// sessionStorage['wetrip_session'] — exactly what GetSessionUser expects.
export default function DevLogin() {
  const [customerId, setCustomerId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const navigate = useNavigate()
  const current = getSessionToken()

  function submit(e) {
    e.preventDefault()
    setDevSession(customerId.trim(), accountId.trim(), displayName.trim())
    navigate({ to: '/family' })
  }

  return (
    <div className="center-page">
      <div className="center-card">
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="brand-mark" style={{ margin: '0 auto 10px', width: 40, height: 40, borderRadius: 12 }}>
            <svg viewBox="0 0 24 24" fill="none" width={22} height={22} xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9-9-4.03-9-9Z" stroke="#fff" strokeWidth="1.6" />
              <path d="M7.5 12.5 10.5 15.5 16.5 9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>Sign in to WeTrip</h2>
          <p className="muted">Dev stub — stands in for WeTrip login until it's wired up.</p>
        </div>

        <div className="card">
          {current && (
            <div className="banner ok row-between" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78em' }}>
              <span>{current}</span>
              <button className="secondary" style={{ padding: '4px 10px' }} onClick={() => { clearSession(); window.location.reload() }} type="button">Clear</button>
            </div>
          )}
          <form onSubmit={submit}>
            <div className="field">
              <label>CustomerId</label>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="SMU_TUSER2" required />
            </div>
            <div className="field">
              <label>Deposit AccountId</label>
              <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="0000006385" required />
            </div>
            <div className="field">
              <label>Display name (optional)</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="timothy.loo" />
            </div>
            <button type="submit" style={{ width: '100%' }}>Sign in</button>
          </form>
        </div>
        <p className="muted" style={{ textAlign: 'center' }}>Task 12.4 Option C · ValidateSessionStub</p>
      </div>
    </div>
  )
}
