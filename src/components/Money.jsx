import { money } from '../lib/format'

// Every amount in the app: "SGD 1,234.50", "JPY 96,675".
export default function Money({ amount, currency = 'SGD' }) {
  return <span>{money(amount, currency)}</span>
}
