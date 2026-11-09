import { Link } from '@tanstack/react-router'
import { getCustomerId } from '../../scantopay/customer'
import { useHistory } from '../../scantopay/queries'
import Money from '../../family/components/Money'
import { latestPayments } from '../homeData'

const shortDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

// The last few Scan to Pay payments. Scan to Pay lives in another environment,
// so if it is unreachable this says so quietly and the rest of the page stays.
export default function RecentPayments() {
  const { data, error, isLoading } = useHistory(getCustomerId())
  const payments = latestPayments(data?.payments)

  return (
    <div className="card">
      <div className="card-header">
        <h3>Recent payments</h3>
        <Link to="/pay/history" className="muted">
          View all
        </Link>
      </div>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="muted">Recent payments are unavailable right now.</p>}
      {data && payments.length === 0 && (
        <p className="muted">
          No payments yet. <Link to="/pay">Scan to pay</Link>
        </p>
      )}
      {payments.map((p) => (
        <div key={p.id} className="row-between home-row">
          <div className="stack">
            <strong>{p.merchantName}</strong>
            <span className="muted">
              {shortDate(p.dateTime)}
              {p.paymentType === 'BNPL' && ' · Pay later'}
            </span>
          </div>
          <span className="money">
            <Money amount={p.amount} currency={p.currency} />
          </span>
        </div>
      ))}
    </div>
  )
}
