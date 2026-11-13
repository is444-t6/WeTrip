import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { PlanOptions } from '../scantopay/components/PaymentPreview'
import { PaidLater } from '../scantopay/components/PaymentResult'

// Pay later on a trip: the bank bills the instalments, the trip pot is untouched.
// Offered only when the Scan-to-Pay preview says the QR is eligible.
export default function TripPayLater({ preview, pending, disabled, onConfirm }) {
  const [months, setMonths] = useState(0)
  const plans = preview?.bnplEligible ? (preview.bnplOptions ?? []) : []
  if (!plans.length) return null

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Or pay later</h3>
      <PlanOptions
        plans={plans}
        currency={preview.currency}
        months={months}
        disabled={disabled}
        onChange={setMonths}
      />
      <p className="muted">Billed by the bank, not from your trip pot</p>
      <div className="scantopay-actions">
        <button type="button" disabled={disabled || !months} onClick={() => onConfirm(months)}>
          {pending ? 'Setting up plan…' : 'Pay later'}
        </button>
      </div>
    </div>
  )
}

export function PayLaterDone({ result, tripId, onAgain }) {
  return (
    <div className="card" role="status">
      <h3 style={{ marginTop: 0 }}>
        {result.status === 'Duplicate' ? 'Plan already created' : 'Pay-later plan created'}
      </h3>
      <div className="scantopay-rows">
        <PaidLater result={result} />
      </div>
      {result.ledgerPending && (
        <p className="muted" style={{ margin: '6px 0 0' }}>
          The plan was created; the trip summary may take a moment to show it.
        </p>
      )}
      <div className="scantopay-actions" style={{ marginTop: 12 }}>
        <button type="button" onClick={onAgain}>
          Pay again
        </button>
        <Link to="/trips/$tripId" params={{ tripId: String(tripId) }} className="btn secondary">
          Back to the trip
        </Link>
      </div>
    </div>
  )
}
