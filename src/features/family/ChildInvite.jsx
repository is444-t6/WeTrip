import { useState } from 'react'
import { useAcceptLink, useMyInvite } from './queries'
import Banner from './components/Banner'

export default function ChildInvite() {
  const { data: invite, error } = useMyInvite()
  const accept = useAcceptLink()
  const [accountId, setAccountId] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <Banner kind="ok">Link accepted — you're all set.</Banner>
        <button style={{ width: '100%' }} onClick={() => window.location.reload()}>Go to your dashboard</button>
      </div>
    )
  }

  if (error) return <Banner>{error.message}</Banner>
  if (!invite) return <p className="muted">Loading…</p>

  // Reached only when GetMyFamilyRole already returned "Pending" — a real
  // invite necessarily exists, so don't gate on invite.hasInvite here (that
  // field has been unreliable in testing). familyLinkId is what AcceptLink
  // actually needs.
  if (!invite.familyLinkId) {
    return (
      <div className="card empty">
        <p>Couldn't load your invite — try refreshing.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Family invite</h2>
      <p className="muted">
        <strong style={{ color: 'var(--text)' }}>{invite.nickname || invite.parentCustomerId}</strong> wants to link you as their child on WeTrip Family.
      </p>
      <Banner>{accept.error?.message}</Banner>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          accept.mutate(
            { familyLinkId: invite.familyLinkId, accountId: accountId.trim() },
            { onSuccess: () => setDone(true) },
          )
        }}
      >
        <div className="field">
          <label>Which of your accounts should they manage?</label>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Your deposit AccountId"
            required
          />
        </div>
        <button disabled={accept.isPending} type="submit" style={{ width: '100%' }}>Accept invite</button>
      </form>
    </div>
  )
}
