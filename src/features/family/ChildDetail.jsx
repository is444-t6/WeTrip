import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  useBalanceTrend,
  useChildExpenses,
  useChildren,
  useMe,
  useSetBudget,
  useSetupAllowance,
  useStopAllowance,
  useTopUp,
} from './queries'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from './components/AppShell'
import Banner from './components/Banner'
import ChildOverview from './components/ChildOverview'
import Money from './components/Money'
import SpendingInsights from './components/SpendingInsights'
import Tabs from './components/Tabs'
import TrendChart from './components/TrendChart'
import TripsPanel from './components/TripsPanel'
import { monthLabel } from './chart'
import { percentChange, ymd } from './insights'
import { useChildSpending } from './useChildSpending'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'manage', label: 'Manage' },
  { id: 'activity', label: 'Activity' },
]

export default function ChildDetail() {
  const { familyLinkId } = useParams({ from: '/family/child/$familyLinkId' })
  const { data: children, error } = useChildren()
  const [tab, setTab] = useState('overview')

  if (!isLoggedIn()) {
    return (
      <div className="center-page">
        <div className="card center-card" style={{ textAlign: 'center' }}>
          <p className="muted">You're not signed in yet.</p>
          <Link to="/login">
            <button style={{ width: '100%' }}>Sign in</button>
          </Link>
        </div>
      </div>
    )
  }

  function signOut() {
    clearSession()
    window.location.reload()
  }

  const child = children?.find((c) => String(c.familyLinkId) === String(familyLinkId)) || null
  const notFound = children && !child ? 'Could not find that child in your list.' : null

  return (
    <AppShell onSignOut={signOut}>
      <Link to="/family" className="back-link">
        &larr; Back to children
      </Link>
      <h1 className="visually-hidden">
        {child ? child.nickname || child.childCustomerId : 'Child'}
      </h1>
      <Banner>{error?.message || notFound}</Banner>
      {!child && !error && !notFound && <p className="muted">Loading…</p>}
      {child && (
        <>
          <ChildOverview child={child} onSetBudget={() => setTab('manage')} />
          <Tabs tabs={TABS} active={tab} onChange={setTab} label="Child sections" />

          {tab === 'overview' && (
            <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
              <h2 className="section-title">Spending insights</h2>
              <SpendingInsights child={child} />
              <h2 className="section-title">Trips</h2>
              <TripsPanel familyLinkId={familyLinkId} />
            </div>
          )}

          {tab === 'manage' && (
            <div role="tabpanel" id="panel-manage" aria-labelledby="tab-manage">
              <h2 className="section-title">Budget</h2>
              <BudgetCard child={child} />
              <h2 className="section-title">Allowance</h2>
              <AllowanceCard familyLinkId={familyLinkId} hasAllowance={child.hasAllowance} />
              <h2 className="section-title">Top up</h2>
              <TopUpCard child={child} />
            </div>
          )}

          {tab === 'activity' && (
            <div role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
              <h2 className="section-title">Expenses</h2>
              <ExpensesCard familyLinkId={familyLinkId} />
              <h2 className="section-title">Balance trend</h2>
              <BalanceTrendCard familyLinkId={familyLinkId} />
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}

function BudgetCard({ child }) {
  const familyLinkId = child.familyLinkId
  const [period, setPeriod] = useState(child.period === 'Weekly' ? 'Weekly' : 'Monthly')
  const [amount, setAmount] = useState(child.budget > 0 ? String(Number(child.budget)) : '')
  const [ok, setOk] = useState('')
  const setBudget = useSetBudget()
  const { span, previous } = useChildSpending(child)
  // Last period's spending is a realistic starting point for the next budget.
  const lastSpend = Number(previous.data?.total ?? 0)

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
            <label htmlFor="child-budget-period">Period</label>
            <select
              id="child-budget-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="child-budget-amount">Amount (SGD)</label>
            <input
              id="child-budget-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>
        {lastSpend > 0 && Number(amount) !== Number(lastSpend.toFixed(2)) && (
          <button
            type="button"
            className="chip"
            onClick={() => setAmount(lastSpend.toFixed(2))}
            style={{ marginBottom: 12 }}
          >
            Use last {span}'s spending (SGD {lastSpend.toFixed(2)})
          </button>
        )}
        <button disabled={setBudget.isPending} type="submit" style={{ width: '100%' }}>
          Save budget
        </button>
      </form>
    </div>
  )
}

function AllowanceCard({ familyLinkId, hasAllowance }) {
  const [amount, setAmount] = useState('')
  const [weeklyMonthly, setWeeklyMonthly] = useState('Monthly')
  const [startDate, setStartDate] = useState('')
  const [ok, setOk] = useState('')
  const [confirmingStop, setConfirmingStop] = useState(false)
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
      {hasAllowance && (
        <span className="badge active" style={{ marginBottom: 10, display: 'inline-flex' }}>
          active
        </span>
      )}
      <Banner>{setup.error?.message || stop.error?.message}</Banner>
      <Banner kind="ok">{ok}</Banner>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="child-allowance-amount">Amount (SGD)</label>
            <input
              id="child-allowance-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="child-allowance-frequency">Frequency</label>
            <select
              id="child-allowance-frequency"
              value={weeklyMonthly}
              onChange={(e) => setWeeklyMonthly(e.target.value)}
            >
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="child-allowance-start">Start date (optional, defaults to tomorrow)</label>
          <input
            id="child-allowance-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="row">
          <button disabled={busy} type="submit">
            Set up allowance
          </button>
          {confirmingStop ? (
            <>
              <button
                disabled={busy}
                type="button"
                className="danger"
                onClick={() =>
                  stop.mutate(Number(familyLinkId), {
                    onSuccess: () => setOk('Allowance stopped.'),
                    onSettled: () => setConfirmingStop(false),
                  })
                }
              >
                Confirm stop
              </button>
              <button
                disabled={busy}
                type="button"
                className="secondary"
                onClick={() => setConfirmingStop(false)}
              >
                Keep allowance
              </button>
            </>
          ) : (
            <button
              disabled={busy || !hasAllowance}
              type="button"
              className="secondary"
              title={hasAllowance ? undefined : 'No allowance is set up for this child'}
              onClick={() => setConfirmingStop(true)}
            >
              Stop allowance
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

const TOP_UP_AMOUNTS = [10, 20, 50, 100]

function TopUpCard({ child }) {
  const familyLinkId = child.familyLinkId
  const [amount, setAmount] = useState('')
  const [narrative, setNarrative] = useState('')
  const [ok, setOk] = useState('')
  const topUp = useTopUp()
  const me = useMe()

  const value = Number(amount)
  const mine = me.data ? Number(me.data.balance ?? 0) : null
  const childBalance = Number(child.balance ?? 0)
  const name = child.nickname || child.childCustomerId
  const tooMuch = mine !== null && value > mine

  function submit(e) {
    e.preventDefault()
    setOk('')
    topUp.mutate(
      { familyLinkId: Number(familyLinkId), amount: value, narrative },
      {
        onSuccess: (r) => {
          setOk(`Transferred. Your balance is now SGD ${Number(r.balanceAfter).toFixed(2)}.`)
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
        <div className="chips">
          {TOP_UP_AMOUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${value === n ? 'active' : ''}`}
              onClick={() => setAmount(String(n))}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="child-topup-amount">Amount (SGD)</label>
            <input
              id="child-topup-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="child-topup-note">Note (optional)</label>
            <input
              id="child-topup-note"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
            />
          </div>
        </div>
        {value > 0 && mine !== null && (
          <div className="preview">
            <div className="row-between">
              <span className="muted">Your balance</span>
              <span className="money">
                <Money amount={mine} /> → <Money amount={Math.max(0, mine - value)} />
              </span>
            </div>
            <div className="row-between">
              <span className="muted">{name}'s balance</span>
              <span className="money">
                <Money amount={childBalance} /> → <Money amount={childBalance + value} />
              </span>
            </div>
          </div>
        )}
        {tooMuch && <Banner>You only have SGD {mine.toFixed(2)} to send.</Banner>}
        <button disabled={topUp.isPending || tooMuch} type="submit" style={{ width: '100%' }}>
          Top up
        </button>
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
          <label htmlFor="child-expenses-from">From</label>
          <input
            id="child-expenses-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="child-expenses-to">To</label>
          <input
            id="child-expenses-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button type="submit">Refresh</button>
      </form>
      {!result && !error && (
        <p className="muted" style={{ marginTop: 10 }}>
          Loading…
        </p>
      )}
      {result && (
        <>
          <div className="row-between" style={{ marginTop: 10, marginBottom: 4 }}>
            <span className="muted">Total</span>
            <span className="money">
              <Money amount={result.total ?? 0} />
            </span>
          </div>
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>To</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(result.expenses ?? []).map((x) => (
                <tr key={x.transactionId}>
                  <td data-label="Date">{String(x.date).slice(0, 10)}</td>
                  <td data-label="To">{x.accountTo}</td>
                  <td data-label="Category">{x.category}</td>
                  <td data-label="Amount" style={{ textAlign: 'right' }}>
                    <Money amount={x.amount} currency={x.currency} />
                  </td>
                  <td data-label="Source" className="muted">
                    {x.source}
                  </td>
                </tr>
              ))}
              {(result.expenses ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No outgoing payments in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

const TREND_MONTHS = [3, 6, 12]

function BalanceTrendCard({ familyLinkId }) {
  const [months, setMonths] = useState(6)
  const { data: points, error } = useBalanceTrend(Number(familyLinkId), months)

  const known = (points ?? []).filter((p) => p.balance != null)
  const now = known.at(-1)
  const before = known.at(-2)
  const delta = now && before ? Number(now.balance) - Number(before.balance) : null
  const pct = now && before ? percentChange(now.balance, before.balance) : null

  return (
    <div className="card">
      <Banner>{error?.message}</Banner>
      <div className="row-between">
        <div className="segmented" role="group" aria-label="Months to show">
          {TREND_MONTHS.map((m) => (
            <button
              key={m}
              type="button"
              className={m === months ? 'active' : ''}
              aria-pressed={m === months}
              onClick={() => setMonths(m)}
            >
              {m} months
            </button>
          ))}
        </div>
        {now && (
          <span className="money">
            <Money amount={now.balance} />
          </span>
        )}
      </div>
      {points && <TrendChart points={points} />}
      {delta !== null && (
        <p className="muted">
          {delta === 0
            ? `Balance is unchanged since ${monthLabel(before.yearMonth)}.`
            : `Balance is ${delta > 0 ? 'up' : 'down'} SGD ${Math.abs(delta).toFixed(2)}${pct === null ? '' : ` (${Math.abs(pct)}%)`} since ${monthLabel(before.yearMonth)}.`}
        </p>
      )}
    </div>
  )
}

function today() {
  return ymd(new Date())
}

function firstOfMonth() {
  const d = new Date()
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1))
}
