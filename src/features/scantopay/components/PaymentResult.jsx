import { Link } from '@tanstack/react-router'
import Banner from '../../../components/Banner'
import Money from '../../../components/Money'
import DetailRow from './DetailRow'
import { day } from '../../../lib/format'

function PaidNow({ result }) {
  return (
    <>
      <DetailRow label="Amount">
        <Money amount={result.amount} currency={result.currency} />
      </DetailRow>
      {result.currency !== 'SGD' && result.amountSGD != null && (
        <DetailRow label="Approx.">
          ≈ <Money amount={result.amountSGD} />
        </DetailRow>
      )}
      <DetailRow label="Transaction">{result.transactionId}</DetailRow>
      <DetailRow label="New balance">
        <Money amount={result.balanceAfter} currency={result.currency} />
      </DetailRow>
    </>
  )
}

export function PaidLater({ result }) {
  return (
    <>
      <DetailRow label="Amount">
        <Money amount={result.principal} currency={result.currency} />
      </DetailRow>
      <DetailRow label="Monthly">
        {result.numberOfMonths} ×{' '}
        <Money amount={result.monthlyInstallment} currency={result.currency} />
      </DetailRow>
      <DetailRow label="Total interest">
        <Money amount={result.totalInterest} currency={result.currency} />
      </DetailRow>
      <DetailRow label="First repayment">{day(result.firstRepaymentDate)}</DetailRow>
      <DetailRow label="Ends">{day(result.maturityDate)}</DetailRow>
    </>
  )
}

export default function PaymentResult({ type, result, onDone }) {
  const later = type === 'later'

  return (
    <div className="card">
      <Banner kind="ok">{later ? 'Pay-later plan created' : 'Payment successful'}</Banner>
      <strong>{result.merchantName}</strong>
      <div className="scantopay-rows">
        {later ? <PaidLater result={result} /> : <PaidNow result={result} />}
      </div>
      <div className="scantopay-actions">
        <button type="button" onClick={onDone}>
          Scan another
        </button>
        <Link to="/pay/history" className="btn secondary">
          View my payments
        </Link>
      </div>
    </div>
  )
}
