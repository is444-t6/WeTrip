import { useState } from 'react'
import { useChildren, useDecideRequest, useMe, usePendingRequests } from './queries'
import Banner from '../../components/Banner'
import BudgetAlert from './components/BudgetAlert'
import ChildCard from './components/ChildCard'
import LinkChildForm from './components/LinkChildForm'
import Money from '../../components/Money'
import BalanceHero from '../../components/BalanceHero'
import {
  approvalsSummary,
  exceedsBalance,
  isPayment,
  requestAmount,
  shortfallMessage,
  shortfalls,
} from './approvals'

export default function ParentHome() {
  const me = useMe()
  const children = useChildren()
  const requests = usePendingRequests()
  const error = me.error || children.error || requests.error

  const [adding, setAdding] = useState(false)
  const linkedCount = children.data?.filter((c) => c.status === 'Active').length ?? 0

  return (
    <div>
      <h1 className="visually-hidden">Family wallet</h1>
      <Banner>{error?.message}</Banner>

      {me.data && (
        <BalanceHero
          label={me.data.displayName || me.data.customerId}
          amount={me.data.balance}
          sub="Your WeTrip balance"
          foot={
            <>
              <span>
                {linkedCount} {linkedCount === 1 ? 'child' : 'children'} linked
              </span>
              {requests.data?.length > 0 && <span>{requests.data.length} awaiting approval</span>}
            </>
          }
        />
      )}

      {children.data
        ?.filter((c) => c.status === 'Active')
        .map((c) => (
          <BudgetAlert
            key={c.familyLinkId}
            who="parent"
            name={c.nickname || c.childCustomerId}
            spent={c.spent}
            budget={c.budget}
            period={c.period}
          />
        ))}

      {requests.data?.length > 0 && (
        <PendingRequests requests={requests.data} linkedChildren={children.data} />
      )}

      <h2 className="section-title">Your children</h2>
      {children.isLoading && <p className="muted">Loading…</p>}
      {children.data?.length === 0 && (
        <div className="card empty">No children linked yet — add one below.</div>
      )}
      {children.data?.map((c) => (
        <ChildCard key={c.familyLinkId} child={c} />
      ))}

      <h2 className="section-title">Add a child</h2>
      {adding || children.data?.length === 0 ? (
        <LinkChildForm />
      ) : (
        <button
          type="button"
          className="secondary"
          style={{ width: '100%' }}
          onClick={() => setAdding(true)}
        >
          Add a child
        </button>
      )}
    </div>
  )
}

function PendingRequests({ requests, linkedChildren }) {
  const decide = useDecideRequest()
  const busyId = decide.isPending ? decide.variables?.requestId : null
  const { count, total } = approvalsSummary(requests)
  const byLink = new Map((linkedChildren ?? []).map((c) => [c.familyLinkId, c]))

  return (
    <div className="card">
      <div className="card-header">
        <h3>Pending approvals</h3>
        <span className="badge pending">{count}</span>
      </div>
      <p className="muted" style={{ marginTop: -4 }}>
        <Money amount={total} /> waiting across {count} {count === 1 ? 'request' : 'requests'}
      </p>
      {shortfalls(requests, linkedChildren).map((s) => (
        <Banner key={s.name} kind="warn">
          {shortfallMessage(s)}
        </Banner>
      ))}
      <Banner>{decide.error?.message}</Banner>
      {requests.map((r, i) => (
        <div
          key={r.requestId}
          className="request"
          style={{ borderTop: i === 0 ? 'none' : undefined, paddingTop: i === 0 ? 0 : undefined }}
        >
          <div className="row-between">
            <div className="stack">
              <strong>{r.nickname}</strong>
              <span className="muted">
                {isPayment(r)
                  ? `${r.category}${r.narrative ? ` · ${r.narrative}` : ''}`
                  : r.reason || r.narrative || 'No reason given'}
              </span>
              {isPayment(r) ? (
                <span className="muted request-to">To account {r.merchantAccountId}</span>
              ) : (
                <span className="muted request-to">Asks to raise the limit for 24 hours</span>
              )}
            </div>
            <div className="stack request-side">
              <span className="money request-amount">
                <Money amount={requestAmount(r)} />
              </span>
              {isPayment(r) && exceedsBalance(r, byLink.get(r.familyLinkId)) && (
                <span className="badge removed">Over balance</span>
              )}
            </div>
          </div>
          <div className="row request-actions">
            <button
              disabled={busyId === r.requestId}
              onClick={() =>
                decide.mutate({
                  requestId: r.requestId,
                  approve: true,
                  ...(isPayment(r) ? {} : { grantAmount: requestAmount(r), hours: 24 }),
                })
              }
            >
              {isPayment(r) ? 'Approve' : 'Give it'}
            </button>
            <button
              disabled={busyId === r.requestId}
              className="danger"
              onClick={() => decide.mutate({ requestId: r.requestId, approve: false })}
            >
              {isPayment(r) ? 'Reject' : 'Not now'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
