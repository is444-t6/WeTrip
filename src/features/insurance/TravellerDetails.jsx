import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useChildren } from '../family/queries'
import {
  getBirthDateMinInputValue,
  getTodayDateInputValue,
  getYesterdayDateInputValue,
  isReasonableBirthDate,
  isValidTripDates,
  planLabel,
} from './data'
import { useInsurancePlans, useInsuranceQuote } from './queries'
import { getTrip, saveDraft, clearPurchaseResult } from './storage'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function TravellerDetails() {
  const { planId } = useSearch({ from: '/insurance/travellers' })
  const navigate = useNavigate()
  const { data: plans = [], isLoading, error: plansError } = useInsurancePlans()
  const plan = plans.find((p) => String(p.id) === String(planId))
  const quote = useInsuranceQuote()
  const {
    data: linkedChildren = [],
    isLoading: childrenLoading,
    error: childrenError,
  } = useChildren()
  const [coverType, setCoverType] = useState('individual')
  const [selectChildren, setSelectChildren] = useState(false)
  const [travellers, setTravellers] = useState([{ name: '', dob: '', nationalityCode: '' }])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  if (isLoading)
    return (
      <InsuranceLayout>
        <div className="card muted">Loading plan…</div>
      </InsuranceLayout>
    )
  if (plansError)
    return (
      <InsuranceLayout>
        <div className="card">
          <div className="banner error" role="alert">
            Could not load plans: {plansError.message}
          </div>
          <Link to="/insurance/plans">Browse plans</Link>
        </div>
      </InsuranceLayout>
    )
  if (!plan)
    return (
      <InsuranceLayout>
        <div className="card">
          Choose a plan first. <Link to="/insurance/plans">Browse plans</Link>
        </div>
      </InsuranceLayout>
    )

  const trip = getTrip()
  const today = getTodayDateInputValue()
  const yesterday = getYesterdayDateInputValue()
  const earliestBirthDate = getBirthDateMinInputValue()
  const maxTravellers = Number(plan.maxTravellers) || 1
  const activeChildren = linkedChildren.filter((child) => child.status === 'Active')

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (
      !trip.destination ||
      !/^[A-Za-z]{2}$/.test(trip.destinationCode || '') ||
      !isValidTripDates(trip.startDate, trip.endDate, today)
    ) {
      setError(
        'Please enter a destination, country code, and travel dates starting today or later, with the return date on or after departure.',
      )
      return
    }
    if (travellers.length > maxTravellers) {
      setError(`This plan allows up to ${maxTravellers} traveller(s).`)
      return
    }
    if (coverType === 'family' && travellers.length === 0) {
      setError('Select at least one linked child for the family bundle.')
      return
    }
    if (
      travellers.some(
        (t) =>
          !t.name.trim() ||
          !isReasonableBirthDate(t.dob, today) ||
          !/^[A-Za-z]{2}$/.test(t.nationalityCode),
      )
    ) {
      setError(
        'Enter each traveller’s name, a date of birth before today and within the past 120 years, and a 2-letter nationality code.',
      )
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid contact email.')
      return
    }

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
        travellers: travellers.map((t) => ({
          ...t,
          name: t.name.trim(),
          nationalityCode: t.nationalityCode.toUpperCase(),
        })),
        email: email.trim(),
        trip: { ...trip, destinationCode: trip.destinationCode.toUpperCase() },
        quote: quoteResult,
      }
      saveDraft(draft)
      clearPurchaseResult()
      await navigate({ to: '/insurance/checkout' })
    } catch (e) {
      setError(e.message || 'Could not calculate a quote. Please try again.')
    }
  }

  function toggleFamilyChildren(enabled) {
    setSelectChildren(enabled)
    if (!enabled) setTravellers([])
    setError('')
  }

  function toggleChild(child, checked) {
    if (checked && travellers.length >= maxTravellers) {
      setError(`This plan allows up to ${maxTravellers} traveller(s).`)
      return
    }

    setError('')
    setTravellers((current) =>
      checked
        ? [
            ...current,
            {
              familyLinkId: child.familyLinkId,
              name: child.nickname || '',
              dob: '',
              nationalityCode: '',
            },
          ]
        : current.filter(
            (traveller) => String(traveller.familyLinkId) !== String(child.familyLinkId),
          ),
    )
  }

  function updateTraveller(index, field, value) {
    setTravellers((current) =>
      current.map((traveller, travellerIndex) =>
        travellerIndex === index ? { ...traveller, [field]: value } : traveller,
      ),
    )
  }

  return (
    <InsuranceLayout>
      <Link to="/insurance/plans" className="muted">
        ← Back to plans
      </Link>
      <h1 style={{ marginTop: 16 }}>Traveller details</h1>
      <p className="muted">{planLabel(plan)}</p>
      <Notice />
      <form onSubmit={submit} className="card">
        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="cover">Who are you covering?</label>
          <select
            id="cover"
            value={coverType}
            onChange={(e) => {
              const next = e.target.value
              setCoverType(next)
              setSelectChildren(false)
              setTravellers(next === 'family' ? [] : [{ name: '', dob: '', nationalityCode: '' }])
              setError('')
            }}
          >
            <option value="individual">Individual</option>
            {maxTravellers > 1 && <option value="family">Family</option>}
          </select>
        </div>
        {coverType === 'family' && (
          <div className="field">
            <label className="row" style={{ alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={selectChildren}
                onChange={(e) => toggleFamilyChildren(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Select my linked children
            </label>
            <small className="muted">
              Choose one or more active children to include in this family bundle (up to{' '}
              {maxTravellers} travellers).
            </small>
            {selectChildren && (
              <div className="insurance-child-picker" aria-label="Linked children">
                {childrenLoading && <p className="muted">Loading your linked children…</p>}
                {childrenError && (
                  <p className="banner error">
                    Could not load your linked children: {childrenError.message}
                  </p>
                )}
                {!childrenLoading && !childrenError && activeChildren.length === 0 && (
                  <p className="muted">
                    No active linked children found. Link a child in WeTrip Family first.
                  </p>
                )}
                {activeChildren.map((child) => {
                  const checked = travellers.some(
                    (traveller) => String(traveller.familyLinkId) === String(child.familyLinkId),
                  )
                  return (
                    <label className="insurance-child-option" key={child.familyLinkId}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && travellers.length >= maxTravellers}
                        onChange={(e) => toggleChild(child, e.target.checked)}
                      />
                      <span>
                        <strong>{child.nickname || child.childCustomerId}</strong>
                        <small className="muted">{child.childCustomerId}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {travellers.map((t, i) => (
          <div
            key={t.familyLinkId ?? i}
            style={{ borderTop: i ? '1px solid var(--card-border)' : 0, paddingTop: i ? 14 : 0 }}
          >
            <h3 style={{ marginBottom: 12 }}>
              {t.familyLinkId ? `Child traveller ${i + 1}` : `Traveller ${i + 1}`}
            </h3>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={`name-${i}`}>Full name</label>
                <input
                  id={`name-${i}`}
                  autoComplete="name"
                  value={t.name}
                  onChange={(e) => updateTraveller(i, 'name', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`dob-${i}`}>Date of birth</label>
                <input
                  id={`dob-${i}`}
                  type="date"
                  min={earliestBirthDate}
                  max={yesterday}
                  value={t.dob}
                  onChange={(e) => updateTraveller(i, 'dob', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`nationality-${i}`}>Nationality code</label>
                <input
                  id={`nationality-${i}`}
                  value={t.nationalityCode}
                  onChange={(e) =>
                    updateTraveller(i, 'nationalityCode', e.target.value.toUpperCase())
                  }
                  placeholder="SG"
                  maxLength={2}
                  required
                />
              </div>
            </div>
          </div>
        ))}
        <div className="field">
          <label htmlFor="email">Contact email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <p className="muted">
          We’ll request an exact quote from the insurance service before checkout.
        </p>
        <button type="submit" disabled={quote.isPending} style={{ width: '100%' }}>
          {quote.isPending ? 'Calculating quote…' : 'Get quote and review'}
        </button>
      </form>
    </InsuranceLayout>
  )
}
