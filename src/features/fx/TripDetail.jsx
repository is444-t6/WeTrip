import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useRole } from '../family/queries'
import { clearSession, getSessionAccountId, isLoggedIn } from '../family/session'
import AppShell from '../family/components/AppShell'
import AuthShell from '../family/components/AuthShell'
import Banner from '../family/components/Banner'
import Money from '../family/components/Money'
import { formatAmount } from '../../lib/money'
import BalanceHero from '../family/components/BalanceHero'
import RateGauge from './components/RateGauge'
import { tripStatus } from './status'
import { tenorFor } from './api'
import { useCancelTrip, useCloseTrip, useLockNow, useRate, useTrip, useTripSpend } from './queries'
import { usePageTitle } from '../../lib/usePageTitle'

export default function TripDetail() {
  const { tripId } = useParams({ from: '/fx/trips/$tripId' })
  const navigate = useNavigate()
  const { data, error, isLoading } = useTrip(tripId)
  const { data: role } = useRole()
  const trip = data?.trip
  usePageTitle(trip?.destination ? `${trip.destination} — SmartFX` : 'Trip')
  const quote = useRate(trip?.currency, tenorFor(trip?.tripStartDate))
  const locks = data?.locks || []
  const spends = data?.spends || []

  function signOut() {
    clearSession()
    window.location.reload()
  }

  if (!isLoggedIn()) {
    return (
      <AuthShell>
        <span className="eyebrow">WeTrip SmartFX</span>
        <h2>You're not signed in yet.</h2>
        <p>Sign in to see this trip goal and its rate locks.</p>
        <button
          className="btn"
          style={{ width: '100%' }}
          onClick={() => navigate({ to: '/family/dev-login' })}
        >
          Continue to sign in
        </button>
      </AuthShell>
    )
  }

  if (error) {
    return (
      <AppShell onSignOut={signOut}>
        <Banner>{error.message}</Banner>
      </AppShell>
    )
  }
  if (isLoading || !trip) {
    return (
      <AppShell onSignOut={signOut}>
        <p className="muted">Loading…</p>
      </AppShell>
    )
  }

  const spentForeign = spends.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const remainingForeign = Math.max(0, (Number(trip.lockedForeign) || 0) - spentForeign)
  const remainingSgd = Math.max(
    0,
    (Number(trip.targetBudgetSgd) || 0) - (Number(trip.lockedSgd) || 0),
  )
  const status = tripStatus(trip.status)

  return (
    <AppShell onSignOut={signOut}>
      <div>
        <Link to="/fx" className="back-link">
          &larr; Back to trips
        </Link>

        <div className="detail-head">
          <div>
            <span className={`badge ${status.tone}`} style={{ marginBottom: 10 }}>
              {status.label}
            </span>
            <h1>{trip.destination}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {String(trip.tripStartDate).slice(0, 10)} → {String(trip.tripEndDate).slice(0, 10)}
              {trip.childNickname ? ` · ${trip.childNickname}` : ''}
            </p>
          </div>
        </div>

        <BalanceHero
          label="Locked pot"
          amount={remainingForeign}
          currency={trip.currency}
          sub={`${formatAmount(trip.lockedSgd)} SGD locked of ${formatAmount(trip.targetBudgetSgd)}`}
          foot={
            <>
              <span>
                {locks.length} lock{locks.length === 1 ? '' : 's'}
              </span>
              {trip.autoLockEnabled && <span>auto-lock on</span>}
            </>
          }
        />

        <div className="detail-grid">
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
        </div>

        <h2 className="section-title">Rate locks</h2>
        <div className="card">
          {locks.length === 0 && <p className="muted">Nothing locked yet.</p>}
          {locks.length > 0 && (
            <>
              <p className="table-hint">Swipe to see all columns &rarr;</p>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Rate locks">
                <table>
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
                        <td>{String(l.createdAt).slice(0, 10)}</td>
                        <td>{Number(l.lockedRate).toFixed(4)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Money amount={l.sgdAmount} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatAmount(l.foreignAmount, trip.currency)}
                        </td>
                        <td className="muted">{l.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <h2 className="section-title">Spending</h2>
        <div className="card">
          {spends.length === 0 && <p className="muted">No spending recorded.</p>}
          {spends.length > 0 && (
            <>
              <p className="table-hint">Swipe to see all columns &rarr;</p>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Trip spending">
                <table>
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
                        <td>{String(s.createdAt).slice(0, 10)}</td>
                        <td>{s.category}</td>
                        <td className="muted">{s.merchantAccountId}</td>
                        <td style={{ textAlign: 'right' }}>
                          {formatAmount(s.amount, trip.currency)} {trip.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {trip.status === 'Completed' && (
          <div className="card">
            <div className="card-header">
              <h2>Converted back</h2>
              <span className="badge active">closed</span>
            </div>
            <div className="row-between">
              <span className="muted">
                {formatAmount(trip.returnedForeign, trip.currency)} {trip.currency} at{' '}
                {Number(trip.returnRate).toFixed(4)}
              </span>
              <span className="money">
                <Money amount={trip.returnedSgd} />
              </span>
            </div>
          </div>
        )}
      </div>
    </AppShell>
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
        <h2>Controls</h2>
        <span className="badge pending">{formatAmount(remainingSgd)} SGD unlocked</span>
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
          <label htmlFor="lock-amount">Lock now (SGD)</label>
          <input
            id="lock-amount"
            type="number"
            step="0.01"
            min="1"
            value={amount}
            placeholder={formatAmount(remainingSgd)}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lock-tenor">Tenor</label>
          <select id="lock-tenor" value={period} onChange={(e) => setPeriod(e.target.value)}>
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

      <div className="controls-row">
        <button
          type="button"
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
          className="danger"
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
            `${formatAmount(amount, trip.currency)} ${trip.currency} paid · ${formatAmount(r.remainingForeign ?? remainingForeign - Number(amount), trip.currency)} ${trip.currency} left`,
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
      <h2>Pay from the pot</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        Spend directly from the locked currency pot.
      </p>
      <Banner>{spend.error?.message}</Banner>
      <Banner kind="ok">{message}</Banner>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="spend-merchant">Merchant account id</label>
          <input
            id="spend-merchant"
            value={merchantAccountId}
            onChange={(e) => setMerchantAccountId(e.target.value)}
            required
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="spend-amount">Amount ({trip.currency})</label>
            <input
              id="spend-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="spend-category">Category</label>
            <input
              id="spend-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="spend-note">Note (optional)</label>
          <input id="spend-note" value={narrative} onChange={(e) => setNarrative(e.target.value)} />
        </div>
        <button disabled={spend.isPending} type="submit" style={{ width: '100%' }}>
          {spend.isPending ? 'Paying…' : 'Pay'}
        </button>
      </form>
    </div>
  )
}
