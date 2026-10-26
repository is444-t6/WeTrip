import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { FamilyApi } from './api'
import Banner from './components/Banner'
import Money from './components/Money'

export default function ChildDetail() {
  const { familyLinkId } = useParams()
  const location = useLocation()
  const [child, setChild] = useState(location.state?.child || null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (child) return
    FamilyApi.getChildren()
      .then((list) => {
        const match = list.find((c) => String(c.familyLinkId) === String(familyLinkId))
        if (!match) setError('Could not find that child in your list.')
        setChild(match || null)
      })
      .catch((e) => setError(e.message))
  }, [familyLinkId, child])

  return (
    <div>
      <Link to="/family" className="muted" style={{ display: 'inline-block', marginBottom: 14, fontWeight: 600 }}>
        &larr; Back to children
      </Link>
      <Banner>{error}</Banner>
      {!child && !error && <p className="muted">Loading…</p>}
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk('')
    try {
      await FamilyApi.setBudget(Number(familyLinkId), period, Number(amount))
      setOk('Budget saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <Banner>{error}</Banner>
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
        <button disabled={busy} type="submit" style={{ width: '100%' }}>Save budget</button>
      </form>
    </div>
  )
}

function AllowanceCard({ familyLinkId, hasAllowance }) {
  const [amount, setAmount] = useState('')
  const [weeklyMonthly, setWeeklyMonthly] = useState('Monthly')
  const [startDate, setStartDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState('')

  async function setup(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk('')
    try {
      await FamilyApi.setupAllowance(
        Number(familyLinkId),
        Number(amount),
        weeklyMonthly,
        startDate ? new Date(startDate).toISOString() : undefined,
      )
      setOk('Allowance set up.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    setBusy(true)
    setError(null)
    setOk('')
    try {
      await FamilyApi.stopAllowance(Number(familyLinkId))
      setOk('Allowance stopped.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      {hasAllowance && <span className="badge active" style={{ marginBottom: 10, display: 'inline-flex' }}>active</span>}
      <p className="muted">
        Test <code>AddStandingInstruction</code> alone in Postman first to confirm which exact
        string SMUtBank accepts for weeklyMonthly (Task 17.3 note) — "Weekly"/"Monthly" is a guess.
      </p>
      <Banner>{error}</Banner>
      <Banner kind="ok">{ok}</Banner>
      <form onSubmit={setup}>
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
          <button disabled={busy} type="button" className="secondary" onClick={stop}>Stop allowance</button>
        </div>
      </form>
    </div>
  )
}

function TopUpCard({ familyLinkId }) {
  const [amount, setAmount] = useState('')
  const [narrative, setNarrative] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk('')
    try {
      const r = await FamilyApi.topUp(Number(familyLinkId), Number(amount), narrative)
      setOk(`Transferred. New balance: ${r.balanceAfter}`)
      setAmount('')
      setNarrative('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <Banner>{error}</Banner>
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
        <button disabled={busy} type="submit" style={{ width: '100%' }}>Top up</button>
      </form>
    </div>
  )
}

function ExpensesCard({ familyLinkId }) {
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(today())
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function load(e) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await FamilyApi.getChildExpenses(Number(familyLinkId), startDate, endDate)
      setResult(r)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card">
      <Banner>{error}</Banner>
      <form onSubmit={load} className="row">
        <div className="field" style={{ flex: 1 }}>
          <label>From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button disabled={busy} type="submit">Refresh</button>
      </form>
      {result && (
        <>
          <div className="row-between" style={{ marginTop: 10, marginBottom: 4 }}>
            <span className="muted">Total</span>
            <span className="money"><Money amount={result.total} currency={result.hostCurrency} /></span>
          </div>
          <table>
            <thead>
              <tr><th>Date</th><th>To</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th>Source</th></tr>
            </thead>
            <tbody>
              {result.expenses.map((x) => (
                <tr key={x.transactionId}>
                  <td>{String(x.date).slice(0, 10)}</td>
                  <td>{x.accountTo}</td>
                  <td>{x.category}</td>
                  <td style={{ textAlign: 'right' }}><Money amount={x.amount} currency={x.currency} /></td>
                  <td className="muted">{x.source}</td>
                </tr>
              ))}
              {result.expenses.length === 0 && (
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
  const [points, setPoints] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    FamilyApi.getBalanceTrend(Number(familyLinkId), months)
      .then(setPoints)
      .catch((e) => setError(e.message))
  }, [familyLinkId, months])

  return (
    <div className="card">
      <Banner>{error}</Banner>
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
