import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useChildren } from '../../family/queries'
import Banner from '../../../components/Banner'
import { CATEGORIES, blankFixedCost } from '../../budget/constants'
import FixedCostFields from '../../budget/components/FixedCostFields'
import { usePlanTrip } from '../../trips/queries'
import { CURRENCIES, tenorFor } from '../api'
import { useRate } from '../queries'
import { rateText } from '../../../lib/format'
import { ymd } from '../../family/insights'

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
  const [split, setSplit] = useState({}) // category id -> SGD limit, all optional
  const [fixed, setFixed] = useState([]) // upfront costs: { name, categoryId, amount }, max 10

  // With one linked child there is nobody else to pick.
  const linkId = familyLinkId || (active.length === 1 ? String(active[0].familyLinkId) : '')
  const [today] = useState(() => ymd(new Date()))
  const period = tenorFor(tripStartDate)
  const quote = useRate(currency, period)
  const create = usePlanTrip()
  const navigate = useNavigate()
  const splitTotal = Object.values(split).reduce((sum, v) => sum + (Number(v) || 0), 0)
  const overSplit = splitTotal > (Number(targetBudgetSgd) || 0)
  // A fixed cost uses up its category's limit like any spend. A category with no
  // limit set has nothing to exceed. Compared in cents so 0.1 + 0.2 fits 0.3.
  const cents = (v) => Math.round((Number(v) || 0) * 100)
  const overFixed = CATEGORIES.filter(
    (c) =>
      cents(split[c.id]) > 0 &&
      fixed.reduce((sum, f) => sum + (Number(f.categoryId) === c.id ? cents(f.amount) : 0), 0) >
        cents(split[c.id]),
  )
  const blocked = overSplit || overFixed.length > 0

  // PlanTrip opens the trip wallet, creates the trip, sets the SGD category
  // budgets and records the fixed costs in one call. The child comes from the
  // family link on the server.
  function submit(e) {
    e.preventDefault()
    if (blocked) return
    create.mutate(
      {
        FamilyLinkId: Number(linkId),
        Destination: destination.trim(),
        Currency: currency,
        TripStartDate: tripStartDate,
        TripEndDate: tripEndDate,
        TargetBudgetSgd: Number(targetBudgetSgd),
        TargetRate: Number(targetRate),
        AutoLockEnabled: autoLockEnabled,
        Budgets: CATEGORIES.filter((c) => Number(split[c.id]) > 0).map((c) => ({
          CategoryId: c.id,
          LimitAmount: Number(split[c.id]),
        })),
        FixedCosts: fixed.map((f) => ({
          Name: f.name.trim(),
          CategoryId: Number(f.categoryId),
          AmountSgd: Number(f.amount),
        })),
      },
      {
        // The trip exists even when a fixed cost failed to save; the trip page says so.
        onSuccess: (trip) =>
          navigate({
            to: '/trips/$tripId',
            params: { tripId: String(trip.id) },
            state: { fixedCostsFailed: Number(trip.fixedCostsFailed) || 0 },
          }),
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

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="trip-child">Child</label>
          <select
            id="trip-child"
            ref={childRef}
            value={linkId}
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
              min={today}
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
              min={tripStartDate || today}
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
              inputMode="decimal"
              step="0.01"
              min="1"
              value={targetBudgetSgd}
              onChange={(e) => setTargetBudgetSgd(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="trip-target">
              Target rate ({currency} per 1 SGD, higher is better)
            </label>
            <input
              id="trip-target"
              type="number"
              inputMode="decimal"
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
            <span className="muted">Today&apos;s {period} lock rate</span>
            <strong className="money" style={{ fontSize: 20 }}>
              {quote.data?.forwardRate
                ? rateText(quote.data.forwardRate, currency)
                : quote.isLoading
                  ? '…'
                  : '—'}
            </strong>
            <span className="muted" style={{ fontSize: '0.8em' }}>
              Exchange today: {rateText(quote.data?.spotRate, currency)}
            </span>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={!quote.data?.forwardRate}
            onClick={() => setTargetRate(String(Number(quote.data.forwardRate).toFixed(4)))}
          >
            Use this rate
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

        <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>
            Split the budget by category (SGD, optional)
          </legend>
          <div className="grid-2">
            {CATEGORIES.map((c) => (
              <div className="field" key={c.id}>
                <label htmlFor={`trip-split-${c.id}`}>{c.label}</label>
                <input
                  id={`trip-split-${c.id}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={split[c.id] ?? ''}
                  onChange={(e) => setSplit({ ...split, [c.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {overSplit && (
            <p className="banner error" role="alert">
              The categories add up to more than the trip budget.
            </p>
          )}
        </fieldset>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>Fixed costs (SGD, optional)</legend>
          <p className="muted" style={{ margin: '0 0 12px' }}>
            Known upfront costs such as the hotel or flights. They count towards the category limits
            above.
          </p>
          {fixed.map((f, i) => (
            <div key={i} role="group" aria-label={`Fixed cost ${i + 1}`}>
              <FixedCostFields
                id={`trip-fixed-${i}`}
                value={f}
                onChange={(next) => setFixed(fixed.map((x, j) => (j === i ? next : x)))}
              />
              <button
                type="button"
                className="secondary"
                aria-label={`Remove fixed cost ${i + 1}`}
                style={{ marginBottom: 16 }}
                onClick={() => setFixed(fixed.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          {overFixed.map((c) => (
            <p className="banner error" role="alert" key={c.id}>
              Fixed costs in {c.label} are more than its limit.
            </p>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={fixed.length >= 10}
            onClick={() => setFixed([...fixed, blankFixedCost()])}
          >
            Add a fixed cost
          </button>
        </fieldset>

        <button type="submit" disabled={create.isPending || blocked} style={{ width: '100%' }}>
          {create.isPending ? 'Planning…' : 'Plan trip'}
        </button>
      </form>
    </div>
  )
}
