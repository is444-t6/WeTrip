import { useState } from 'react'
import { useChildDashboard, useChildSpend } from './queries'
import { payNotice, periodBounds, periodTiming, safeDailySpend } from './insights'
import Banner from './components/Banner'
import BudgetAlert from './components/BudgetAlert'
import Money from './components/Money'
import MyTripCard from './components/MyTripCard'
import PaceBar from './components/PaceBar'
import BalanceHero from './components/BalanceHero'

const CATEGORIES = ['General', 'Food', 'Transport', 'Study', 'Fun']

export default function ChildHome() {
  const { data: dash, error } = useChildDashboard()
  const spend = useChildSpend()

  const [amount, setAmount] = useState('')
  const [merchantAccountId, setMerchantAccountId] = useState('')
  const [category, setCategory] = useState('General')
  const [narrative, setNarrative] = useState('')
  const [message, setMessage] = useState('')

  function pay(e) {
    e.preventDefault()
    setMessage('')
    spend.mutate(
      {
        merchantAccountId: merchantAccountId.trim(),
        amount: Number(amount),
        category,
        narrative,
      },
      {
        onSuccess: (result) => {
          setMessage(
            result.status === 'Completed'
              ? `Paid! Remaining this period: ${result.remaining}`
              : 'Over budget — sent to your parent for approval.',
          )
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

      <MyTripCard />

      <div className="card">
        <h3>Pay a merchant</h3>
        <Banner>{spend.error?.message}</Banner>
        <Banner kind="ok">{message}</Banner>
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
