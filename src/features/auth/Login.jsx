import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BrandMark } from '../../components/AppShell'
import Banner from '../../components/Banner'
import {
  accountLabel,
  depositAccounts,
  fetchAccounts,
  fetchDisplayName,
  lookupMessage,
} from './accounts'
import { setDevSession, getSessionToken, clearSession } from './session'

// Asks for a customer id only, looks the deposit account up, and writes
// customerId:accountId:displayName into sessionStorage['wetrip_session'].
export default function Login() {
  const [customerId, setCustomerId] = useState('')
  const [choices, setChoices] = useState(null) // set when there is more than one account
  const [chosen, setChosen] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const current = getSessionToken()

  async function finish(id, accountId) {
    setDevSession(id, accountId, await fetchDisplayName(id, accountId))
    // Nothing cached belongs to whoever signs in next.
    queryClient.clear()
    navigate({ to: '/' })
  }

  async function lookup(e) {
    e.preventDefault()
    const id = customerId.trim()
    setError('')
    setBusy(true)
    try {
      const accounts = depositAccounts(await fetchAccounts(id))
      if (accounts.length === 0) {
        setError('That customer has no SGD deposit account to sign in with.')
      } else if (accounts.length === 1) {
        await finish(id, accounts[0].accountId)
      } else {
        setChoices(accounts)
        setChosen(accounts[0].accountId)
      }
    } catch (err) {
      setError(lookupMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(e) {
    e.preventDefault()
    setBusy(true)
    await finish(customerId.trim(), chosen)
    setBusy(false)
  }

  return (
    <div className="center-page">
      <div className="center-card">
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <BrandMark alt="WeTrip" size={64} style={{ margin: '0 auto 12px' }} />
          <h1>Sign in to WeTrip</h1>
          <p className="muted">Sign in with your WeTrip customer ID.</p>
        </div>

        <div className="card">
          {current && (
            <div
              className="banner ok row-between"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78em' }}
            >
              <span>{current}</span>
              <button
                className="secondary"
                style={{ padding: '4px 10px' }}
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
          <Banner>{error}</Banner>

          {choices ? (
            <form onSubmit={confirm}>
              <p className="muted" style={{ marginTop: 0 }}>
                Customer <span className="money">{customerId.trim()}</span> has more than one
                deposit account.
              </p>
              <div className="field">
                <label htmlFor="account">Which account should WeTrip use?</label>
                <select id="account" value={chosen} onChange={(e) => setChosen(e.target.value)}>
                  {choices.map((a) => (
                    <option key={a.accountId} value={a.accountId}>
                      {accountLabel(a)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <button type="submit" disabled={busy}>
                  Sign in
                </button>
                <button type="button" className="secondary" onClick={() => setChoices(null)}>
                  Back
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={lookup}>
              <div className="field">
                <label htmlFor="customerId">CustomerId (the number, not the username)</label>
                <input
                  id="customerId"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="0000003018"
                  inputMode="numeric"
                  pattern="\d+"
                  title="Digits only, e.g. 0000003018."
                  required
                />
              </div>
              <button type="submit" disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Looking up…' : 'Continue'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
