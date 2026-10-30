import { useEffect, useState } from 'react'
import { FamilyApi } from './api'
import Banner from './components/Banner'
import ChildCard from './components/ChildCard'
import Money from './components/Money'
import BalanceHero from './components/BalanceHero'
import LinkChildForm from './components/LinkChildForm'

export default function ParentHome() {
  const [me, setMe] = useState(null)
  const [children, setChildren] = useState(null)
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState(null)

  const reload = () => {
    FamilyApi.getMe().then(setMe).catch((e) => setError(e.message))
    FamilyApi.getChildren().then(setChildren).catch((e) => setError(e.message))
    FamilyApi.getPendingRequests().then(setRequests).catch((e) => setError(e.message))
  }
  useEffect(reload, [])

  const linkedCount = children?.filter((c) => c.status === 'Active').length ?? 0

  return (
    <div>
      <Banner>{error}</Banner>

      {me && (
        <BalanceHero
          label={me.displayName || me.customerId}
          amount={me.balance}
          sub="Your WeTrip balance"
          foot={
            <>
              <span>{linkedCount} {linkedCount === 1 ? 'child' : 'children'} linked</span>
              {requests?.length > 0 && <span>{requests.length} awaiting approval</span>}
            </>
          }
        />
      )}

      {requests && requests.length > 0 && (
        <PendingRequests requests={requests} onDecided={reload} />
      )}

      <div className="section-title">Your children</div>
      {children === null && <p className="muted">Loading…</p>}
      {children?.length === 0 && (
        <div className="card empty">No children linked yet — add one below.</div>
      )}
      {children?.map((c) => <ChildCard key={c.familyLinkId} child={c} />)}

      <div className="section-title">Link a child</div>
      <LinkChildForm onLinked={reload} />
    </div>
  )
}

function PendingRequests({ requests, onDecided }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  async function decide(requestId, approve) {
    setBusyId(requestId)
    setError(null)
    try {
      await FamilyApi.decideRequest(requestId, approve)
      onDecided()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Pending approvals</h3>
        <span className="badge pending">{requests.length}</span>
      </div>
      <Banner>{error}</Banner>
      {requests.map((r, i) => (
        <div
          key={r.requestId}
          className="row-between"
          style={{
            paddingTop: i === 0 ? 0 : 14,
            marginTop: i === 0 ? 0 : 14,
            borderTop: i === 0 ? 'none' : '1px solid var(--card-border)',
          }}
        >
          <div className="stack">
            <span><strong>{r.nickname}</strong> &rarr; {r.merchantAccountId}</span>
            <span className="muted">{r.category}{r.narrative ? ` · ${r.narrative}` : ''}</span>
            <span className="money" style={{ marginTop: 2 }}><Money amount={r.amount} /></span>
          </div>
          <div className="row">
            <button disabled={busyId === r.requestId} onClick={() => decide(r.requestId, true)}>Approve</button>
            <button disabled={busyId === r.requestId} className="danger" onClick={() => decide(r.requestId, false)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  )
}

