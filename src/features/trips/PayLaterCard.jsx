import Money from '../../components/Money'
import { day } from './trip'

// The trip's instalment plans (GetTripOverview.BnplPlans). Billed by the bank, so
// they are listed here but are not part of the trip pot.
export default function PayLaterCard({ plans, currency }) {
  if (!plans?.length) return null
  return (
    <div className="card" aria-label="Pay later">
      <div className="card-header">
        <h3>Pay later</h3>
      </div>
      <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
        {plans.map((p, i) => (
          <li key={p.bnplPlanId ?? i}>
            {p.merchantName} · {p.numberOfMonths} ×{' '}
            <Money amount={p.monthlyInstallment} currency={p.currency || currency} /> · first{' '}
            {day(p.firstRepaymentDate)} · ends {day(p.maturityDate)}
          </li>
        ))}
      </ul>
    </div>
  )
}
