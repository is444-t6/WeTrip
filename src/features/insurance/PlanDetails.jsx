import { Link, useParams } from '@tanstack/react-router'
import { formatMoney, planLabel } from './data'
import { useInsurancePlans } from './queries'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

function travellerCount(maxTravellers) {
  const count = Number(maxTravellers)
  if (!Number.isFinite(count) || count < 1) return 'Not specified'
  return `${count} ${count === 1 ? 'person' : 'people'}`
}

export default function PlanDetails() {
  const { planId } = useParams({ from: '/insurance/plan/$planId' })
  const { data: plans = [], isLoading, error } = useInsurancePlans()
  const plan = plans.find(p => String(p.id) === String(planId))

  if (isLoading) return <InsuranceLayout><div className="card muted">Loading plan…</div></InsuranceLayout>
  if (error) return <InsuranceLayout><div className="card"><div className="banner error">Could not load plans: {error.message}</div><Link to="/insurance/plans">Back to plans</Link></div></InsuranceLayout>
  if (!plan) return <InsuranceLayout><div className="card">Plan not found. <Link to="/insurance/plans">Back to plans</Link></div></InsuranceLayout>

  return <InsuranceLayout>
    <Link to="/insurance/plans" className="muted">← Back to plans</Link>
    <div className="insurance-plan-detail-content">
      <Notice />
      <article className="card insurance-plan-detail-card">
        <section className="insurance-plan-detail-hero" aria-labelledby="insurance-plan-detail-title">
          <div className="insurance-plan-detail-intro">
            <span className="insurance-plan-detail-eyebrow">Travel insurance plan</span>
            <span className={`badge ${plan.isActive ? 'active' : 'removed'}`}>{plan.isActive ? 'Available' : 'Unavailable'}</span>
            <h1 id="insurance-plan-detail-title">{planLabel(plan)}</h1>
            <p>{plan.description || 'Review the plan limits and details before continuing.'}</p>
          </div>
          <div className="insurance-plan-detail-limit">
            <span>Maximum coverage</span>
            <strong>{formatMoney(plan.maxCoverageAmount, plan.currencyCode)}</strong>
          </div>
        </section>

        <section className="insurance-plan-detail-info" aria-labelledby="insurance-plan-info-title">
          <div className="insurance-plan-detail-section-heading">
            <div>
              <span className="insurance-plan-detail-eyebrow">The essentials</span>
              <h2 id="insurance-plan-info-title">Plan information</h2>
            </div>
          </div>
          <dl className="insurance-plan-detail-facts">
            <div>
              <dt>Cover type</dt>
              <dd>{plan.coverageType || 'Travel cover'}</dd>
            </div>
            <div>
              <dt>Maximum travellers</dt>
              <dd>{travellerCount(plan.maxTravellers)}</dd>
            </div>
            <div>
              <dt>Plan status</dt>
              <dd><span className={`insurance-plan-detail-status ${plan.isActive ? 'is-active' : 'is-unavailable'}`}>{plan.isActive ? 'Available to choose' : 'Currently unavailable'}</span></dd>
            </div>
          </dl>
        </section>

        <section className="insurance-plan-next-steps" aria-labelledby="insurance-next-steps-title">
          <div className="insurance-plan-detail-section-heading">
            <div>
              <span className="insurance-plan-detail-eyebrow">Simple next steps</span>
              <h2 id="insurance-next-steps-title">Continue with your plan</h2>
            </div>
          </div>
          <ol className="insurance-plan-steps">
            <li><span>1</span><div><strong>Add traveller details</strong><p>Enter the details of everyone covered by this plan.</p></div></li>
            <li><span>2</span><div><strong>Review your quote</strong><p>Check the final premium before confirming your purchase.</p></div></li>
          </ol>
        </section>

        <div className="insurance-plan-detail-action">
          {plan.isActive
            ? <Link to="/insurance/travellers" search={{ planId: String(plan.id) }}><button>Choose this plan</button></Link>
            : <p className="banner">This plan is currently unavailable.</p>}
          <p>Your final premium will be shown before you confirm your purchase.</p>
        </div>
      </article>
    </div>
  </InsuranceLayout>
}
