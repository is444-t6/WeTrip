import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import Banner from '../../components/Banner'
import Money from '../../components/Money'
import { CATEGORIES } from '../budget/constants'
import PayLayout from '../scantopay/components/PayLayout'
import QrScanner from '../scantopay/components/QrScanner'
import { newRequestId } from './api'
import { milesLabel, parseMerchantQr } from './trip'
import { usePayOnTrip, useTripOverview } from './queries'

// Paying on a trip: the child scans the merchant's QR and the Trip composite pays
// it from the trip at the locked rate (one SGD transfer), records the trip spend
// and the budget expense. User-triggered only, never retried; the request id made
// at scan time turns a second tap into a no-op on the server.
export default function TripPay({ tripId }) {
  const overview = useTripOverview(tripId)
  const pay = usePayOnTrip(tripId)
  const [qr, setQr] = useState(null)
  const [badQr, setBadQr] = useState(false)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id)
  const [pasted, setPasted] = useState('')
  const requestId = useRef(null)
  const paying = useRef(false)

  const trip = overview.data?.trip
  const left = Number(overview.data?.remainingForeign) || 0
  const amountValue = qr?.amount > 0 ? qr.amount : Number(amount) || 0

  function handleQr(text) {
    const parsed = parseMerchantQr(text)
    setBadQr(!parsed)
    if (!parsed) return
    pay.reset()
    requestId.current = newRequestId()
    setQr(parsed)
    setAmount('')
  }

  function submit() {
    if (paying.current || !qr) return
    paying.current = true
    pay.mutate(
      {
        TripId: Number(tripId),
        MerchantCode: qr.merchantCode,
        Amount: amountValue,
        CategoryId: Number(categoryId),
        RequestId: requestId.current,
        Narrative: '',
      },
      { onSettled: () => (paying.current = false) },
    )
  }

  function again() {
    pay.reset()
    setQr(null)
    setPasted('')
  }

  const title = trip ? `Pay on ${trip.destination}` : 'Pay on a trip'
  const back = (
    <Link to="/trips/$tripId" params={{ tripId: String(tripId) }} className="back-link">
      &larr; Back to the trip
    </Link>
  )

  if (overview.error) {
    return (
      <PayLayout title={title}>
        {back}
        <Banner>{overview.error.message}</Banner>
      </PayLayout>
    )
  }

  const result = pay.data
  if (result && result.status !== 'Declined') {
    return (
      <PayLayout title={title}>
        <div className="card" role="status">
          <h3 style={{ marginTop: 0 }}>
            {result.status === 'Duplicate' ? 'Already paid' : 'Paid'}
          </h3>
          <p style={{ margin: 0 }}>
            <Money amount={result.amount} currency={result.currency} /> charged as{' '}
            <Money amount={result.sgdCharged} /> at the trip's locked rate.
          </p>
          {result.status === 'Paid' && (
            <p className="muted" style={{ margin: '6px 0 0' }}>
              <Money amount={result.remainingForeign} currency={result.currency} /> left on this
              trip.
            </p>
          )}
          {Number(result.milesEarned) > 0 && (
            <p style={{ margin: '6px 0 0' }}>+{milesLabel(Number(result.milesEarned))}</p>
          )}
          {result.ledgerPending && (
            <p className="muted" style={{ margin: '6px 0 0' }}>
              The payment went through; the trip summary may take a moment to show it.
            </p>
          )}
          <div className="scantopay-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={again}>
              Pay again
            </button>
            <Link to="/trips/$tripId" params={{ tripId: String(tripId) }} className="btn secondary">
              Back to the trip
            </Link>
          </div>
        </div>
      </PayLayout>
    )
  }

  if (qr) {
    // A lost response may still have paid; never offer a blind retry.
    const lost =
      pay.error && (pay.error instanceof TypeError || [502, 503, 504].includes(pay.error.status))
    return (
      <PayLayout title={title}>
        {back}
        <Banner>{result?.status === 'Declined' ? result.message : pay.error?.message}</Banner>
        {lost && (
          <p className="muted" role="alert">
            We lost the bank's reply. Check the trip before paying again: this payment may have gone
            through.
          </p>
        )}
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <p style={{ marginTop: 0 }}>
            Merchant <strong>{qr.merchantCode}</strong>
            {trip && (
              <span className="muted" style={{ display: 'block' }}>
                <Money amount={left} currency={trip.currency} /> left on this trip
              </span>
            )}
          </p>
          {qr.amount > 0 ? (
            <p>
              Amount <Money amount={qr.amount} currency={qr.currency || trip?.currency} />
            </p>
          ) : (
            <div className="field">
              <label htmlFor="trip-pay-amount">Amount ({trip?.currency})</label>
              <input
                id="trip-pay-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="trip-pay-category">Budget category</label>
            <select
              id="trip-pay-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="scantopay-actions">
            <button type="submit" disabled={pay.isPending || lost || amountValue <= 0}>
              {pay.isPending ? 'Paying…' : 'Pay from trip'}
            </button>
            <button type="button" className="secondary" disabled={pay.isPending} onClick={again}>
              Cancel
            </button>
          </div>
        </form>
      </PayLayout>
    )
  }

  return (
    <PayLayout title={title}>
      {back}
      {badQr && <Banner>That QR is not a WeTrip merchant code.</Banner>}
      <div className="card">
        <QrScanner onScan={handleQr} />
        <p className="muted" style={{ margin: 0 }}>
          Point your camera at the merchant's WeTrip QR.
        </p>
      </div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          handleQr(pasted.trim())
        }}
      >
        <div className="field">
          <label htmlFor="trip-pay-paste">Or paste the QR text</label>
          <textarea
            id="trip-pay-paste"
            rows={3}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
        </div>
        <div className="scantopay-actions">
          <button type="submit" disabled={!pasted.trim()}>
            Continue
          </button>
        </div>
      </form>
    </PayLayout>
  )
}
