import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { getTodayDateInputValue, isValidTripDates } from './data'
import { getTrip, saveTrip } from './storage'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function InsuranceHome() {
  const search = useSearch({ from: '/insurance/' })
  const savedTrip = getTrip()
  const [destination, setDestination] = useState(search.destination || savedTrip.destination || '')
  const [destinationCode, setDestinationCode] = useState(
    search.destinationCode || savedTrip.destinationCode || '',
  )
  const [startDate, setStartDate] = useState(search.startDate || savedTrip.startDate || '')
  const [endDate, setEndDate] = useState(search.endDate || savedTrip.endDate || '')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const today = getTodayDateInputValue()
  const trip = { destination, destinationCode: destinationCode.toUpperCase(), startDate, endDate }

  function updateTrip(next) {
    const updated = { ...trip, ...next }
    if (next.destinationCode !== undefined)
      updated.destinationCode = next.destinationCode.toUpperCase()
    saveTrip(updated)
  }

  function continueToPlans(event) {
    event.preventDefault()
    if (
      !destination.trim() ||
      !/^[A-Za-z]{2}$/.test(destinationCode) ||
      !isValidTripDates(startDate, endDate, today)
    ) {
      setError(
        'Enter a destination, its 2-letter country code, and travel dates starting today or later, with the return date on or after departure.',
      )
      return
    }

    saveTrip(trip)
    navigate({ to: '/insurance/plans' })
  }

  return (
    <InsuranceLayout>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 6 }}>Travel insurance</h1>
      <p className="muted">
        First, tell us where and when you’re travelling. You’ll choose an insurance plan next.
      </p>
      <Notice />
      <div className="section-title">Destination details</div>
      <form onSubmit={continueToPlans} className="card">
        {error && <div className="banner error">{error}</div>}
        <div className="field">
          <label htmlFor="destination">Destination</label>
          <input
            id="destination"
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value)
              updateTrip({ destination: e.target.value })
            }}
            placeholder="e.g. Tokyo, Japan"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="destinationCode">Destination country code</label>
          <input
            id="destinationCode"
            value={destinationCode}
            onChange={(e) => {
              setDestinationCode(e.target.value)
              updateTrip({ destinationCode: e.target.value })
            }}
            placeholder="JP"
            maxLength={2}
            autoCapitalize="characters"
            required
          />
          <small className="muted">Use the 2-letter country code, for example JP for Japan.</small>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="start">Depart</label>
            <input
              id="start"
              type="date"
              min={today}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                updateTrip({ startDate: e.target.value })
              }}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="end">Return</label>
            <input
              id="end"
              type="date"
              min={startDate > today ? startDate : today}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                updateTrip({ endDate: e.target.value })
              }}
              required
            />
          </div>
        </div>
        <button type="submit" style={{ width: '100%' }}>
          Continue to insurance plans
        </button>
      </form>
      <Link to="/insurance/policies" className="muted">
        View My Insurance →
      </Link>
    </InsuranceLayout>
  )
}
