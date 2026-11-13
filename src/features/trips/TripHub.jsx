import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useCurrentUser } from '../auth/useCurrentUser'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import Money from '../../components/Money'
import SignedOutCard from '../../components/SignedOutCard'
import { useChildren, useChildDashboard } from '../family/queries'
import { useChildTrips } from '../family/tripQueries'
import { saveTrip } from '../insurance/storage'
import { demoLabel, isEnded, tripStatus } from '../fx/status'
import PayLaterCard from './PayLaterCard'
import FixedCostsNotice from './FixedCostsNotice'
import ReceiptForm from './ReceiptForm'
import { useCloseOptions, useCloseTrip, useTripOverview } from './queries'
import { COUNTRY_BY_CURRENCY, day, milesLabel } from './trip'
import { useState } from 'react'

// One trip, every feature, from one call: Trip.GetTripOverview gathers the SmartFX
// trip, its locks and spends, the SGD budget and the policies bought for it. The
// child pays from here (Pay on this trip) and the parent closes the trip here.
export default function TripHub() {
  const { tripId } = useParams({ from: '/trips/$tripId' })
  const { data, error, isLoading } = useTripOverview(tripId)
  const { role } = useCurrentUser()

  function signOut() {
    clearSession()
    window.location.reload()
  }
  const shell = (content) => <AppShell onSignOut={signOut}>{content}</AppShell>

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip" />
  if (error) return shell(<Banner>{error.message}</Banner>)
  if (isLoading || !data) return shell(<p className="muted">Loading…</p>)

  const trip = data.trip
  return shell(
    <>
      <Link to="/fx" className="back-link">
        &larr; All trips
      </Link>
      <FixedCostsNotice />
      <div className="row-between trip-head" style={{ marginBottom: 4 }}>
        <div className="stack">
          <h1 style={{ margin: 0 }}>{trip.destination}</h1>
          <span className="muted">
            {day(trip.tripStartDate)} → {day(trip.tripEndDate)}
          </span>
        </div>
        <span className="row" style={{ gap: 6 }}>
          {demoLabel(trip) && <span className="badge pending">{demoLabel(trip)}</span>}
          <span className={`badge ${tripStatus(trip.status).tone}`}>
            {tripStatus(trip.status).label}
          </span>
        </span>
      </div>

      {role === 'Child' && !isEnded(trip.status) && Number(data.remainingForeign) > 0 && (
        <Link
          to="/pay"
          search={{ tripId: Number(tripId) }}
          className="btn"
          style={{ marginTop: 12 }}
        >
          Pay on this trip
        </Link>
      )}

      {role === 'Child' && !isEnded(trip.status) && <ReceiptForm trip={trip} />}

      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <MoneyCard tripId={tripId} overview={data} />
        <BudgetCard tripId={tripId} role={role} overview={data} />
        <PayLaterCard plans={data.bnplPlans} currency={trip.currency} />
        <InsuranceCard trip={trip} role={role} tripPolicies={data.policies} />
        <FamilyCard trip={trip} role={role} />
      </div>

      {((role === 'Parent' && !isEnded(trip.status)) || trip.status === 'Completed') && (
        <CloseTripCard tripId={tripId} trip={trip} />
      )}
    </>,
  )
}

// Another trip's destination from this family's SmartFX list; undefined until it loads.
// Reads the list only when `enabled`, so ordinary trips cost no extra call.
function useDestinationOf(familyLinkId, enabled) {
  const { data } = useChildTrips(enabled ? familyLinkId : undefined)
  return (id) => data?.find((t) => Number(t.tripId) === Number(id))?.destination
}

function MoneyCard({ tripId, overview }) {
  const trip = overview.trip
  // Money other trips handed over on closing (lock Source "CarryOver", reference "carry:<trip id>").
  const carries = (overview.locks ?? []).filter((l) => l.source === 'CarryOver')
  const destinationOf = useDestinationOf(trip.familyLinkId, carries.length > 0)
  const target = Number(trip.targetBudgetSgd) || 0
  const locked = Number(trip.lockedSgd) || 0
  const pct = target ? Math.min(100, (locked / target) * 100) : 0
  const foreignLocked = Number(trip.lockedForeign) || 0
  const spent = Number(overview.spentForeign) || 0
  const left = Number(overview.remainingForeign) || 0
  const rate = Number(overview.lockedRate) || 0
  const miles = Number(overview.milesEarned) || 0
  return (
    <div className="card" aria-label="Money">
      <div className="card-header">
        <h3>Money (SmartFX)</h3>
      </div>
      <div className="progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="row-between muted" style={{ fontSize: '0.85em', marginTop: 4 }}>
        <span>
          <Money amount={locked} /> locked
        </span>
        <span>
          of <Money amount={target} />
        </span>
      </div>
      <p style={{ margin: '10px 0 0' }}>
        {foreignLocked > 0 ? (
          <>
            <Money amount={left} currency={trip.currency} /> left of{' '}
            <Money amount={foreignLocked} currency={trip.currency} /> (
            <Money amount={spent} currency={trip.currency} /> spent)
            {rate > 0 && (
              <span className="muted" style={{ display: 'block', fontSize: '0.85em' }}>
                Locked at {rate.toFixed(4)} {trip.currency} per SGD
              </span>
            )}
          </>
        ) : (
          <span className="muted">Nothing locked yet.</span>
        )}
      </p>
      {carries.map((l) => (
        <p key={l.referenceNumber} style={{ margin: '6px 0 0' }}>
          Carried <Money amount={l.foreignAmount} currency={trip.currency} /> from{' '}
          {destinationOf(String(l.referenceNumber).replace('carry:', '')) || 'an earlier trip'}
        </p>
      ))}
      {miles > 0 && <p style={{ margin: '6px 0 0' }}>{milesLabel(miles)} earned on this trip</p>}
      <Link
        to="/fx/trips/$tripId"
        params={{ tripId: String(tripId) }}
        className="btn secondary"
        style={{ width: '100%', marginTop: 12 }}
      >
        Manage FX &amp; locks
      </Link>
    </div>
  )
}

function BudgetCard({ tripId, role, overview }) {
  const summary = overview.hasBudget ? overview.budget : null
  const lines = summary?.lines ?? []
  const alerts = lines.filter((l) => l.alertLevel && l.alertLevel !== 'OK').length
  return (
    <div className="card" aria-label="Budget">
      <div className="card-header">
        <h3>Budget</h3>
        {alerts > 0 && <span className="badge removed">{alerts} near or over</span>}
      </div>
      {lines.length > 0 ? (
        <>
          <p style={{ margin: 0 }}>
            <Money amount={summary.totalSpent} currency="SGD" /> spent of{' '}
            <Money amount={summary.totalLimit} currency="SGD" />
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {lines.length} categories
          </p>
        </>
      ) : (
        <p className="muted">
          No category budget yet.
          {role === 'Parent' ? ' Split the trip money by category.' : ''}
        </p>
      )}
      {Number(summary?.fixedSgd) > 0 && (
        <p className="muted" style={{ margin: '4px 0 0' }}>
          <Money amount={summary.fixedSgd} currency="SGD" /> fixed
        </p>
      )}
      <Link
        to="/budget/$tripId"
        params={{ tripId: String(tripId) }}
        className="btn secondary"
        style={{ width: '100%', marginTop: 12 }}
      >
        {lines.length > 0 || role !== 'Parent' ? 'Open budget' : 'Set a budget'}
      </Link>
    </div>
  )
}

function InsuranceCard({ trip, role, tripPolicies }) {
  const navigate = useNavigate()
  // Only policies bought for this trip (linked by TripId) count as cover.
  const covering = (tripPolicies ?? []).filter((p) => p.status !== 'Cancelled')

  // Start the insurance flow with this trip's destination and dates already filled in.
  function getCover() {
    saveTrip({
      tripId: trip.id,
      destination: trip.destination,
      destinationCode: COUNTRY_BY_CURRENCY[trip.currency] || '',
      startDate: day(trip.tripStartDate),
      endDate: day(trip.tripEndDate),
    })
    navigate({ to: '/insurance' })
  }

  return (
    <div className="card" aria-label="Insurance">
      <div className="card-header">
        <h3>Insurance</h3>
        {covering.length > 0 && <span className="badge active">Covered</span>}
      </div>
      {covering.length > 0 ? (
        <p style={{ margin: 0 }}>
          {covering.length === 1 ? '1 policy covers' : `${covering.length} policies cover`} this
          trip.
        </p>
      ) : (
        <p className="muted">No policy covers this trip yet.</p>
      )}
      {covering.length > 0 ? (
        <Link
          to="/insurance/policies"
          className="btn secondary"
          style={{ width: '100%', marginTop: 12 }}
        >
          Open my insurance
        </Link>
      ) : role === 'Parent' ? (
        <button type="button" onClick={getCover} style={{ width: '100%', marginTop: 12 }}>
          Get cover for this trip
        </button>
      ) : null}
    </div>
  )
}

function FamilyCard({ trip, role }) {
  const parentView = role === 'Parent'
  const childView = role === 'Child'
  const children = useChildren()
  const dash = useChildDashboard()
  const linked = parentView
    ? children.data?.find((c) => c.familyLinkId === trip.familyLinkId)
    : null
  const who = parentView ? linked : childView ? dash.data : null
  const name = parentView ? linked?.nickname : dash.data?.nickname
  const loading =
    useCurrentUser().isLoading ||
    (parentView && children.isLoading) ||
    (childView && dash.isLoading)
  const budget = Number(who?.budget) || 0
  const spent = Number(who?.spent) || 0
  return (
    <div className="card" aria-label="Family">
      <div className="card-header">
        <h3>Family</h3>
      </div>
      {who ? (
        <>
          <p style={{ margin: 0 }}>
            <strong>{name || 'Child'}</strong> has <Money amount={who.balance} />
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {budget > 0 ? (
              <>
                <Money amount={spent} /> spent of <Money amount={budget} /> this period
              </>
            ) : (
              'No spending limit set.'
            )}
          </p>
        </>
      ) : (
        <p className="muted">{loading ? 'Loading…' : 'No child account is linked to this trip.'}</p>
      )}
      {who && (
        <Link
          to={parentView ? '/family/child/$familyLinkId' : '/family'}
          params={parentView ? { familyLinkId: String(trip.familyLinkId) } : undefined}
          className="btn secondary"
          style={{ width: '100%', marginTop: 12 }}
        >
          {parentView ? 'Manage in Family' : 'Open Family'}
        </Link>
      )}
    </div>
  )
}

const BETTER_LINE = {
  Spot: 'Converting now beats your locked cost',
  Locked: "Your locked cost beats today's rate",
}

// Before closing: what the leftover is worth at today's rate against what it cost
// at the locked rate. Preview only; the CloseTrip reply stays authoritative.
// Shows nothing when there is nothing unspent or GetCloseOptions fails.
function CloseOptions({ data }) {
  if (!(Number(data?.unspentForeign) > 0)) return null
  return (
    <div style={{ margin: '0 0 12px' }}>
      <p style={{ margin: 0 }}>
        Value in SGD at today's rate: <Money amount={data.valueAtSpotSgd} />
      </p>
      <p style={{ margin: '4px 0 0' }}>
        What it cost you at your locked rate: <Money amount={data.costAtLockedSgd} />
      </p>
      {BETTER_LINE[data.better] && (
        <p style={{ margin: '4px 0 0' }}>
          <strong>{BETTER_LINE[data.better]}</strong>
        </p>
      )}
      <p className="muted" style={{ margin: '4px 0 0' }}>
        No money moves when you close.
      </p>
    </div>
  )
}

// Closing values whatever foreign money is left at today's server spot rate and
// marks the trip Completed. No money moves; the confirm step says so. Instead, the
// parent can keep the leftover for another eligible trip: a WeTrip ledger move.
function CloseTripCard({ tripId, trip }) {
  const close = useCloseTrip(tripId)
  const [confirming, setConfirming] = useState(false)
  const [keep, setKeep] = useState(false)
  const [pick, setPick] = useState('')
  // After the refetch the trip reads Completed; keep showing what closing found,
  // rebuilt from the stored close for anyone opening the trip later.
  const lockedForeign = Number(trip.lockedForeign) || 0
  const returnRate = Number(trip.returnRate) || 0
  // The CloseTrip reply's trip is newer than the prop until the overview refetches.
  const closed = close.data?.trip ?? trip
  const carriedTo = Number(closed.carriedToTripId) || 0
  const destinationOf = useDestinationOf(trip.familyLinkId, carriedTo > 0)
  const result =
    close.data ??
    (trip.status === 'Completed'
      ? {
          returnedForeign: trip.returnedForeign,
          returnedSgd: trip.returnedSgd,
          savedVsSpotSgd:
            returnRate > 0 && lockedForeign > 0
              ? lockedForeign / returnRate - (Number(trip.lockedSgd) || 0)
              : 0,
        }
      : null)
  const options = useCloseOptions(tripId, !result).data
  const eligible = options?.eligibleTrips ?? []
  const next = keep ? (eligible.find((t) => String(t.tripId) === pick) ?? eligible[0]) : null
  return (
    <div className="card" aria-label="Close trip" style={{ marginTop: 16 }}>
      <div className="card-header">
        <h3>Close &amp; convert back</h3>
      </div>
      <Banner>{close.error?.message}</Banner>
      {!result && <CloseOptions data={options} />}
      {carriedTo > 0 ? (
        <p style={{ margin: 0 }}>
          Trip closed. <Money amount={closed.carriedForeign} currency={trip.currency} /> carried to{' '}
          {destinationOf(carriedTo) || 'your next trip'}.
        </p>
      ) : result ? (
        <p style={{ margin: 0 }}>
          Trip closed. <Money amount={result.returnedForeign} currency={trip.currency} /> unspent,
          worth <Money amount={result.returnedSgd} /> today.{' '}
          {Number(result.savedVsSpotSgd) >= 0 ? 'Locking saved ' : 'Locking cost '}
          <Money amount={Math.abs(Number(result.savedVsSpotSgd) || 0)} /> versus today's rate.
        </p>
      ) : confirming ? (
        <>
          {Number(options?.unspentForeign) > 0 && (
            <div className="field">
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                Keep for my next trip
              </label>
              {keep &&
                (next ? (
                  <select
                    aria-label="Which trip"
                    value={next.tripId}
                    onChange={(e) => setPick(e.target.value)}
                  >
                    {eligible.map((t) => (
                      <option key={t.tripId} value={t.tripId}>
                        {t.destination}, {day(t.tripStartDate)} → {day(t.tripEndDate)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="muted" style={{ margin: '8px 0 0' }}>
                    No Watching or Partly locked {trip.currency} trip has room for this yet.
                  </p>
                ))}
            </div>
          )}
          <p style={{ margin: '0 0 12px' }}>
            {keep
              ? `Close the trip and move the unspent ${trip.currency} to ${next?.destination ?? 'your next trip'}? This is a WeTrip ledger move, not a bank transfer. This cannot be undone.`
              : `Close the trip and value the unspent ${trip.currency} at today's rate? This cannot be undone.`}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              disabled={close.isPending || (keep && !next)}
              onClick={() => close.mutate(next?.tripId)}
            >
              {close.isPending ? 'Closing…' : 'Close trip'}
            </button>
            <button type="button" className="secondary" onClick={() => setConfirming(false)}>
              Keep it open
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="secondary" onClick={() => setConfirming(true)}>
          Close trip
        </button>
      )}
    </div>
  )
}
