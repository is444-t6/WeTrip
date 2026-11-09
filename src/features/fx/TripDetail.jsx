import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useRole } from '../family/queries'
import { clearSession, getSessionAccountId, isLoggedIn } from '../auth/session'
import AppShell from '../family/components/AppShell'
import Banner from '../family/components/Banner'
import SignedOutCard from '../family/components/SignedOutCard'
import Money from '../family/components/Money'
import BalanceHero from '../family/components/BalanceHero'
import RateGauge from './components/RateGauge'
import { tenorFor } from './api'
import { useCancelTrip, useCloseTrip, useLockNow, useRate, useTrip, useTripSpend } from './queries'

export default function TripDetail() {
  const { tripId } = useParams({ from: '/fx/trips/$tripId' })
  const { data, error, isLoading } = useTrip(tripId)
  const { data: role } = useRole()

  const trip = data?.trip
  const quote = useRate(trip?.currency, tenorFor(trip?.tripStartDate))
  const locks = data?.locks || []
  const spends = data?.spends || []

  function signOut() {
    clearSession()
    window.location.reload()
  }

  // Every state of the page sits inside the app shell, so the navbar and the
  // side gutter are always there, including while loading or after an error.
  const shell = (content) => <AppShell onSignOut={signOut}>{content}</AppShell>

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip SmartFX" />
  if (error) return shell(<Banner>{error.message}</Banner>)
  if (isLoading || !trip) return shell(<p className="muted">Loading…</p>)

  const spentForeign = spends.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const remainingForeign = Math.max(0, (Number(trip.lockedForeign) || 0) - spentForeign)
  const remainingSgd = Math.max(
    0,
    (Number(trip.targetBudgetSgd) || 0) - (Number(trip.lockedSgd) || 0),
  )
  return shell(
    <>
      <Link
        to="/fx"
        className="muted"
        style={{ display: 'inline-block', marginBottom: 14, fontWeight: 600 }}
      >
        &larr; Back to trips
      </Link>

      <h1 style={{ fontSize: '1.4rem', marginBottom: 4 }}>{trip.destination}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {String(trip.tripStartDate).slice(0, 10)} → {String(trip.tripEndDate).slice(0, 10)} ·{' '}
        {trip.status}
        {trip.childNickname ? ` · ${trip.childNickname}` : ''}
      </p>

      <BalanceHero
        label="Locked pot"
        amount={remainingForeign}
        currency={trip.currency}
        sub={`${Number(trip.lockedSgd).toFixed(2)} SGD locked of ${Number(trip.targetBudgetSgd).toFixed(2)}`}
        foot={
          <>
            <span>
              {locks.length} lock{locks.length === 1 ? '' : 's'}
            </span>
            {trip.autoLockEnabled && <span>auto-lock on</span>}
          </>
        }
      />

      <RateGauge
        current={quote.data?.forwardRate}
        target={trip.targetRate}
        currency={trip.currency}
      />

      {role === 'Parent' && (
        <ParentActions
          trip={trip}
          remainingSgd={remainingSgd}
          currentRate={quote.data?.forwardRate}
          onCheck={quote.refetch}
          checking={quote.isFetching}
        />
      )}
      {role === 'Child' && <SpendCard trip={trip} remainingForeign={remainingForeign} />}

      <div className="section-title">Rate locks</div>
      <div className="card">
        {locks.length === 0 && <p className="muted">Nothing locked yet.</p>}
        {locks.length > 0 && (
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Rate</th>
                <th style={{ textAlign: 'right' }}>SGD</th>
                <th style={{ textAlign: 'right' }}>{trip.currency}</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {locks.map((l) => (
                <tr key={l.lockId}>
                  <td data-label="Date">{String(l.createdAt).slice(0, 10)}</td>
                  <td data-label="Rate">{Number(l.lockedRate).toFixed(4)}</td>
                  <td data-label="SGD" style={{ textAlign: 'right' }}>
                    <Money amount={l.sgdAmount} />
                  </td>
                  <td data-label={trip.currency} style={{ textAlign: 'right' }}>
                    {Number(l.foreignAmount).toFixed(2)}
                  </td>
                  <td data-label="Source" className="muted">
                    {l.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">Spending</div>
      <div className="card">
        {spends.length === 0 && <p className="muted">No spending recorded.</p>}
        {spends.length > 0 && (
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>To</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {spends.map((s) => (
                <tr key={s.spendId}>
                  <td data-label="Date">{String(s.createdAt).slice(0, 10)}</td>
                  <td data-label="Category">{s.category}</td>
                  <td data-label="To" className="muted">
                    {s.merchantAccountId}
                  </td>
                  <td data-label="Amount" style={{ textAlign: 'right' }}>
                    {Number(s.amount).toFixed(2)} {trip.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {trip.status === 'Completed' && (
        <div className="card">
          <div className="card-header">
            <h3>Converted back</h3>
            <span className="badge active">closed</span>
          </div>
          <div className="row-between">
            <span className="muted">
              {Number(trip.returnedForeign).toFixed(2)} {trip.currency} at{' '}
              {Number(trip.returnRate).toFixed(4)}
            </span>
            <span className="money">
              <Money amount={trip.returnedSgd} />
            </span>
          </div>
        </div>
      )}
    </>,
  )
}

function ParentActions({ trip, remainingSgd, currentRate, onCheck, checking }) {
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState(tenorFor(trip.tripStartDate))
  const lock = useLockNow()
  const cancel = useCancelTrip()
  const close = useCloseTrip()

  const rate = Number(currentRate) || 0
  const canClose = (Number(trip.lockedForeign) || 0) > 0 && rate > 0
  const error = lock.error || cancel.error || close.error

  return (
    <div className="card">
      <div className="card-header">
        <h3>Controls</h3>
        <span className="badge pending">{remainingSgd.toFixed(2)} SGD unlocked</span>
      </div>
      <Banner>{error?.message}</Banner>
      <Banner kind="ok">
        {close.data
          ? `Converted ${Number(close.data.returnedForeign).toFixed(2)} ${trip.currency} back at ${Number(close.data.returnRate).toFixed(4)}.`
          : lock.data
            ? `Locked ${Number(lock.data.lock?.sgdAmount).toFixed(2)} SGD at ${Number(lock.data.lock?.lockedRate).toFixed(4)}.`
            : ''}
      </Banner>

      <div className="grid-2">
        <div className="field">
          <label>Lock now (SGD)</label>
          <input
            type="number"
            step="0.01"
            min="1"
            value={amount}
            placeholder={remainingSgd.toFixed(2)}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Tenor</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="1M">1M</option>
            <option value="3M">3M</option>
            <option value="6M">6M</option>
            <option value="1Y">1Y</option>
          </select>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.85em' }}>
        Locks at the live {period} forward ({rate ? rate.toFixed(4) : '—'} {trip.currency} per SGD),
        not at a rate you type.
      </p>

      <div className="actions-grid">
        <button
          type="button"
          className="span-2"
          disabled={lock.isPending || remainingSgd <= 0}
          onClick={() =>
            lock.mutate({
              tripId: trip.tripId,
              sgdAmount: Number(amount) || remainingSgd,
              rate,
              period,
              parentAccountId: getSessionAccountId(),
            })
          }
        >
          {lock.isPending ? 'Locking…' : 'Lock rate'}
        </button>
        <button type="button" className="secondary" disabled={checking} onClick={onCheck}>
          {checking ? 'Checking…' : 'Check now'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!canClose || close.isPending}
          onClick={() => close.mutate({ tripId: trip.tripId, rate })}
        >
          {close.isPending ? 'Converting…' : 'Close & convert back'}
        </button>
        <button
          type="button"
          className="danger span-2"
          disabled={cancel.isPending || trip.status === 'Completed'}
          onClick={() => cancel.mutate(trip.tripId)}
        >
          Cancel trip
        </button>
      </div>
    </div>
  )
}

function SpendCard({ trip, remainingForeign }) {
  const [amount, setAmount] = useState('')
  const [merchantAccountId, setMerchantAccountId] = useState('')
  const [category, setCategory] = useState('General')
  const [narrative, setNarrative] = useState('')
  const [message, setMessage] = useState('')
  const spend = useTripSpend()

  function submit(e) {
    e.preventDefault()
    setMessage('')
    spend.mutate(
      {
        tripId: trip.tripId,
        merchantAccountId: merchantAccountId.trim(),
        amount: Number(amount),
        category,
        narrative,
      },
      {
        onSuccess: (r) => {
          setMessage(
            `${Number(amount).toFixed(2)} ${trip.currency} paid · ${Number(r.remainingForeign ?? remainingForeign - Number(amount)).toFixed(2)} ${trip.currency} left`,
          )
          setAmount('')
          setMerchantAccountId('')
          setNarrative('')
        },
      },
    )
  }

  return (
    <div className="card">
      <h3>Pay from the pot</h3>
      <Banner>{spend.error?.message}</Banner>
      <Banner kind="ok">{message}</Banner>
      <form onSubmit={submit}>
        <div className="field">
          <label>Merchant account id</label>
          <input
            value={merchantAccountId}
            onChange={(e) => setMerchantAccountId(e.target.value)}
            required
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Amount ({trip.currency})</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
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
        <button disabled={spend.isPending} type="submit" style={{ width: '100%' }}>
          {spend.isPending ? 'Paying…' : 'Pay'}
        </button>
      </form>
    </div>
  )
}
