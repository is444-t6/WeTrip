import { Link } from '@tanstack/react-router'
import Banner from '../../components/Banner'
import Money from '../../components/Money'
import DetailRow from './components/DetailRow'
import PayLayout from './components/PayLayout'
import { getCustomerId } from './customer'
import { useHistory } from './queries'

const when = (value) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

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
        <DetailRow label="Approx.">
          ≈ <Money amount={payment.amountSGD} />
        </DetailRow>
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
          {plan.status}
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
        <DetailRow label="Ends">{String(plan.maturityDate).slice(0, 10)}</DetailRow>
      </div>
    </div>
  )
}

export default function MyPayments() {
  const { data, error, isLoading } = useHistory(getCustomerId())
  const payments = data?.payments ?? []
  const plans = data?.bnplPlans ?? []

  return (
    <PayLayout title="My Payments">
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
