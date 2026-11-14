import { Link } from '@tanstack/react-router'
import Banner from '../../components/Banner'
import Money from '../../components/Money'
import SignedOutCard from '../../components/SignedOutCard'
import DetailRow from './components/DetailRow'
import PayLayout from './components/PayLayout'
import { getCustomerId } from './customer'
import { useHistory } from './queries'
import { day } from '../../lib/format'
import { latestPayments } from '../home/homeData'

const when = (value) => {
  const d = new Date(value)
  return value && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'
}
const PLAN_STATUS = { ACTIVE: 'Active', COMPLETED: 'Paid off', CLOSED: 'Closed' }

function PaymentCard({ payment }) {
  const later = payment.paymentType === 'BNPL'

  return (
    <div className="card">
      <div className="row-between">
        <div className="stack">
          <strong>{payment.merchantName}</strong>
          <span className="muted">{when(payment.dateTime)}</span>
        </div>
        <span className={`badge ${later ? 'pending' : 'active'}`}>
          {later ? 'Pay later' : 'Pay now'}
        </span>
      </div>
      <div className="scantopay-rows">
        <DetailRow label="Amount">
          <Money amount={payment.amount} currency={payment.currency} />
        </DetailRow>
        {payment.currency !== 'SGD' && payment.amountSGD != null && (
          <DetailRow label="Approx.">
            ≈ <Money amount={payment.amountSGD} />
          </DetailRow>
        )}
        <DetailRow label="Transaction">{payment.transactionId}</DetailRow>
      </div>
    </div>
  )
}

function PlanCard({ plan }) {
  return (
    <div className="card">
      <div className="row-between">
        <div className="stack">
          <strong>{plan.merchantName}</strong>
          <span className="muted">Started {when(plan.createdOn)}</span>
        </div>
        <span className={`badge ${plan.status === 'ACTIVE' ? 'active' : 'pending'}`}>
          {PLAN_STATUS[plan.status] ?? plan.status}
        </span>
      </div>
      <div className="scantopay-rows">
        <DetailRow label="Amount">
          <Money amount={plan.principal} currency={plan.currency} />
        </DetailRow>
        <DetailRow label="Monthly">
          {plan.numberOfMonths} ×{' '}
          <Money amount={plan.monthlyInstallment} currency={plan.currency} />
        </DetailRow>
        <DetailRow label="Total interest">
          <Money amount={plan.totalInterest} currency={plan.currency} />
        </DetailRow>
        <DetailRow label="Ends">{day(plan.maturityDate)}</DetailRow>
      </div>
    </div>
  )
}

export default function MyPayments() {
  const customerId = getCustomerId()
  const { data, error, isLoading } = useHistory(customerId)
  const payments = latestPayments(data?.payments, Infinity)
  const plans = data?.bnplPlans ?? []

  if (!customerId) return <SignedOutCard title="My payments" />

  return (
    <PayLayout title="My payments">
      <Banner>{error?.message}</Banner>
      {isLoading && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}

      {data && (
        <>
          <h2 className="section-title">Pay-later plans</h2>
          {plans.length === 0 && <div className="card empty">No pay-later plans yet.</div>}
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}

          <h2 className="section-title">Payments</h2>
          {payments.length === 0 && (
            <div className="card empty">
              No payments yet. <Link to="/pay">Scan to pay</Link>
            </div>
          )}
          {payments.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} />
          ))}
        </>
      )}
    </PayLayout>
  )
}
