import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useChildren } from '../../family/queries'
import { getSessionCustomerId } from '../../auth/session'
import Banner from '../../../components/Banner'
import { CURRENCIES, tenorFor } from '../api'
import { useCreateTrip, useRate } from '../queries'

export default function NewTripForm() {
  const { data: children } = useChildren()
  const active = (children || []).filter((c) => c.status === 'Active')

  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const childRef = useRef(null)
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
          requestAnimationFrame(() => triggerRef.current?.focus())
        },
      },
    )
  }

  function openForm() {
    setOpen(true)
    requestAnimationFrame(() => childRef.current?.focus())
  }

  function closeForm() {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        className="btn"
        style={{ width: '100%' }}
        onClick={openForm}
        disabled={active.length === 0}
      >
        {active.length === 0 ? 'Link a child first' : 'New trip goal'}
      </button>
    )
  }

  return (
    <div className="card new-trip-form">
      <div className="card-header">
        <div>
          <h3>New trip goal</h3>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            Set a budget and target rate — SmartFX watches the market for you.
          </p>
        </div>
        <button className="secondary" type="button" onClick={closeForm}>
          Close
        </button>
      </div>
      <Banner>{create.error?.message}</Banner>

      <div className="quote-panel" style={{ marginBottom: 16 }}>
        <div className="stack">
          <strong>Travel insurance is optional.</strong>
          <span className="muted">Compare illustrative cover for this trip after planning.</span>
        </div>
        <Link
          to="/insurance"
          search={{ destination, startDate: tripStartDate, endDate: tripEndDate }}
          className="btn btn-sm"
        >
          Explore travel insurance →
        </Link>
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="trip-child">Child</label>
          <select
            id="trip-child"
            ref={childRef}
            value={familyLinkId}
            onChange={(e) => setFamilyLinkId(e.target.value)}
            required
          >
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
            <label htmlFor="trip-destination">Destination</label>
            <input
              id="trip-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Tokyo"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="trip-currency">Currency</label>
            <select
              id="trip-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="trip-depart">Depart</label>
            <input
              id="trip-depart"
              type="date"
              value={tripStartDate}
              onChange={(e) => setTripStartDate(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="trip-return">Return</label>
            <input
              id="trip-return"
              type="date"
              value={tripEndDate}
              onChange={(e) => setTripEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="trip-budget">Budget (SGD)</label>
            <input
              id="trip-budget"
              type="number"
              step="0.01"
              min="1"
              value={targetBudgetSgd}
              onChange={(e) => setTargetBudgetSgd(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="trip-target">Target rate ({currency} per SGD)</label>
            <input
              id="trip-target"
              type="number"
              step="0.0001"
              min="0.0001"
              value={targetRate}
              onChange={(e) => setTargetRate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="quote-panel">
          <div className="stack">
            <span className="muted">Live quote · {period}</span>
            <strong className="money" style={{ fontSize: 20 }}>
              {quote.data?.forwardRate
                ? Number(quote.data.forwardRate).toFixed(4)
                : quote.isLoading
                  ? '…'
                  : '—'}{' '}
              {currency}
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

        <label className="row" style={{ marginBottom: 16, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={autoLockEnabled}
            onChange={(e) => setAutoLockEnabled(e.target.checked)}
          />
          <span className="muted" style={{ marginLeft: 8 }}>
            Lock automatically when the target rate is hit
          </span>
        </label>

        <button type="submit" disabled={create.isPending} style={{ width: '100%' }}>
          {create.isPending ? 'Creating…' : 'Create trip goal'}
        </button>
      </form>
    </div>
  )
}
