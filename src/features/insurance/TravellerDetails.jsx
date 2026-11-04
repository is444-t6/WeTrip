import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { formatMoney, planLabel } from './data'
import { useInsurancePlans, useInsuranceQuote } from './queries'
import { getTrip, saveDraft, clearPurchaseResult } from './storage'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function TravellerDetails() {
  const { planId } = useSearch({ from: '/insurance/travellers' })
  const { data: plans = [], isLoading, error: plansError } = useInsurancePlans()
  const plan = plans.find(p => String(p.id) === String(planId))
  const quote = useInsuranceQuote()
  const [coverType, setCoverType] = useState('individual')
  const [travellers, setTravellers] = useState([{ name: '', dob: '', nationalityCode: '' }])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  if (isLoading) return <InsuranceLayout><div className="card muted">Loading plan…</div></InsuranceLayout>
  if (plansError) return <InsuranceLayout><div className="card"><div className="banner error">Could not load plans: {plansError.message}</div><Link to="/insurance/plans">Browse plans</Link></div></InsuranceLayout>
  if (!plan) return <InsuranceLayout><div className="card">Choose a plan first. <Link to="/insurance/plans">Browse plans</Link></div></InsuranceLayout>

  const trip = getTrip()
  const maxTravellers = Number(plan.maxTravellers) || 1

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!trip.destination || !/^[A-Za-z]{2}$/.test(trip.destinationCode || '') || !trip.startDate || !trip.endDate) {
      setError('Please enter a destination, country code, and travel dates first.')
      return
    }
    if (new Date(trip.endDate) < new Date(trip.startDate)) { setError('Return date must be on or after departure.'); return }
    if (travellers.length > maxTravellers) { setError(`This plan allows up to ${maxTravellers} traveller(s).`); return }
    if (travellers.some(t => !t.name.trim() || !t.dob || new Date(t.dob) > new Date() || !/^[A-Za-z]{2}$/.test(t.nationalityCode))) {
      setError('Enter each traveller’s name, valid date of birth, and 2-letter nationality code.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid contact email.'); return }

    try {
      const quoteResult = await quote.mutateAsync({
        InsurancePlanId: Number(plan.id),
        CoverageStart: trip.startDate,
        CoverageEnd: trip.endDate,
        TravellerCount: travellers.length,
      })
      const draft = {
        planId: String(plan.id),
        insurancePlanId: Number(plan.id),
        planName: planLabel(plan),
        coverType,
        travellers: travellers.map(t => ({ ...t, name: t.name.trim(), nationalityCode: t.nationalityCode.toUpperCase() })),
        email: email.trim(),
        trip: { ...trip, destinationCode: trip.destinationCode.toUpperCase() },
        quote: quoteResult,
      }
      saveDraft(draft)
      clearPurchaseResult()
      window.location.href = '/insurance/checkout'
    } catch (e) {
      setError(e.message || 'Could not calculate a quote. Please try again.')
    }
  }

  function changeCount(count) {
    setTravellers(current => Array.from({ length: count }, (_, i) => current[i] || { name: '', dob: '', nationalityCode: '' }))
  }

  return <InsuranceLayout>
    <Link to="/insurance/plans" className="muted">← Back to plans</Link><h1 style={{ marginTop: 16 }}>Traveller details</h1><p className="muted">{planLabel(plan)} · {formatMoney(plan.premiumPerDay, plan.currencyCode)} per day</p><Notice />
    <form onSubmit={submit} className="card">
      {error && <div className="banner error">{error}</div>}
      <div className="field"><label htmlFor="cover">Who are you covering?</label><select id="cover" value={coverType} onChange={e => { const next = e.target.value; setCoverType(next); changeCount(next === 'family' ? Math.min(2, maxTravellers) : 1) }}><option value="individual">Individual</option>{maxTravellers > 1 && <option value="family">Family</option>}</select></div>
      {coverType === 'family' && <div className="field"><label htmlFor="count">Number of travellers</label><select id="count" value={travellers.length} onChange={e => changeCount(Number(e.target.value))}>{Array.from({ length: Math.min(6, maxTravellers) - 1 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n} travellers</option>)}</select></div>}
      {travellers.map((t, i) => <div key={i} style={{ borderTop: i ? '1px solid var(--card-border)' : 0, paddingTop: i ? 14 : 0 }}><h3 style={{ marginBottom: 12 }}>Traveller {i + 1}</h3><div className="grid-2">
        <div className="field"><label htmlFor={`name-${i}`}>Full name</label><input id={`name-${i}`} autoComplete="name" value={t.name} onChange={e => setTravellers(a => a.map((x,j) => i === j ? { ...x, name: e.target.value } : x))} required /></div>
        <div className="field"><label htmlFor={`dob-${i}`}>Date of birth</label><input id={`dob-${i}`} type="date" max={new Date().toISOString().slice(0,10)} value={t.dob} onChange={e => setTravellers(a => a.map((x,j) => i === j ? { ...x, dob: e.target.value } : x))} required /></div>
        <div className="field"><label htmlFor={`nationality-${i}`}>Nationality code</label><input id={`nationality-${i}`} value={t.nationalityCode} onChange={e => setTravellers(a => a.map((x,j) => i === j ? { ...x, nationalityCode: e.target.value.toUpperCase() } : x))} placeholder="SG" maxLength={2} required /></div>
      </div></div>)}
      <div className="field"><label htmlFor="email">Contact email</label><input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
      <p className="muted">We’ll request an exact quote from the insurance service before checkout.</p>
      <button type="submit" disabled={quote.isPending} style={{ width: '100%' }}>{quote.isPending ? 'Calculating quote…' : 'Get quote and review'}</button>
    </form>
  </InsuranceLayout>
}
