import { Link } from '@tanstack/react-router'
import { formatMoney } from './data'
import { getDraft, getPurchaseResult, getTrip, tripIdFor } from './storage'
import InsuranceLayout from './components/InsuranceLayout'

export default function Confirmation() {
  const purchase = getPurchaseResult()
  const draft = getDraft()
  if (!purchase)
    return (
      <InsuranceLayout>
        <div className="card">
          <h1>Purchase not found</h1>
          <p className="muted">There is no recent insurance purchase to display.</p>
          <Link to="/insurance">Browse plans</Link>
        </div>
      </InsuranceLayout>
    )
  if (purchase.paymentSuccess !== true)
    return (
      <InsuranceLayout>
        <div className="card">
          <h1>Payment unsuccessful</h1>
          <p className="banner error" role="alert">
            {purchase.paymentMessage || 'Your insurance purchase was not confirmed.'}
          </p>
          <Link to="/insurance">Back to insurance</Link>
        </div>
      </InsuranceLayout>
    )

  const currencyCode = purchase.currencyCode || draft.quote?.currencyCode || 'SGD'
  const premium = purchase.totalPremium ?? purchase.premium ?? draft.quote?.totalPremium
  const paymentFee = Number(purchase.paymentFee)
  const totalDeducted = Number(premium) + (paymentFee || 0)
  // The same rule checkout used to link the policy to a trip.
  const tripId = tripIdFor(getTrip(), draft.trip)

  return (
    <InsuranceLayout>
      <div className="card" style={{ textAlign: 'center', padding: 28 }}>
        <div
          className="avatar"
          style={{ margin: '0 auto 14px', width: 52, height: 52, fontSize: 24 }}
        >
          ✓
        </div>
        <h1>Insurance purchase confirmed</h1>
        <p className="banner ok" role="status">
          {purchase.paymentMessage ||
            'Your payment was successful and your insurance purchase is confirmed.'}
        </p>
      </div>
      <div className="card">
        <div className="card-header">
          <h2>{draft.planName || 'Travel insurance'}</h2>
          <span className="badge active">{purchase.status || 'Payment successful'}</span>
        </div>
        <div className="row-between">
          <span>Policy number</span>
          <strong>{purchase.policyNumber || '—'}</strong>
        </div>
        <div className="row-between" style={{ marginTop: 8 }}>
          <span>Purchase reference</span>
          <strong>{purchase.purchaseId ?? '—'}</strong>
        </div>
        <div className="row-between" style={{ marginTop: 8 }}>
          <span>Destination</span>
          <strong>
            {draft.trip?.destination} ({draft.trip?.destinationCode})
          </strong>
        </div>
        <div className="row-between" style={{ marginTop: 8 }}>
          <span>Premium</span>
          <strong>{formatMoney(premium, currencyCode)}</strong>
        </div>
        {paymentFee > 0 && (
          <div className="row-between" style={{ marginTop: 8 }}>
            <span>Bank fee</span>
            <strong>{formatMoney(paymentFee, currencyCode)}</strong>
          </div>
        )}
        <div className="row-between" style={{ marginTop: 8 }}>
          <span>Total wallet deduction</span>
          <strong>{formatMoney(totalDeducted, currencyCode)}</strong>
        </div>
      </div>
      {/* Bought from a trip page: take them back to that trip, now covered. */}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {tripId ? (
          <Link to="/trips/$tripId" params={{ tripId: String(tripId) }} className="btn">
            Back to {draft.trip?.destination || 'your trip'}
          </Link>
        ) : null}
        <Link to="/insurance/policies" className={tripId ? 'btn secondary' : 'btn'}>
          View my insurance
        </Link>
        <Link to="/insurance" className="btn secondary">
          Buy another policy
        </Link>
      </div>
    </InsuranceLayout>
  )
}
