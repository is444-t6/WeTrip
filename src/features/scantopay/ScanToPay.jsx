import { useRef, useState } from 'react'
import Banner from '../../components/Banner'
import SignedOutCard from '../../components/SignedOutCard'
import PayLayout from './components/PayLayout'
import PaymentPreview from './components/PaymentPreview'
import PaymentResult from './components/PaymentResult'
import QrScanner from './components/QrScanner'
import { getCustomerId } from './customer'
import { usePayLater, usePayNow, usePreview } from './queries'

function parseQr(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null // not JSON: PreviewPayment will explain that to the user
  }
}

// API rejections are 4xx/500 with Errors[0]. A network failure (fetch throws a
// TypeError) or a gateway error means the response was lost, so the money may
// have moved anyway.
const responseWasLost = (error) =>
  error instanceof TypeError || [502, 503, 504].includes(error?.status)

// A real payment names a transaction, a payment record or a pay-later plan. A 2xx
// without any of them (the client turns a non-JSON body into {}) is not a receipt.
// Normalising turns BNPLPlanId into bNPLPlanId.
const isReceipt = (r) =>
  Boolean(r?.transactionId || r?.paymentRecordId || r?.bnplPlanId || r?.bNPLPlanId)

export default function ScanToPay() {
  const customerId = getCustomerId()
  const preview = usePreview()
  const payNow = usePayNow(customerId)
  const payLater = usePayLater(customerId)

  const [qrText, setQrText] = useState('')
  const [openCurrency, setOpenCurrency] = useState(null) // set for an open-amount QR
  const [amount, setAmount] = useState('')
  const [pasted, setPasted] = useState('')
  const paying = useRef(false) // blocks a double tap before the buttons disable

  const amountValue = Number(amount) || 0

  function handleQr(text) {
    const qr = parseQr(text)
    setQrText(text)
    if (qr?.amount === 0) {
      setOpenCurrency(qr.currency ?? '')
      return
    }
    preview.mutate({ customerId, qrText: text })
  }

  function pay(mutation, numberOfMonths) {
    if (paying.current) return
    paying.current = true
    payNow.reset()
    payLater.reset()
    mutation.mutate(
      { customerId, qrText, amount: amountValue, numberOfMonths },
      {
        onSettled: () => {
          paying.current = false
        },
      },
    )
  }

  function reset() {
    preview.reset()
    payNow.reset()
    payLater.reset()
    setQrText('')
    setOpenCurrency(null)
    setAmount('')
    setPasted('')
  }

  if (!customerId) return <SignedOutCard title="Scan to Pay" />

  const paid = payNow.data ?? payLater.data
  if (isReceipt(paid)) {
    return (
      <PayLayout title="Scan to Pay">
        <PaymentResult type={payNow.data ? 'now' : 'later'} result={paid} onDone={reset} />
      </PayLayout>
    )
  }

  if (preview.data) {
    const payError = payNow.error ?? payLater.error
    return (
      <PayLayout title="Scan to Pay">
        <PaymentPreview
          preview={preview.data}
          paying={payNow.isPending ? 'now' : payLater.isPending ? 'later' : null}
          error={payError}
          mayHaveGoneThrough={responseWasLost(payError) || Boolean(paid)}
          onPayNow={() => pay(payNow)}
          onPayLater={(months) => pay(payLater, months)}
          onCancel={reset}
        />
      </PayLayout>
    )
  }

  if (openCurrency !== null) {
    return (
      <PayLayout title="Scan to Pay">
        <Banner>{preview.error?.message}</Banner>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault()
            preview.mutate({ customerId, qrText, amount: amountValue })
          }}
        >
          <div className="field">
            <label htmlFor="scantopay-amount">Amount to pay {openCurrency}</label>
            <input
              id="scantopay-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="scantopay-actions">
            <button type="submit" disabled={preview.isPending || amountValue <= 0}>
              {preview.isPending ? 'Checking…' : 'Continue'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={preview.isPending}
              onClick={reset}
            >
              Cancel
            </button>
          </div>
        </form>
      </PayLayout>
    )
  }

  return (
    <PayLayout title="Scan to Pay">
      <Banner>{preview.error?.message}</Banner>
      {preview.isPending ? (
        <div className="card empty" role="status">
          Checking this QR…
        </div>
      ) : (
        <>
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
              <label htmlFor="scantopay-paste">Or paste the QR text</label>
              <textarea
                id="scantopay-paste"
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
        </>
      )}
    </PayLayout>
  )
}
