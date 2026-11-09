import { useState } from 'react'
import { useAcceptLink, useAccounts, useMyInvite } from './queries'
import Banner from './components/Banner'
import LinkChildForm from './components/LinkChildForm'

// The backend answers "no link for this customer" as a not-found error on some
// paths and as an empty / hasInvite:false body on others. Both mean the same
// thing to the child, so neither should read as a failure.
const isNoLink = (error) => /not found|no family link/i.test(error?.message ?? '')

export default function ChildInvite() {
  const { data: invite, error } = useMyInvite()
  const accounts = useAccounts()
  const accept = useAcceptLink()
  const [accountId, setAccountId] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <Banner kind="ok">Link accepted — you're all set.</Banner>
        <button style={{ width: '100%' }} onClick={() => window.location.reload()}>
          Go to your dashboard
        </button>
      </div>
    )
  }

  if (error && !isNoLink(error)) return <Banner>{error.message}</Banner>
  if (!invite && !error) return <p className="muted">Loading…</p>

  // FamilyHome renders this for role "Pending" (a real invite exists) and
  // "None" (nobody's linked this customer either way) alike, so this branch
  // covers genuinely having nothing to accept. familyLinkId is what AcceptLink
  // actually needs; hasInvite:false rules out an already-active link.
  const pending = invite?.familyLinkId && invite.hasInvite !== false
  if (!pending) {
    return (
      <>
        <div className="card empty">
          <p>You're not linked to a family yet.</p>
          <p className="muted">
            Ask a parent to link your phone number from their WeTrip Family screen.
          </p>
        </div>
        {/* A parent has no child yet, so nothing else on the screen can add one. */}
        <h2 className="section-title">Are you a parent?</h2>
        <LinkChildForm />
      </>
    )
  }

  // A dropdown of the child's own accounts when the lookup works; the plain
  // text box when it doesn't, so a failing account list never blocks accepting.
  const choices = Array.isArray(accounts.data)
    ? accounts.data.filter((a) => a.accountId && a.currentStatus !== 'Closed')
    : []

  return (
    <div className="card">
      <h1>Family invite</h1>
      <p className="muted">
        <strong style={{ color: 'var(--text)' }}>
          {invite.nickname || invite.parentCustomerId}
        </strong>{' '}
        wants to link you as their child on WeTrip Family.
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
          <label htmlFor="invite-account">Which of your accounts should they manage?</label>
          {accounts.isLoading ? (
            <p className="muted">Loading your accounts…</p>
          ) : choices.length > 0 ? (
            <select
              id="invite-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="">Choose an account</option>
              {choices.map((a) => (
                <option key={a.accountId} value={a.accountId}>
                  {a.accountId}
                  {a.currency ? ` · ${a.currency}` : ''}
                  {a.balance != null ? ` ${Number(a.balance).toFixed(2)}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="invite-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Your deposit AccountId"
              required
            />
          )}
        </div>
        <button
          disabled={accept.isPending || accounts.isLoading}
          type="submit"
          style={{ width: '100%' }}
        >
          Accept invite
        </button>
      </form>
    </div>
  )
}
