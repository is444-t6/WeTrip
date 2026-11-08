import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  useBalanceTrend,
  useChildExpenses,
  useChildren,
  useSetBudget,
  useSetupAllowance,
  useStopAllowance,
  useTopUp,
} from './queries'
import { clearSession, isLoggedIn } from './session'
import AppShell from './components/AppShell'
import AuthShell from './components/AuthShell'
import Banner from './components/Banner'
import Money from './components/Money'
import { formatAmount } from '../../lib/money'
import BalanceHero from './components/BalanceHero'
import { usePageTitle } from '../../lib/usePageTitle'

function badgeClass(status) {
  if (status === 'Active') return 'active'
  if (status === 'Pending') return 'pending'
  return 'removed'
}

function periodCopy(period) {
  if (period === 'Weekly') return 'this week'
  if (period === 'Monthly') return 'this month'
  return 'this period'
}

export default function ChildDetail() {
  const { familyLinkId } = useParams({ from: '/family/child/$familyLinkId' })
  const navigate = useNavigate()
  const { data: children, error } = useChildren()
  const child = children?.find((c) => String(c.familyLinkId) === String(familyLinkId)) || null
  usePageTitle(child?.nickname || 'Child details')

  if (!isLoggedIn()) {
    return (
      <AuthShell>
        <span className="eyebrow">WeTrip Family</span>
        <h2>You're not signed in yet.</h2>
        <p>Sign in to manage budgets, allowances and spending for your child.</p>
        <button style={{ width: '100%' }} onClick={() => navigate({ to: '/family/dev-login' })}>
          Sign in
        </button>
      </AuthShell>
    )
  }

  function signOut() {
    clearSession()
    window.location.reload()
  }

  const notFound = children && !child ? 'Could not find that child in your list.' : null

  return (
    <AppShell onSignOut={signOut}>
      <Link to="/family" className="back-link">
        &larr; Back to children
      </Link>
      <Banner>{error?.message || notFound}</Banner>
      {!child && !error && !notFound && <p className="muted">Loading…</p>}
      {child && (
        <>
          <div className="detail-head">
            <div>
              <span className={`badge ${badgeClass(child.status)}`} style={{ marginBottom: 10 }}>
                {child.status}
              </span>
              <h1>{child.nickname || child.childCustomerId}</h1>
              <p className="muted" style={{ margin: 0 }}>
                {child.childCustomerId}
              </p>
            </div>
          </div>

          <BalanceHero
            label={child.nickname || child.childCustomerId}
            amount={child.balance}
            sub={
              (child.budget > 0
                ? `${formatAmount(child.spent, 'SGD')} SGD spent of ${formatAmount(child.budget, 'SGD')} SGD ${periodCopy(child.period)}`
                : 'No budget set yet') +
              (child.hostCurrency && child.hostCurrency !== 'SGD'
                ? Number(child.rate) > 0
                  ? ` · ≈ ${child.hostCurrency} ${(Number(child.balance) * Number(child.rate)).toFixed(2)} (1 SGD = ${Number(child.rate).toFixed(2)} ${child.hostCurrency})`
                  : ` · Host currency ${child.hostCurrency}`
                : '')
            }
            foot={
              <>
                <span>{child.hasAllowance ? 'Allowance active' : 'No allowance'}</span>
                <span>{child.status}</span>
              </>
            }
          />

          <div className="detail-grid three">
            <div>
              <h2 className="section-title">Budget</h2>
              <BudgetCard
                familyLinkId={familyLinkId}
                currentBudget={child.budget}
                currentPeriod={child.period}
              />
            </div>
            <div>
              <h2 className="section-title">Allowance</h2>
              <AllowanceCard familyLinkId={familyLinkId} hasAllowance={child.hasAllowance} />
            </div>
            <div>
              <h2 className="section-title">Top up</h2>
              <TopUpCard familyLinkId={familyLinkId} />
            </div>
          </div>

          <h2 className="section-title">Expenses</h2>
          <ExpensesCard familyLinkId={familyLinkId} />

          <h2 className="section-title">Balance trend</h2>
          <BalanceTrendCard familyLinkId={familyLinkId} />
        </>
      )}
    </AppShell>
  )
}

function BudgetCard({ familyLinkId, currentBudget, currentPeriod }) {
  const [period, setPeriod] = useState(currentPeriod === 'Weekly' ? 'Weekly' : 'Monthly')
  const [amount, setAmount] = useState(currentBudget > 0 ? String(Number(currentBudget)) : '')
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
            <label htmlFor="budget-period">Period</label>
            <select id="budget-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="budget-amount">Amount (SGD)</label>
            <input
              id="budget-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>
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
        <span className="badge active" style={{ marginBottom: 12, display: 'inline-flex' }}>
          active
        </span>
      )}
      <p className="muted" style={{ marginTop: 0 }}>
        Set a repeating top-up so your child always has a little spending money.
      </p>
      <Banner>{setup.error?.message || stop.error?.message}</Banner>
      <Banner kind="ok">{ok}</Banner>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="allowance-amount">Amount (SGD)</label>
            <input
              id="allowance-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="allowance-frequency">Frequency</label>
            <select
              id="allowance-frequency"
              value={weeklyMonthly}
              onChange={(e) => setWeeklyMonthly(e.target.value)}
            >
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="allowance-start">Start date (optional, defaults to tomorrow)</label>
          <input
            id="allowance-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="row allowance-actions">
          <button disabled={busy} type="submit" style={{ width: '100%' }}>
            Set up allowance
          </button>
          {confirmingStop ? (
            <>
              <button
                disabled={busy}
                type="button"
                className="danger"
                style={{ width: '100%' }}
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
                style={{ width: '100%' }}
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
              style={{ width: '100%' }}
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
          setOk(`Your balance is now SGD ${Number(r.balanceAfter).toFixed(2)}.`)
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
            <label htmlFor="topup-amount">Amount (SGD)</label>
            <input
              id="topup-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="topup-note">Note (optional)</label>
            <input
              id="topup-note"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
            />
          </div>
        </div>
        <button disabled={topUp.isPending} type="submit" style={{ width: '100%' }}>
          Top up
        </button>
      </form>
    </div>
  )
}

function ExpensesCard({ familyLinkId }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
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
        className="row expenses-filters"
      >
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="expenses-from">From</label>
          <input
            id="expenses-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="expenses-to">To</label>
          <input id="expenses-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="submit" style={{ alignSelf: 'flex-end', marginBottom: 16 }}>
          Refresh
        </button>
      </form>
      {result && (
        <>
          <div className="row-between" style={{ marginTop: 6, marginBottom: 10 }}>
            <span className="muted">Total</span>
            <span className="money" style={{ fontSize: 20 }}>
              <Money amount={result.total ?? 0} />
            </span>
          </div>
          <p className="table-hint">Swipe to see all columns &rarr;</p>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Expenses">
            <table>
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
                    <td>{String(x.date).slice(0, 10)}</td>
                    <td>{x.accountTo}</td>
                    <td>{x.category}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Money amount={x.amount} currency={x.currency} />
                    </td>
                    <td className="muted">{x.source}</td>
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
          </div>
        </>
      )}
    </div>
  )
}

function BalanceTrendCard({ familyLinkId }) {
  // `monthsText` is what the user is typing; `months` is the last valid value
  // and the only one that fires a request (debounced).
  const [monthsText, setMonthsText] = useState('6')
  const [months, setMonths] = useState(6)
  const { data: points, error } = useBalanceTrend(Number(familyLinkId), months)
  const hasBalance = (points ?? []).some((p) => p.balance != null)

  useEffect(() => {
    const n = Number(monthsText)
    if (!Number.isInteger(n) || n < 1 || n > 24) return
    const t = setTimeout(() => setMonths(n), 400)
    return () => clearTimeout(t)
  }, [monthsText])

  return (
    <div className="card">
      <Banner>{error?.message}</Banner>
      <div className="field" style={{ maxWidth: 180 }}>
        <label htmlFor="trend-months">Months</label>
        <input
          id="trend-months"
          type="number"
          min="1"
          max="24"
          value={monthsText}
          onChange={(e) => setMonthsText(e.target.value)}
        />
      </div>
      {points && !hasBalance && <p className="muted">No balance history yet.</p>}
      {points && hasBalance && (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Balance trend">
          <table style={{ minWidth: 320 }}>
            <tbody>
              {points.map((p) => (
                <tr key={p.yearMonth}>
                  <td>{String(p.yearMonth).slice(0, 7)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {p.balance == null ? (
                      <span className="muted">—</span>
                    ) : (
                      <Money amount={p.balance} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Local-date YYYY-MM-DD. toISOString() converts to UTC, which shifts the date
// by a day for anyone east of Greenwich (e.g. Singapore, UTC+8).
function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function today() {
  return ymd(new Date())
}

function firstOfMonth() {
  const d = new Date()
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1))
}
