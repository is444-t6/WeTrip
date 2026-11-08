import { useState } from 'react'
import { useChildDashboard, useChildSpend } from './queries'
import Banner from './components/Banner'
import Money from './components/Money'
import BalanceHero from './components/BalanceHero'
import { usePageTitle } from '../../lib/usePageTitle'

function periodCopy(period) {
  if (period === 'Weekly') return 'this week'
  if (period === 'Monthly') return 'this month'
  return 'this period'
}

export default function ChildHome() {
  usePageTitle('Child wallet')
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

  return (
    <div>
      <h1 className="visually-hidden">WeTrip child wallet</h1>
      <BalanceHero
        label={dash.nickname ? `${dash.nickname}'s balance` : 'Your balance'}
        amount={dash.balance}
        sub={
          dash.rate > 0 && dash.hostCurrency && dash.hostCurrency !== 'SGD'
            ? `≈ ${dash.hostCurrency} ${(Number(dash.balance) * Number(dash.rate)).toFixed(2)} · 1 SGD = ${Number(dash.rate).toFixed(2)} ${dash.hostCurrency}`
            : undefined
        }
      />

      <div className="detail-grid">
        <div className="card">
          <div className="card-header">
            <h2>Budget {periodCopy(dash.period)}</h2>
            {pct >= 100 && <span className="badge removed">over</span>}
          </div>
          {dash.hasBudget ? (
            <>
              <div className={`progress ${pct >= 100 ? 'over' : ''}`}>
                <div style={{ width: `${pct}%` }} />
              </div>
              <div className="row-between">
                <span className="money" style={{ fontSize: 20 }}>
                  <Money amount={dash.spent} />
                </span>
                <span className="muted">
                  of <Money amount={dash.budget} />
                </span>
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                <Money amount={dash.remaining} /> remaining
              </p>
            </>
          ) : (
            <p className="muted">Your parent hasn't set a budget yet.</p>
          )}
          {dash.byCategory?.length > 0 && (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Spending by category"
            >
              <table className="table-compact" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Spent</th>
                  </tr>
                </thead>
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
            </div>
          )}
        </div>

        <div className="card">
          <h2>Pay a merchant</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Tap, pay, and keep the trip moving.
          </p>
          <Banner>{spend.error?.message}</Banner>
          <Banner kind="ok">{message}</Banner>
          <form onSubmit={pay}>
            <div className="field">
              <label htmlFor="pay-merchant">Merchant account id</label>
              <input
                id="pay-merchant"
                value={merchantAccountId}
                onChange={(e) => setMerchantAccountId(e.target.value)}
                required
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="pay-amount">Amount</label>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="pay-category">Category</label>
                <input
                  id="pay-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pay-note">Note (optional)</label>
              <input
                id="pay-note"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
              />
            </div>
            <button disabled={spend.isPending} type="submit" style={{ width: '100%' }}>
              Pay
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
