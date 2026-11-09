// Existing WeTrip screens and tests use a plain two-decimal amount.
export default function Money({ amount, currency = 'SGD' }) {
  return (
    <span>
      {currency} {Number(amount ?? 0).toFixed(2)}
    </span>
  )
}
