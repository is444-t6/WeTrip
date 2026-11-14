import { money } from '../lib/format'

export default function BalanceHero({ label, amount, currency = 'SGD', sub, foot }) {
  return (
    <div className="hero">
      <div className="hero-label">{label}</div>
      <div className="hero-amount">{money(amount, currency)}</div>
      {sub && <div className="hero-sub">{sub}</div>}
      {foot && <div className="hero-foot">{foot}</div>}
    </div>
  )
}
