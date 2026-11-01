import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { plans, formatSgd } from './data'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function TravellerDetails() {
  const { planId } = useSearch({ from: '/insurance/travellers' })
  const plan = plans.find(p => p.id === planId)
  const [coverType, setCoverType] = useState('individual')
  const [travellers, setTravellers] = useState([{ name: '', dob: '' }])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  if (!plan) return <InsuranceLayout><div className="card">Choose a plan first. <Link to="/insurance">Browse plans</Link></div></InsuranceLayout>
  const trip = readTrip()
  const total = plan.premium * travellers.length

  function submit(e) {
    e.preventDefault()
    if (!trip.destination || !trip.startDate || !trip.endDate) { setError('Please add destination and travel dates first.'); return }
    if (new Date(trip.endDate) < new Date(trip.startDate)) { setError('Return date must be on or after departure.'); return }
    if (travellers.some(t => !t.name.trim() || !t.dob || new Date(t.dob) > new Date())) { setError('Enter each traveller’s name and a valid date of birth.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid contact email.'); return }
    sessionStorage.setItem('wetrip.insurance.draft', JSON.stringify({ planId, coverType, travellers, email, trip, total }))
    sessionStorage.removeItem('wetrip.insurance.confirmedDraft')
    sessionStorage.removeItem('wetrip.insurance.lastConfirmation')
    window.location.href = '/insurance/checkout'
  }
  function changeCount(count) { setTravellers(current => Array.from({ length: count }, (_, i) => current[i] || { name: '', dob: '' })) }
  return <InsuranceLayout>
    <Link to="/insurance" className="muted">← Back to plans</Link><h1 style={{ marginTop: 16 }}>Traveller details</h1><p className="muted">{plan.name} · {formatSgd(plan.premium)} per traveller</p><Notice />
    <form onSubmit={submit} className="card">
      {error && <div className="banner error">{error}</div>}
      <div className="field"><label htmlFor="cover">Who are you covering?</label><select id="cover" value={coverType} onChange={e => { setCoverType(e.target.value); changeCount(e.target.value === 'family' ? Math.max(2, travellers.length) : 1) }}><option value="individual">Individual</option><option value="family">Family</option></select></div>
      {coverType === 'family' && <div className="field"><label htmlFor="count">Number of travellers</label><select id="count" value={travellers.length} onChange={e => changeCount(Number(e.target.value))}>{[2,3,4,5,6].map(n => <option key={n} value={n}>{n} travellers</option>)}</select></div>}
      {travellers.map((t, i) => <div key={i} style={{ borderTop: i ? '1px solid var(--card-border)' : 0, paddingTop: i ? 14 : 0 }}><h3 style={{ marginBottom: 12 }}>Traveller {i + 1}</h3><div className="grid-2"><div className="field"><label htmlFor={`name-${i}`}>Full name</label><input id={`name-${i}`} autoComplete="name" value={t.name} onChange={e => setTravellers(a => a.map((x,j) => i === j ? { ...x, name: e.target.value } : x))} required /></div><div className="field"><label htmlFor={`dob-${i}`}>Date of birth</label><input id={`dob-${i}`} type="date" max={new Date().toISOString().slice(0,10)} value={t.dob} onChange={e => setTravellers(a => a.map((x,j) => i === j ? { ...x, dob: e.target.value } : x))} required /></div></div></div>)}
      <div className="field"><label htmlFor="email">Contact email</label><input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
      <div className="row-between" style={{ marginBottom: 16 }}><span>Estimated total premium</span><strong className="money">{formatSgd(total)}</strong></div><button type="submit" style={{ width: '100%' }}>Review checkout</button>
    </form>
  </InsuranceLayout>
}

function readTrip() { try { return JSON.parse(sessionStorage.getItem('wetrip.insurance.trip') || '{}') } catch { return {} } }
