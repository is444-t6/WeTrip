import { useEffect, useState } from 'react'
import { FamilyApi } from './api'
import Banner from './components/Banner'

export default function ChildInvite() {
  const [invite, setInvite] = useState(null)
  const [accountId, setAccountId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    FamilyApi.getMyLinkInvite().then(setInvite).catch((e) => setError(e.message))
  }, [])

  async function accept(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await FamilyApi.acceptLink(invite.familyLinkId, accountId.trim())
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <Banner kind="ok">Link accepted — you're all set.</Banner>
        <button style={{ width: '100%' }} onClick={() => window.location.reload()}>Go to your dashboard</button>
      </div>
    )
  }

  if (!invite) return <p className="muted">Loading…</p>

  if (!invite.hasInvite) {
    return (
      <div className="card empty">
        <p>You're not linked to a family yet.</p>
        <p className="muted">Ask a parent to link your phone number from their WeTrip Family screen.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Family invite</h2>
      <p className="muted">
        <strong style={{ color: 'var(--text)' }}>{invite.nickname || invite.parentCustomerId}</strong> wants to link you as their child on WeTrip Family.
      </p>
      <Banner>{error}</Banner>
      <form onSubmit={accept}>
        <div className="field">
          <label>Which of your accounts should they manage?</label>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Your deposit AccountId"
            required
          />
        </div>
        <button disabled={busy} type="submit" style={{ width: '100%' }}>Accept invite</button>
      </form>
    </div>
  )
}
