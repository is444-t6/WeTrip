import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { formatMoney, planLabel } from './data'
import { useInsurancePlans, usePurchaseInsurance } from './queries'
import { getDraft, savePurchaseResult } from './storage'
import InsuranceLayout from './components/InsuranceLayout'

export default function Checkout() {
  const draft = getDraft()
  const { data: plans = [], isLoading, error: plansError } = useInsurancePlans()
  const plan = plans.find(p => String(p.id) === String(draft.insurancePlanId))
  const purchase = usePurchaseInsurance()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  async function confirmPurchase() {
    setError('')
    try {
      const result = await purchase.mutateAsync({
        InsurancePlanId: Number(draft.insurancePlanId),
        CoverageStart: draft.trip.startDate,
        CoverageEnd: draft.trip.endDate,
        DestinationCode: draft.trip.destinationCode,
        Travellers: draft.travellers.map(t => ({
          FullName: t.name,
          DateOfBirth: t.dob,
          Email: draft.email,
          NationalityCode: t.nationalityCode,
        })),
      })
      savePurchaseResult(result)
      await navigate({ to: '/insurance/confirmation' })
    } catch (e) {
      setError(e.message || 'The insurance service could not complete this purchase. Please try again.')
    }
  }

  if (!draft.insurancePlanId || !draft.trip || !draft.travellers?.length) return <InsuranceLayout><div className="card">Your checkout details are missing. <Link to="/insurance">Start again</Link>.</div></InsuranceLayout>
  if (isLoading) return <InsuranceLayout><div className="card muted">Loading checkout…</div></InsuranceLayout>
  if (plansError) return <InsuranceLayout><div className="card"><div className="banner error">Could not load plans: {plansError.message}</div><Link to="/insurance">Start again</Link></div></InsuranceLayout>
  if (!plan) return <InsuranceLayout><div className="card">The selected plan is unavailable. <Link to="/insurance">Choose another plan</Link>.</div></InsuranceLayout>

  return <InsuranceLayout>
    <Link to="/insurance/travellers" search={{ planId: draft.planId }} className="muted">← Edit traveller details</Link>
    <h1 style={{ marginTop: 16 }}>Checkout summary</h1>
    <div className="card"><div className="card-header"><h2>Trip</h2><span className="badge pending">Insurance quote</span></div><div className="row-between"><span>Destination</span><strong>{draft.trip.destination} ({draft.trip.destinationCode})</strong></div><div className="row-between" style={{ marginTop: 8 }}><span>Travel dates</span><strong>{draft.trip.startDate} – {draft.trip.endDate}</strong></div></div>
    <div className="card"><h2 style={{ marginBottom: 14 }}>Selected plan</h2><div className="row-between"><strong>{planLabel(plan)} · {draft.coverType === 'family' ? 'Family' : 'Individual'}</strong><strong>{draft.travellers.length} traveller(s)</strong></div><p className="muted" style={{ marginTop: 10 }}>Travellers: {draft.travellers.map(t => t.name).join(', ')}</p><p className="muted">Contact: {draft.email}</p><hr style={{ border: 0, borderTop: '1px solid var(--card-border)', margin: '16px 0' }} /><div className="row-between"><span>Quoted premium ({draft.quote?.tripDays ?? '—'} days)</span><strong className="money">{formatMoney(draft.quote?.totalPremium, draft.quote?.currencyCode || plan.currencyCode)}</strong></div><p className="muted" style={{ marginTop: 12 }}>Confirming sends these trip and traveller details to the insurance service.</p></div>
    {error && <div className="banner error">{error}</div>}
    <button type="button" disabled={purchase.isPending} onClick={confirmPurchase} style={{ width: '100%' }}>{purchase.isPending ? 'Submitting…' : 'Confirm purchase'}</button>
  </InsuranceLayout>
}

