import { useEffect, useState } from 'react'
import { FamilyApi } from './api'
import Banner from './components/Banner'
import Money from './components/Money'
import BalanceHero from './components/BalanceHero'

export default function ChildHome() {
  const [dash, setDash] = useState(null)
  const [amount, setAmount] = useState('')
  const [merchantAccountId, setMerchantAccountId] = useState('')
  const [category, setCategory] = useState('General')
  const [narrative, setNarrative] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')

  const load = () => FamilyApi.getChildDashboard().then(setDash).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function pay(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage('')
    try {
      const result = await FamilyApi.childSpend(
        merchantAccountId.trim(),
        Number(amount),
        category,
        narrative,
      )
      setMessage(
        result.status === 'Completed'
          ? `Paid! Remaining this period: ${result.remaining}`
          : 'Over budget — sent to your parent for approval.',
      )
      setAmount('')
      setMerchantAccountId('')
      setNarrative('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !dash) return <Banner>{error}</Banner>
  if (!dash) return <p className="muted">Loading…</p>

  const pct = dash.budget ? Math.min(100, (dash.spent / dash.budget) * 100) : 0

  return (
    <div>
      <BalanceHero
        label={dash.nickname ? `${dash.nickname}'s balance` : 'Your balance'}
        amount={dash.balance}
        currency={dash.hostCurrency}
        sub={dash.rate > 0 && dash.hostCurrency !== 'SGD' ? `rate ${dash.rate} SGD/${dash.hostCurrency}` : undefined}
      />

      <div className="card">
        <div className="card-header">
          <h3>Budget this {dash.period?.toLowerCase() || 'period'}</h3>
          {pct >= 100 && <span className="badge removed">over</span>}
        </div>
        {dash.hasBudget ? (
          <>
            <div className={`progress ${pct >= 100 ? 'over' : ''}`}>
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="row-between">
              <span className="money"><Money amount={dash.spent} /></span>
              <span className="muted">of <Money amount={dash.budget} /></span>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>
              <Money amount={dash.remaining} /> remaining
            </p>
          </>
        ) : (
          <p className="muted">Your parent hasn't set a budget yet.</p>
        )}
        {dash.byCategory?.length > 0 && (
          <table style={{ marginTop: 8 }}>
            <tbody>
              {dash.byCategory.map((c) => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td style={{ textAlign: 'right' }}><Money amount={c.total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Pay a merchant</h3>
        <Banner>{error}</Banner>
        <Banner kind="ok">{message}</Banner>
        <form onSubmit={pay}>
          <div className="field">
            <label>Merchant account id</label>
            <input value={merchantAccountId} onChange={(e) => setMerchantAccountId(e.target.value)} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Amount</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Note (optional)</label>
            <input value={narrative} onChange={(e) => setNarrative(e.target.value)} />
          </div>
          <button disabled={busy} type="submit" style={{ width: '100%' }}>Pay</button>
        </form>
      </div>
    </div>
  )
}
