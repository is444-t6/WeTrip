export const plans = [
  {
    id: 'essential', name: 'Essential', tier: 'Everyday cover', premium: 28,
    summary: 'Core protection for common travel disruptions.',
    benefits: { medical: 100000, cancellation: 3000, baggage: 1500, delay: 300 },
    details: ['Overseas medical expenses up to S$100,000', 'Trip cancellation up to S$3,000', 'Baggage loss or damage up to S$1,500', 'Travel delay benefit up to S$300'],
    exclusions: ['Pre-existing medical conditions', 'Claims arising from reckless or unlawful acts', 'Trips exceeding 90 days'],
  },
  {
    id: 'plus', name: 'Plus', tier: 'More peace of mind', premium: 46,
    summary: 'Higher limits for medical, cancellation and baggage cover.',
    benefits: { medical: 250000, cancellation: 6000, baggage: 3000, delay: 600 },
    details: ['Overseas medical expenses up to S$250,000', 'Trip cancellation up to S$6,000', 'Baggage loss or damage up to S$3,000', 'Travel delay benefit up to S$600', 'Emergency assistance support (illustrative)'],
    exclusions: ['Pre-existing medical conditions', 'Claims arising from reckless or unlawful acts', 'Trips exceeding 90 days'],
  },
  {
    id: 'premier', name: 'Premier', tier: 'Extended cover', premium: 72,
    summary: 'The highest illustrative limits for extra reassurance.',
    benefits: { medical: 500000, cancellation: 10000, baggage: 5000, delay: 1000 },
    details: ['Overseas medical expenses up to S$500,000', 'Trip cancellation up to S$10,000', 'Baggage loss or damage up to S$5,000', 'Travel delay benefit up to S$1,000', 'Emergency assistance support (illustrative)'],
    exclusions: ['Pre-existing medical conditions', 'Claims arising from reckless or unlawful acts', 'Trips exceeding 90 days'],
  },
]

export const illustrativeNotice = 'Illustrative sample only. These are mock benefits and premiums, not an insurance offer or policy. Actual coverage, eligibility, terms and exclusions would be set by a licensed insurer.'

export function formatSgd(amount) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(amount)
}
