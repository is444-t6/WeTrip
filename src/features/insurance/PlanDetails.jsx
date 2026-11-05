import { Link, useParams } from '@tanstack/react-router'
import { formatMoney, planLabel } from './data'
import { useInsurancePlanBenefits, useInsurancePlans } from './queries'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

const BENEFIT_NAME_FIELDS = ['name', 'benefitName', 'title', 'coverageBenefit', 'benefit', 'category']
const BENEFIT_DESCRIPTION_FIELDS = ['description', 'benefitDescription', 'details']
const BENEFIT_VALUE_FIELDS = ['coverageLimit', 'benefitLimit', 'coverageAmount', 'benefitAmount', 'maximumCoverage', 'limit', 'value']
const BENEFIT_STATUS_FIELDS = ['isCovered', 'covered', 'included', 'status']
const BENEFIT_METADATA_FIELDS = ['id', 'benefitId', 'insurancePlanId', 'displayOrder']

function travellerCount(maxTravellers) {
  const count = Number(maxTravellers)
  if (!Number.isFinite(count) || count < 1) return 'Not specified'
  return `${count} ${count === 1 ? 'person' : 'people'}`
}

function benefitLabel(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase())
}

function formatBenefitValue(value) {
  const formatAmount = amount => `S$${new Intl.NumberFormat('en-SG', { maximumFractionDigits: 0 }).format(amount)}`
  if (typeof value === 'number' && Number.isFinite(value)) return formatAmount(value)
  if (typeof value !== 'string') return String(value)

  return value.replace(/S?\$?\s*(\d[\d,]*(?:\.\d+)?)/g, (match, amount) => {
    const numericAmount = Number(amount.replaceAll(',', ''))
    return Number.isFinite(numericAmount) ? formatAmount(numericAmount) : match
  })
}

function sortBenefits(benefits) {
  return benefits
    .map((benefit, index) => {
      const rawOrder = benefit?.displayOrder
      const order = rawOrder === null || rawOrder === undefined || rawOrder === '' ? Number.NaN : Number(rawOrder)
      return { benefit, index, order }
    })
    .sort((a, b) => {
      const aHasOrder = Number.isFinite(a.order)
      const bHasOrder = Number.isFinite(b.order)
      if (aHasOrder && bHasOrder) return a.order - b.order || a.index - b.index
      if (aHasOrder) return -1
      if (bHasOrder) return 1
      return a.index - b.index
    })
    .map(({ benefit }) => benefit)
}

function benefitDetails(benefit) {
  if (typeof benefit === 'string') return { title: benefit, description: '', details: [] }
  if (!benefit || typeof benefit !== 'object' || Array.isArray(benefit)) {
    throw new Error('The insurance benefits endpoint returned an invalid benefit.')
  }

  const nameField = BENEFIT_NAME_FIELDS.find(field => benefit[field] != null && benefit[field] !== '')
  const descriptionField = BENEFIT_DESCRIPTION_FIELDS.find(field => benefit[field] != null && benefit[field] !== '')
  const valueField = BENEFIT_VALUE_FIELDS.find(field => benefit[field] != null && benefit[field] !== '')
  const statusField = BENEFIT_STATUS_FIELDS.find(field => benefit[field] != null && benefit[field] !== '')
  const excludedFields = new Set([
    ...BENEFIT_NAME_FIELDS,
    ...BENEFIT_DESCRIPTION_FIELDS,
    ...BENEFIT_VALUE_FIELDS,
    ...BENEFIT_STATUS_FIELDS,
    ...BENEFIT_METADATA_FIELDS,
  ])
  const details = Object.entries(benefit)
    .filter(([key, value]) => !excludedFields.has(key) && value != null && typeof value !== 'object')
    .map(([key, value]) => ({ label: benefitLabel(key), value: String(value) }))

  if (valueField) details.unshift({ label: 'Benefit limit', value: formatBenefitValue(benefit[valueField]) })
  if (statusField) {
    const status = benefit[statusField]
    details.unshift({
      label: 'Status',
      value: typeof status === 'boolean' ? status ? 'Included' : 'Not included' : String(status),
    })
  }

  return {
    title: nameField ? String(benefit[nameField]) : 'Plan benefit',
    description: descriptionField ? String(benefit[descriptionField]) : '',
    details,
  }
}

export default function PlanDetails() {
  const { planId } = useParams({ from: '/insurance/plan/$planId' })
  const { data: plans = [], isLoading, error } = useInsurancePlans()
  const benefits = useInsurancePlanBenefits(planId)
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
              <dt>Maximum coverage</dt>
              <dd>{formatMoney(plan.maxCoverageAmount, plan.currencyCode)}</dd>
            </div>
          </dl>
        </section>

        <section className="insurance-plan-benefits" aria-labelledby="insurance-plan-benefits-title">
          <div className="insurance-plan-detail-section-heading">
            <div>
              <span className="insurance-plan-detail-eyebrow">What’s included</span>
              <h2 id="insurance-plan-benefits-title">Plan benefits</h2>
            </div>
          </div>
          {benefits.isLoading && <p className="muted" role="status">Loading plan benefits…</p>}
          {benefits.error && <p className="banner error" role="alert">Could not load plan benefits: {benefits.error.message}</p>}
          {benefits.isSuccess && benefits.data.length === 0 && <p className="muted">No benefits were returned for this plan.</p>}
          {benefits.isSuccess && benefits.data.length > 0 && <ul className="insurance-plan-benefit-list">
            {sortBenefits(benefits.data).map((benefit, index) => {
              const details = benefitDetails(benefit)
              return <li className="insurance-plan-benefit" key={benefit.id ?? benefit.benefitId ?? `${details.title}-${index}`}>
                <span className="insurance-plan-benefit-mark" aria-hidden="true">✓</span>
                <div className="insurance-plan-benefit-content">
                  <h3>{details.title}</h3>
                  {details.description && <p>{details.description}</p>}
                  {details.details.length > 0 && <dl className="insurance-plan-benefit-details">
                    {details.details.map(detail => <div className={detail.label === 'Benefit limit' ? 'insurance-plan-benefit-limit' : undefined} key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}
                  </dl>}
                </div>
              </li>
            })}
          </ul>}
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
