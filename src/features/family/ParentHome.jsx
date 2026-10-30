import { useState } from 'react'
import {
  useChildren,
  useDecideRequest,
  useFindCustomer,
  useLinkChild,
  useMe,
  usePendingRequests,
} from './queries'
import Banner from './components/Banner'
import ChildCard from './components/ChildCard'
import Money from './components/Money'
import BalanceHero from './components/BalanceHero'

export default function ParentHome() {
  const me = useMe()
  const children = useChildren()
  const requests = usePendingRequests()
  const error = me.error || children.error || requests.error

  const linkedCount = children.data?.filter((c) => c.status === 'Active').length ?? 0

  return (
    <div>
      <Banner>{error?.message}</Banner>

      {me.data && (
        <BalanceHero
          label={me.data.displayName || me.data.customerId}
          amount={me.data.balance}
          sub="Your WeTrip balance"
          foot={
            <>
              <span>{linkedCount} {linkedCount === 1 ? 'child' : 'children'} linked</span>
              {requests.data?.length > 0 && <span>{requests.data.length} awaiting approval</span>}
            </>
          }
        />
      )}

      {requests.data?.length > 0 && <PendingRequests requests={requests.data} />}

      <div className="section-title">Your children</div>
      {children.isLoading && <p className="muted">Loading…</p>}
      {children.data?.length === 0 && (
        <div className="card empty">No children linked yet — add one below.</div>
      )}
      {children.data?.map((c) => <ChildCard key={c.familyLinkId} child={c} />)}

      <div className="section-title">Link a child</div>
      <LinkChildForm />
    </div>
  )
}

function PendingRequests({ requests }) {
  const decide = useDecideRequest()
  const busyId = decide.isPending ? decide.variables?.requestId : null

  return (
    <div className="card">
      <div className="card-header">
        <h3>Pending approvals</h3>
        <span className="badge pending">{requests.length}</span>
      </div>
      <Banner>{decide.error?.message}</Banner>
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
            <button
              disabled={busyId === r.requestId}
              onClick={() => decide.mutate({ requestId: r.requestId, approve: true })}
            >
              Approve
            </button>
            <button
              disabled={busyId === r.requestId}
              className="danger"
              onClick={() => decide.mutate({ requestId: r.requestId, approve: false })}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function LinkChildForm() {
  const [countryCode, setCountryCode] = useState('65')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [nickname, setNickname] = useState('')
  const [hostCurrency, setHostCurrency] = useState('SGD')
  const [done, setDone] = useState(false)

  const find = useFindCustomer()
  const link = useLinkChild()
  const busy = find.isPending || link.isPending
  const found = find.data

  function lookup(e) {
    e.preventDefault()
    setDone(false)
    find.mutate({ countryCode: countryCode.trim(), phoneNumber: phoneNumber.trim() })
  }

  function send(e) {
    e.preventDefault()
    link.mutate(
      {
        childCustomerId: found.customerId,
        nickname: nickname.trim(),
        hostCurrency: hostCurrency.trim() || 'SGD',
      },
      { onSuccess: () => setDone(true) },
    )
  }

  return (
    <div className="card">
      <Banner>{find.error?.message || link.error?.message}</Banner>
      {done ? (
        <Banner kind="ok">Invite sent — the child needs to accept it on their side.</Banner>
      ) : !found ? (
        <form onSubmit={lookup}>
          <div className="grid-2">
            <div className="field">
              <label>Country code</label>
              <input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} required />
            </div>
            <div className="field">
              <label>Phone number</label>
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
            </div>
          </div>
          <button disabled={busy} type="submit" style={{ width: '100%' }}>Find</button>
        </form>
      ) : (
        <form onSubmit={send}>
          <div className="row-between" style={{ background: 'var(--accent-soft)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
            <div className="stack">
              <strong>{found.name}</strong>
              <span className="muted">{found.customerId}</span>
            </div>
            <span className="badge active">found</span>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Nickname</label>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Jamie (Seoul)" />
            </div>
            <div className="field">
              <label>Host currency</label>
              <input value={hostCurrency} onChange={(e) => setHostCurrency(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <button disabled={busy} type="submit">Send invite</button>
            <button type="button" className="secondary" onClick={() => find.reset()}>Back</button>
          </div>
        </form>
      )}
    </div>
  )
}
