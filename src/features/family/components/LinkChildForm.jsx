import { useState } from 'react'
import { FamilyApi } from '../api'
import Banner from './Banner'

export default function LinkChildForm({ onLinked }) {
  const [countryCode, setCountryCode] = useState('65')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [found, setFound] = useState(null)
  const [nickname, setNickname] = useState('')
  const [hostCurrency, setHostCurrency] = useState('SGD')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function lookup(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setFound(null)
    try {
      const result = await FamilyApi.findCustomerByPhone(countryCode.trim(), phoneNumber.trim())
      setFound(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function link(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await FamilyApi.linkChild({
        childCustomerId: found.customerId,
        nickname: nickname.trim(),
        hostCurrency: hostCurrency.trim() || 'SGD',
      })
      setDone(true)
      onLinked?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <Banner>{error}</Banner>
      {done ? (
        <Banner kind="ok">Invite sent — the child needs to accept it on their side.</Banner>
      ) : !found ? (
        <form onSubmit={lookup}>
          <div className="grid-2">
            <div className="field">
              <label>Country code</label>
              <input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} required />
            </div>
            <div className="field">
              <label>Phone number</label>
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
            </div>
          </div>
          <button disabled={busy} type="submit" style={{ width: '100%' }}>Find</button>
        </form>
      ) : (
        <form onSubmit={link}>
          <div className="row-between" style={{ background: 'var(--accent-soft)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
            <div className="stack">
              <strong>{found.name}</strong>
              <span className="muted">{found.customerId}</span>
            </div>
            <span className="badge active">found</span>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Nickname</label>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Jamie (Seoul)" />
            </div>
            <div className="field">
              <label>Host currency</label>
              <input value={hostCurrency} onChange={(e) => setHostCurrency(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <button disabled={busy} type="submit">Send invite</button>
            <button type="button" className="secondary" onClick={() => setFound(null)}>Back</button>
          </div>
        </form>
      )}
    </div>
  )
}
