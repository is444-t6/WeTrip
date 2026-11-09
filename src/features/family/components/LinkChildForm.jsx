import { useState } from 'react'
import { useFindCustomer, useLinkChild } from '../queries'
import Banner from './Banner'

// Look a child up by phone number, then send them a family invite. Used on the
// parent home and on the screen a parent sees before they have any child.
export default function LinkChildForm() {
  const [countryCode, setCountryCode] = useState('65')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [nickname, setNickname] = useState('')
  const [hostCurrency, setHostCurrency] = useState('SGD')
  const [done, setDone] = useState(false)

  const find = useFindCustomer()
  const link = useLinkChild()
  const busy = find.isPending || link.isPending
  const found = find.data

  function lookup(e) {
    e.preventDefault()
    setDone(false)
    find.mutate({ countryCode: countryCode.trim(), phoneNumber: phoneNumber.trim() })
  }

  function send(e) {
    e.preventDefault()
    link.mutate(
      {
        childCustomerId: found.customerId,
        nickname: nickname.trim(),
        hostCurrency: hostCurrency.trim() || 'SGD',
      },
      { onSuccess: () => setDone(true) },
    )
  }

  return (
    <div className="card">
      <Banner>{find.error?.message || link.error?.message}</Banner>
      {done ? (
        <Banner kind="ok">Invite sent — the child needs to accept it on their side.</Banner>
      ) : !found ? (
        <form onSubmit={lookup}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="link-child-country">Country code</label>
              <input
                id="link-child-country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="link-child-phone">Phone number</label>
              <input
                id="link-child-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
            </div>
          </div>
          <button disabled={busy} type="submit" style={{ width: '100%' }}>
            Find
          </button>
        </form>
      ) : (
        <form onSubmit={send}>
          <div
            className="row-between"
            style={{
              background: 'var(--accent-soft)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 14,
            }}
          >
            <div className="stack">
              <strong>{found.name || 'Customer found'}</strong>
              <span className="muted">Customer id {found.customerId}</span>
            </div>
            <span className="badge active">found</span>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="link-child-nickname">Nickname</label>
              <input
                id="link-child-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Jamie (Seoul)"
              />
            </div>
            <div className="field">
              <label htmlFor="link-child-currency">Host currency</label>
              <input
                id="link-child-currency"
                value={hostCurrency}
                onChange={(e) => setHostCurrency(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <button disabled={busy} type="submit">
              Send invite
            </button>
            <button type="button" className="secondary" onClick={() => find.reset()}>
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
