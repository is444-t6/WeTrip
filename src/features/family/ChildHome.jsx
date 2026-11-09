import { useState } from 'react'
import { useAskForMore, useChildDashboard, useChildSpend, useMyRequests } from './queries'
import { CATEGORIES } from './categories'
import { payNotice, periodBounds, periodTiming, safeDailySpend } from './insights'
import Banner from './components/Banner'
import BudgetAlert from './components/BudgetAlert'
import Money from './components/Money'
import MyTripCard from './components/MyTripCard'
import PaceBar from './components/PaceBar'
import { declineMessage } from './approvals'
import BalanceHero from './components/BalanceHero'

export default function ChildHome() {
  const { data: dash, error } = useChildDashboard()
  const spend = useChildSpend()

  const [amount, setAmount] = useState('')
  const [merchantAccountId, setMerchantAccountId] = useState('')
  const [category, setCategory] = useState('General')
  const [narrative, setNarrative] = useState('')
  const [message, setMessage] = useState('')
  // Set when ChildSpend turns a payment down: { message, remaining, shortBy }.
  const [declined, setDeclined] = useState(null)

  function pay(e) {
    e.preventDefault()
    setMessage('')
    setDeclined(null)
    spend.mutate(
      {
        merchantAccountId: merchantAccountId.trim(),
        amount: Number(amount),
        category,
        narrative,
      },
      {
        onSuccess: (result) => {
          if (result.status === 'Declined') {
            // Nothing was paid and nothing is waiting: the child can ask for more.
            setDeclined({
              message: result.message,
              remaining: result.remaining,
              shortBy: result.shortBy,
            })
            return
          }
          setMessage(`Paid! Remaining this period: ${result.remaining}`)
          setAmount('')
          setMerchantAccountId('')
          setNarrative('')
        },
      },
    )
  }

  if (error && !dash) return <Banner>{error.message}</Banner>
  if (!dash) return <p className="muted">Loading…</p>

  const pct = dash.budget ? Math.min(100, (dash.spent / dash.budget) * 100) : 0
  const period = dash.period === 'Weekly' ? 'Weekly' : 'Monthly'
  const span = period === 'Weekly' ? 'week' : 'month'
  const bounds = periodBounds(period)
  const { daysLeft } = periodTiming(bounds)
  const safe = safeDailySpend(dash.remaining, daysLeft)
  const notice = payNotice({
    amount,
    balance: dash.balance,
    remaining: dash.remaining,
    hasBudget: dash.hasBudget,
  })

  return (
    <div>
      <h1 className="visually-hidden">Child wallet</h1>
      <BalanceHero
        label={dash.nickname ? `${dash.nickname}'s balance` : 'Your balance'}
        amount={dash.balance}
        sub={
          dash.rate > 0 && dash.hostCurrency && dash.hostCurrency !== 'SGD'
            ? `≈ ${dash.hostCurrency} ${(dash.balance * dash.rate).toFixed(2)} · 1 SGD = ${Number(dash.rate).toFixed(2)} ${dash.hostCurrency}`
            : undefined
        }
      />

      {dash.hasBudget && (
        <BudgetAlert who="child" spent={dash.spent} budget={dash.budget} period={dash.period} />
      )}

      <div className="card">
        <div className="card-header">
          <h3>Budget this {span}</h3>
          {pct >= 100 && <span className="badge removed">over</span>}
        </div>
        {dash.hasBudget ? (
          <>
            <PaceBar spent={dash.spent} budget={dash.budget} bounds={bounds} />
            <div className="row-between">
              <span className="money">
                <Money amount={dash.spent} />
              </span>
              <span className="muted">
                of <Money amount={dash.budget} />
              </span>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>
              <Money amount={dash.remaining} /> remaining
              {safe > 0 && (
                <>
                  {' '}
                  · about <Money amount={safe} /> a day for {daysLeft}{' '}
                  {daysLeft === 1 ? 'day' : 'days'}
                </>
              )}
            </p>
          </>
        ) : (
          <p className="muted">Your parent hasn't set a budget yet.</p>
        )}
        {dash.byCategory?.length > 0 && (
          <table className="table-compact" style={{ marginTop: 8 }}>
            <tbody>
              {dash.byCategory.map((c) => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Money amount={c.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <MyRequests />

      <MyTripCard />

      <div className="card">
        <h3>Pay a merchant</h3>
        <Banner>{spend.error?.message}</Banner>
        <Banner kind="ok">{message}</Banner>
        {declined && (
          <AskForMore
            declined={declined}
            onDone={(note) => {
              setDeclined(null)
              if (typeof note === 'string') setMessage(note)
            }}
            defaultAmount={declined.shortBy}
          />
        )}
        <form onSubmit={pay}>
          <div className="field">
            <label htmlFor="child-pay-merchant">Merchant account id</label>
            <input
              id="child-pay-merchant"
              value={merchantAccountId}
              onChange={(e) => setMerchantAccountId(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="child-pay-amount">Amount</label>
            <input
              id="child-pay-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field" role="group" aria-labelledby="child-pay-category">
            <span id="child-pay-category" className="field-label">
              Category
            </span>
            <div className="chips">
              {CATEGORIES.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`chip ${category === name ? 'active' : ''}`}
                  aria-pressed={category === name}
                  onClick={() => setCategory(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="child-pay-note">Note (optional)</label>
            <input
              id="child-pay-note"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
            />
          </div>
          {notice && <div className={`banner ${notice.kind}`}>{notice.text}</div>}
          <button disabled={spend.isPending} type="submit" style={{ width: '100%' }}>
            Pay
          </button>
        </form>
      </div>
    </div>
  )
}

// Shown instead of the old "sent for approval": the payment did not happen, but
// the child can ask for more and then pay again once the parent says yes.
function AskForMore({ declined, defaultAmount, onDone }) {
  const ask = useAskForMore()
  const [amount, setAmount] = useState(defaultAmount > 0 ? String(defaultAmount) : '')
  const [reason, setReason] = useState('')

  function submit(e) {
    e.preventDefault()
    ask.mutate(
      { amount: Number(amount), reason: reason.trim() },
      {
        onSuccess: (result) =>
          onDone(
            result?.status === 'Approved'
              ? 'Approved straight away. You can pay again now.'
              : 'Asked your parent. You can pay again once they say yes.',
          ),
      },
    )
  }

  return (
    <div className="banner warn" role="alert">
      <strong>Payment not made</strong>
      <p style={{ margin: '4px 0 8px' }}>{declineMessage(declined)}</p>
      <form onSubmit={submit}>
        <Banner>{ask.error?.message}</Banner>
        <div className="field">
          <label htmlFor="ask-amount">Ask your parent for</label>
          <input
            id="ask-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="ask-reason">What is it for?</label>
          <input
            id="ask-reason"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="School trip"
          />
        </div>
        <div className="row">
          <button type="submit" disabled={ask.isPending}>
            Ask for more
          </button>
          <button type="button" className="secondary" onClick={() => onDone()}>
            Dismiss
          </button>
        </div>
      </form>
    </div>
  )
}

const ASK_BADGE = {
  Approved: ['active', 'Granted'],
  Rejected: ['removed', 'Not now'],
}

function MyRequests() {
  const { data } = useMyRequests()
  const list = (Array.isArray(data) ? data : []).slice(0, 3)
  if (list.length === 0) return null
  return (
    <div className="card">
      <h3>Your asks</h3>
      {list.map((r) => {
        const [kind, label] = ASK_BADGE[r.status] ?? ['pending', 'Waiting']
        return (
          <div key={r.requestId} className="row-between" style={{ padding: '4px 0' }}>
            <span>
              <Money amount={r.grantedAmount > 0 ? r.grantedAmount : r.requestedAmount} />
              {r.reason ? ` · ${r.reason}` : ''}
              {r.parentNote && <span className="muted"> — “{r.parentNote}”</span>}
            </span>
            <span className={`badge ${kind}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}
