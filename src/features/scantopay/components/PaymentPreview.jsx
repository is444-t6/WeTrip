import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import Banner from '../../../components/Banner'
import Money from '../../../components/Money'
import DetailRow from './DetailRow'

export default function PaymentPreview({
  preview,
  paying,
  error,
  mayHaveGoneThrough,
  onPayNow,
  onPayLater,
  onCancel,
}) {
  const [months, setMonths] = useState(0)
  const busy = Boolean(paying)
  const { currency } = preview
  const plans = preview.bnplEligible ? (preview.bnplOptions ?? []) : []

  return (
    <>
      <Banner>{error?.message}</Banner>
      {mayHaveGoneThrough && (
        <Banner kind="warn">
          This payment may still have gone through. Check <Link to="/pay/history">My Payments</Link>{' '}
          before trying again.
        </Banner>
      )}

      <div className="card">
        <div className="stack">
          <strong>{preview.merchantName}</strong>
          {preview.merchantCategory && <span className="muted">{preview.merchantCategory}</span>}
        </div>
        <div className="scantopay-rows">
          <DetailRow label="Amount">
            <Money amount={preview.amount} currency={currency} />
          </DetailRow>
          {preview.rateFound && (
            <DetailRow label="Approx.">
              ≈ <Money amount={preview.amountSGD} />
            </DetailRow>
          )}
          <DetailRow label="Wallet">{preview.walletAccountId}</DetailRow>
          <DetailRow label="Balance">
            <Money amount={preview.walletBalance} currency={currency} />
          </DetailRow>
        </div>

        {!preview.sufficientBalance && (
          <Banner kind="warn">Not enough in this wallet to pay in full.</Banner>
        )}

        <div className="scantopay-actions">
          <button type="button" disabled={busy || !preview.sufficientBalance} onClick={onPayNow}>
            {paying === 'now' ? 'Paying…' : 'Pay now'}
          </button>
        </div>
      </div>

      {plans.length > 0 && (
        <>
          <h2 className="section-title">Or split it</h2>
          <div className="card">
            <div className="scantopay-plans">
              {plans.map((plan) => (
                <label className="scantopay-plan" key={plan.numberOfMonths}>
                  <input
                    type="radio"
                    name="scantopay-plan"
                    disabled={busy}
                    checked={months === plan.numberOfMonths}
                    onChange={() => setMonths(plan.numberOfMonths)}
                  />
                  <span>
                    {plan.numberOfMonths} months ·{' '}
                    <Money amount={plan.monthlyInstallment} currency={currency} />
                    /month
                    <small>
                      Interest <Money amount={plan.totalInterest} currency={currency} /> · ends{' '}
                      {String(plan.maturityDate).slice(0, 10)}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <div className="scantopay-actions">
              <button type="button" disabled={busy || !months} onClick={() => onPayLater(months)}>
                {paying === 'later' ? 'Setting up plan…' : 'Pay later'}
              </button>
            </div>
          </div>
        </>
      )}

      {busy && (
        <p className="muted" role="status">
          Talking to the bank. This usually takes 2–5 seconds.
        </p>
      )}

      <div className="scantopay-actions">
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  )
}
