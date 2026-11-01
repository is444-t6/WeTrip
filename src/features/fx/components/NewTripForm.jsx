import { useState } from 'react'
import { useChildren } from '../../family/queries'
import { getSessionCustomerId } from '../../family/session'
import Banner from '../../family/components/Banner'
import { CURRENCIES, tenorFor } from '../api'
import { useCreateTrip, useRate } from '../queries'
import { Link } from '@tanstack/react-router'

export default function NewTripForm() {
  const { data: children } = useChildren()
  const active = (children || []).filter((c) => c.status === 'Active')

  const [open, setOpen] = useState(false)
  const [familyLinkId, setFamilyLinkId] = useState('')
  const [destination, setDestination] = useState('')
  const [currency, setCurrency] = useState('JPY')
  const [tripStartDate, setTripStartDate] = useState('')
  const [tripEndDate, setTripEndDate] = useState('')
  const [targetBudgetSgd, setTargetBudgetSgd] = useState('')
  const [targetRate, setTargetRate] = useState('')
  const [autoLockEnabled, setAutoLockEnabled] = useState(true)

  const period = tenorFor(tripStartDate)
  const quote = useRate(currency, period)
  const create = useCreateTrip()

  function submit(e) {
    e.preventDefault()
    const child = active.find((c) => String(c.familyLinkId) === String(familyLinkId))
    create.mutate(
      {
        familyLinkId: Number(familyLinkId),
        parentCustomerId: getSessionCustomerId(),
        childCustomerId: child?.childCustomerId || '',
        destination: destination.trim(),
        currency,
        tripStartDate,
        tripEndDate,
        targetBudgetSgd: Number(targetBudgetSgd),
        targetRate: Number(targetRate),
        autoLockEnabled,
      },
      {
        onSuccess: () => {
          setDestination('')
          setTripStartDate('')
          setTripEndDate('')
          setTargetBudgetSgd('')
          setTargetRate('')
          setOpen(false)
        },
      },
    )
  }

  if (!open) {
    return (
      <button style={{ width: '100%' }} onClick={() => setOpen(true)} disabled={active.length === 0}>
        {active.length === 0 ? 'Link a child first' : 'New trip goal'}
      </button>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>New trip goal</h3>
        <button className="ghost" type="button" onClick={() => setOpen(false)}>Close</button>
      </div>
      <Banner>{create.error?.message}</Banner>

      <div className="banner" style={{ background: 'var(--accent-soft)', color: 'var(--text)' }}>
        <strong>Travel insurance is optional.</strong> Compare illustrative cover for this trip after planning.
        <Link
          to="/insurance"
          search={{ destination, startDate: tripStartDate, endDate: tripEndDate }}
          style={{ display: 'block', marginTop: 6, fontWeight: 700 }}
        >Explore travel insurance →</Link>
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <label>Child</label>
          <select value={familyLinkId} onChange={(e) => setFamilyLinkId(e.target.value)} required>
            <option value="">Select a child</option>
            {active.map((c) => (
              <option key={c.familyLinkId} value={c.familyLinkId}>
                {c.nickname || c.childCustomerId}
              </option>
            ))}
          </select>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Destination</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Tokyo" required />
          </div>
          <div className="field">
            <label>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Depart</label>
            <input type="date" value={tripStartDate} onChange={(e) => setTripStartDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Return</label>
            <input type="date" value={tripEndDate} onChange={(e) => setTripEndDate(e.target.value)} required />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Budget (SGD)</label>
            <input type="number" step="0.01" min="1" value={targetBudgetSgd} onChange={(e) => setTargetBudgetSgd(e.target.value)} required />
          </div>
          <div className="field">
            <label>Target rate ({currency} per SGD)</label>
            <input type="number" step="0.0001" min="0.0001" value={targetRate} onChange={(e) => setTargetRate(e.target.value)} required />
          </div>
        </div>

        <div className="row-between" style={{ background: 'var(--accent-soft)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
          <div className="stack">
            <span className="muted">Live quote · {period}</span>
            <strong className="money">
              {quote.data?.forwardRate ? Number(quote.data.forwardRate).toFixed(4) : quote.isLoading ? '…' : '—'} {currency}
            </strong>
            <span className="muted" style={{ fontSize: '0.8em' }}>
              spot {quote.data?.spotRate ? Number(quote.data.spotRate).toFixed(4) : '—'}
            </span>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={!quote.data?.forwardRate}
            onClick={() => setTargetRate(String(Number(quote.data.forwardRate).toFixed(4)))}
          >
            Use forward
          </button>
        </div>

        <label className="row" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={autoLockEnabled} onChange={(e) => setAutoLockEnabled(e.target.checked)} />
          <span className="muted" style={{ marginLeft: 8 }}>Lock automatically when the target rate is hit</span>
        </label>

        <button type="submit" disabled={create.isPending} style={{ width: '100%' }}>
          {create.isPending ? 'Creating…' : 'Create trip goal'}
        </button>
      </form>
    </div>
  )
}
