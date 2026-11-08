import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { setDevSession, getSessionToken, clearSession } from './session'
import AuthShell from './components/AuthShell'
import { usePageTitle } from '../../lib/usePageTitle'

// Dev-only stand-in for WeTrip login until ValidateSessionStub is replaced by
// the real session flow. Writes customerId:accountId:name into sessionStorage.
export default function Login() {
  const [customerId, setCustomerId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const navigate = useNavigate()
  const current = getSessionToken()
  usePageTitle('Sign in')

  function submit(e) {
    e.preventDefault()
    setDevSession(customerId.trim(), accountId.trim(), displayName.trim())
    navigate({ to: '/family' })
  }

  return (
    <AuthShell>
      <span className="eyebrow">Welcome back</span>
      <h2>Sign in to WeTrip</h2>
      <p>
        Use a sandbox customer to preview the family dashboard. This stub stands in for WeTrip
        login.
      </p>

      {current && (
        <div className="banner ok row-between" style={{ fontFamily: 'var(--font-mono)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{current}</span>
          <button
            className="secondary"
            style={{ padding: '6px 12px', flex: '0 0 auto' }}
            onClick={() => {
              clearSession()
              window.location.reload()
            }}
            type="button"
          >
            Clear
          </button>
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="login-customer">CustomerId</label>
          <input
            id="login-customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="SMU_TUSER2"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-account">Deposit AccountId</label>
          <input
            id="login-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="0000006385"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-name">Display name (optional)</label>
          <input
            id="login-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="timothy.loo"
          />
        </div>
        <button type="submit" style={{ width: '100%' }}>
          Sign in
        </button>
      </form>
      <p className="auth-footnote">Task 12.4 Option C · ValidateSessionStub</p>
    </AuthShell>
  )
}
