export default function Money({ amount, currency = 'SGD' }) {
  const n = Number(amount ?? 0)
  return <span>{currency} {n.toFixed(2)}</span>
}
