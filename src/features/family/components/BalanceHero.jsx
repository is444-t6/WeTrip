import { formatMoney } from '../../../lib/money'

export default function BalanceHero({ label, amount, currency = 'SGD', sub, foot }) {
  return (
    <section className="hero" data-mark={currency}>
      <div className="hero-label">{label}</div>
      <div className="hero-amount">{formatMoney(amount, currency)}</div>
      {sub && <div className="hero-sub">{sub}</div>}
      {foot && <div className="hero-foot">{foot}</div>}
    </section>
  )
}
