import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  useBalanceTrend,
  useChildExpenses,
  useChildren,
  useSetBudget,
  useSetupAllowance,
  useStopAllowance,
  useTopUp,
} from './queries'
import { isLoggedIn } from './session'
import Banner from './components/Banner'
import Money from './components/Money'

export default function ChildDetail() {
  const { familyLinkId } = useParams({ from: '/family/child/$familyLinkId' })
  const { data: children, error } = useChildren()

  if (!isLoggedIn()) {
    return (
      <div className="center-page">
        <div className="card center-card" style={{ textAlign: 'center' }}>
          <p className="muted">You're not signed in yet.</p>
          <Link to="/family/dev-login"><button style={{ width: '100%' }}>Sign in</button></Link>
        </div>
      </div>
    )
  }

  const child = children?.find((c) => String(c.familyLinkId) === String(familyLinkId)) || null
  const notFound = children && !child ? 'Could not find that child in your list.' : null

  return (
    <div>
      <Link to="/family" className="muted" style={{ display: 'inline-block', marginBottom: 14, fontWeight: 600 }}>
        &larr; Back to children
      </Link>
      <Banner>{error?.message || notFound}</Banner>
      {!child && !error && !notFound && <p className="muted">Loading…</p>}
      {child && (
        <>
          <h1 style={{ fontSize: '1.4rem', marginBottom: 18 }}>{child.nickname || child.childCustomerId}</h1>
          <div className="section-title">Budget</div>
          <BudgetCard familyLinkId={familyLinkId} />
          <div className="section-title">Allowance</div>
          <AllowanceCard familyLinkId={familyLinkId} hasAllowance={child.hasAllowance} />
          <div className="section-title">Top up</div>
          <TopUpCard familyLinkId={familyLinkId} />
          <div className="section-title">Expenses</div>
          <ExpensesCard familyLinkId={familyLinkId} />
          <div className="section-title">Balance trend</div>
          <BalanceTrendCard familyLinkId={familyLinkId} />
        </>
      )}
    </div>
  )
}

function BudgetCard({ familyLinkId }) {
  const [period, setPeriod] = useState('Monthly')
  const [amount, setAmount] = useState('')
  const [ok, setOk] = useState('')
  const setBudget = useSetBudget()

  function submit(e) {
    e.preventDefault()
    setOk('')
    setBudget.mutate(
      { familyLinkId: Number(familyLinkId), period, amount: Number(amount) },
      { onSuccess: () => setOk('Budget saved.') },
    )
  }

  return (
    <div className="card">
      <Banner>{setBudget.error?.message}</Banner>
      <Banner kind="ok">{ok}</Banner>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label>Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
          <div className="field">
            <label>Amount (SGD)</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>
        <button disabled={setBudget.isPending} type="submit" style={{ width: '100%' }}>Save budget</button>
      </form>
    </div>
  )
}

function AllowanceCard({ familyLinkId, hasAllowance }) {
  const [amount, setAmount] = useState('')
  const [weeklyMonthly, setWeeklyMonthly] = useState('Monthly')
  const [startDate, setStartDate] = useState('')
  const [ok, setOk] = useState('')
  const setup = useSetupAllowance()
  const stop = useStopAllowance()
  const busy = setup.isPending || stop.isPending

  function submit(e) {
    e.preventDefault()
    setOk('')
    setup.mutate(
      {
        familyLinkId: Number(familyLinkId),
        amount: Number(amount),
        weeklyMonthly,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
      },
      { onSuccess: () => setOk('Allowance set up.') },
    )
  }

  return (
    <div className="card">
      {hasAllowance && <span className="badge active" style={{ marginBottom: 10, display: 'inline-flex' }}>active</span>}
      <p className="muted">
        Test <code>AddStandingInstruction</code> alone in Postman first to confirm which exact
        string SMUtBank accepts for weeklyMonthly (Task 17.3 note) — "Weekly"/"Monthly" is a guess.
      </p>
      <Banner>{setup.error?.message || stop.error?.message}</Banner>
      <Banner kind="ok">{ok}</Banner>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label>Amount (SGD)</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="field">
            <label>Frequency</label>
            <select value={weeklyMonthly} onChange={(e) => setWeeklyMonthly(e.target.value)}>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Start date (optional, defaults to tomorrow)</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="row">
          <button disabled={busy} type="submit">Set up allowance</button>
          <button
            disabled={busy}
            type="button"
            className="secondary"
            onClick={() =>
              stop.mutate(Number(familyLinkId), { onSuccess: () => setOk('Allowance stopped.') })
            }
          >
            Stop allowance
          </button>
        </div>
      </form>
    </div>
  )
}

function TopUpCard({ familyLinkId }) {
  const [amount, setAmount] = useState('')
  const [narrative, setNarrative] = useState('')
  const [ok, setOk] = useState('')
  const topUp = useTopUp()

  function submit(e) {
    e.preventDefault()
    setOk('')
    topUp.mutate(
      { familyLinkId: Number(familyLinkId), amount: Number(amount), narrative },
      {
        onSuccess: (r) => {
          setOk(`Transferred. New balance: ${r.balanceAfter}`)
          setAmount('')
          setNarrative('')
        },
      },
    )
  }

  return (
    <div className="card">
      <Banner>{topUp.error?.message}</Banner>
      <Banner kind="ok">{ok}</Banner>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label>Amount (SGD)</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="field">
            <label>Note (optional)</label>
            <input value={narrative} onChange={(e) => setNarrative(e.target.value)} />
          </div>
        </div>
        <button disabled={topUp.isPending} type="submit" style={{ width: '100%' }}>Top up</button>
      </form>
    </div>
  )
}

function ExpensesCard({ familyLinkId }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  // Draft inputs vs the range actually queried: the old screen only refetched
  // when Refresh was pressed, so changing a date must not fire a request.
  const [applied, setApplied] = useState({ from, to })
  const { data: result, error } = useChildExpenses(Number(familyLinkId), applied.from, applied.to)

  return (
    <div className="card">
      <Banner>{error?.message}</Banner>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setApplied({ from, to })
        }}
        className="row"
      >
        <div className="field" style={{ flex: 1 }}>
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="submit">Refresh</button>
      </form>
      {result && (
        <>
          <div className="row-between" style={{ marginTop: 10, marginBottom: 4 }}>
            <span className="muted">Total</span>
            <span className="money"><Money amount={result.total ?? 0} currency={result.hostCurrency} /></span>
          </div>
          <table>
            <thead>
              <tr><th>Date</th><th>To</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th>Source</th></tr>
            </thead>
            <tbody>
              {(result.expenses ?? []).map((x) => (
                <tr key={x.transactionId}>
                  <td>{String(x.date).slice(0, 10)}</td>
                  <td>{x.accountTo}</td>
                  <td>{x.category}</td>
                  <td style={{ textAlign: 'right' }}><Money amount={x.amount} currency={x.currency} /></td>
                  <td className="muted">{x.source}</td>
                </tr>
              ))}
              {(result.expenses ?? []).length === 0 && (
                <tr><td colSpan={5} className="muted">No outgoing payments in this range.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

function BalanceTrendCard({ familyLinkId }) {
  const [months, setMonths] = useState(6)
  const { data: points, error } = useBalanceTrend(Number(familyLinkId), months)

  return (
    <div className="card">
      <Banner>{error?.message}</Banner>
      <div className="field" style={{ maxWidth: 120 }}>
        <label>Months</label>
        <input type="number" min="1" max="24" value={months} onChange={(e) => setMonths(Number(e.target.value) || 6)} />
      </div>
      {points && (
        <table>
          <tbody>
            {points.map((p) => (
              <tr key={p.yearMonth}>
                <td>{p.yearMonth}</td>
                <td style={{ textAlign: 'right' }}><Money amount={p.balance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
