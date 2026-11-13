import { useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  formatMoney,
  getTodayDateInputValue,
  isReasonableBirthDate,
  isValidTripDates,
  planLabel,
} from './data'
import { useInsurancePlans, usePurchaseInsurance } from './queries'
import { newRequestId } from '../trips/api'
import { useTripMiles } from '../trips/queries'
import { clearPurchaseResult, getDraft, getTrip, savePurchaseResult, tripIdFor } from './storage'
import Money from '../../components/Money'
import InsuranceLayout from './components/InsuranceLayout'

export default function Checkout() {
  const draft = getDraft()
  const { data: plans = [], isLoading, error: plansError } = useInsurancePlans()
  const plan = plans.find((p) => String(p.id) === String(draft.insurancePlanId))
  const purchase = usePurchaseInsurance()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [useMiles, setUseMiles] = useState(false)
  // One id per purchase attempt: a repeat of it is a no-op on the server.
  const requestId = useRef(newRequestId())
  const tripId = tripIdFor(getTrip(), draft.trip)
  const { data: tripMiles } = useTripMiles(tripId)
  // 100 miles = SGD 1.00, so a mile is a cent; at least SGD 0.01 is still charged.
  const premiumCents = Math.round(Number(draft.quote?.totalPremium) * 100)
  const redeemMiles = Math.min(Math.floor(Number(tripMiles?.childBalance) || 0), premiumCents - 1)
  const quotedDays = Number(draft.quote?.tripDays)
  const hasQuotedDays = Number.isFinite(quotedDays) && quotedDays > 0

  async function confirmPurchase() {
    setError('')
    if (!isValidTripDates(draft.trip?.startDate, draft.trip?.endDate, getTodayDateInputValue())) {
      setError(
        'Travel dates must start today or later, and the return date must be on or after departure. Please update your trip dates.',
      )
      return
    }
    if (draft.travellers.some((traveller) => !isReasonableBirthDate(traveller.dob))) {
      setError(
        'Each traveller must have a date of birth before today and within the past 120 years.',
      )
      return
    }

    try {
      clearPurchaseResult()
      const result = await purchase.mutateAsync({
        InsurancePlanId: Number(draft.insurancePlanId),
        CoverageStart: draft.trip.startDate,
        CoverageEnd: draft.trip.endDate,
        DestinationCode: draft.trip.destinationCode,
        // Started from a trip page with the same dates: link the policy to that trip.
        TripId: tripId,
        RedeemMiles: useMiles && redeemMiles > 0 ? redeemMiles : 0,
        RequestId: requestId.current,
        Travellers: draft.travellers.map((t) => ({
          FullName: t.name,
          DateOfBirth: t.dob,
          Email: draft.email,
          NationalityCode: t.nationalityCode,
        })),
      })
      if (result?.paymentSuccess !== true) {
        // A definite decline released any held miles; the next attempt is a new one.
        requestId.current = newRequestId()
        setError(
          result?.paymentMessage ||
            'Payment was unsuccessful. Your insurance purchase was not confirmed.',
        )
        return
      }

      savePurchaseResult(result)
      await navigate({ to: '/insurance/confirmation' })
    } catch (e) {
      setError(
        e.message || 'The insurance service could not complete this purchase. Please try again.',
      )
    }
  }

  if (!draft.insurancePlanId || !draft.trip || !draft.travellers?.length)
    return (
      <InsuranceLayout>
        <div className="card">
          Your checkout details are missing. <Link to="/insurance">Start again</Link>.
        </div>
      </InsuranceLayout>
    )
  if (isLoading)
    return (
      <InsuranceLayout>
        <div className="card muted">Loading checkout…</div>
      </InsuranceLayout>
    )
  if (plansError)
    return (
      <InsuranceLayout>
        <div className="card">
          <div className="banner error" role="alert">
            Could not load plans: {plansError.message}
          </div>
          <Link to="/insurance">Start again</Link>
        </div>
      </InsuranceLayout>
    )
  if (!plan)
    return (
      <InsuranceLayout>
        <div className="card">
          The selected plan is unavailable. <Link to="/insurance">Choose another plan</Link>.
        </div>
      </InsuranceLayout>
    )

  return (
    <InsuranceLayout>
      <Link to="/insurance/travellers" search={{ planId: draft.planId }} className="muted">
        ← Edit traveller details
      </Link>
      <h1 style={{ marginTop: 16 }}>Checkout summary</h1>
      <div className="card">
        <div className="card-header">
          <h2>Trip</h2>
          <span className="badge pending">Insurance quote</span>
        </div>
        <div className="row-between">
          <span>Destination</span>
          <strong>
            {draft.trip.destination} ({draft.trip.destinationCode})
          </strong>
        </div>
        <div className="row-between" style={{ marginTop: 8 }}>
          <span>Travel dates</span>
          <strong>
            {draft.trip.startDate} – {draft.trip.endDate}
          </strong>
        </div>
      </div>
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Selected plan</h2>
        <div className="row-between">
          <strong>
            {planLabel(plan)} · {draft.coverType === 'family' ? 'Family' : 'Individual'}
          </strong>
          <strong>{draft.travellers.length} traveller(s)</strong>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Travellers: {draft.travellers.map((t) => t.name).join(', ')}
        </p>
        <p className="muted">Contact: {draft.email}</p>
        <hr style={{ border: 0, borderTop: '1px solid var(--card-border)', margin: '16px 0' }} />
        <div className="row-between">
          <span>
            Final quoted premium
            {hasQuotedDays ? ` · ${quotedDays} covered ${quotedDays === 1 ? 'day' : 'days'}` : ''}
          </span>
          <strong className="money">
            {formatMoney(draft.quote?.totalPremium, draft.quote?.currencyCode || plan.currencyCode)}
          </strong>
        </div>
        {redeemMiles > 0 && (
          <label style={{ display: 'block', marginTop: 12 }}>
            <input
              type="checkbox"
              checked={useMiles}
              onChange={(e) => setUseMiles(e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            Use {redeemMiles} {redeemMiles === 1 ? 'mile' : 'miles'} (
            <Money amount={redeemMiles / 100} /> off)
          </label>
        )}
        <p className="muted" style={{ marginTop: 12 }}>
          Final price calculated by the insurance service for your trip and selected travellers.
          Confirming sends these details to the insurance service.
        </p>
      </div>
      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}
      <button
        type="button"
        disabled={purchase.isPending}
        onClick={confirmPurchase}
        style={{ width: '100%' }}
      >
        {purchase.isPending ? 'Submitting…' : 'Confirm purchase'}
      </button>
    </InsuranceLayout>
  )
}
