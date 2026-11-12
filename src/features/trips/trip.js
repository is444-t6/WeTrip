// Small pure helpers for the trip overview.

export const day = (value) => String(value ?? '').slice(0, 10)

// Where each trip currency is spent, to pre-fill the insurance country code.
// Euro is left out on purpose: it covers many countries, so the traveller picks.
export const COUNTRY_BY_CURRENCY = { JPY: 'JP', GBP: 'GB', CHF: 'CH', USD: 'US' }

// Foreign money already spent from the trip's pot.
export function foreignSpent(spends) {
  return (spends ?? []).reduce((sum, s) => sum + Number(s.amount ?? 0), 0)
}

// Merchant QRs are JSON: { merchantCode, amount, currency }. amount 0 = open amount.
export function parseMerchantQr(text) {
  try {
    const qr = JSON.parse(text)
    const merchantCode = String(qr?.merchantCode ?? qr?.MerchantCode ?? '').trim()
    if (!merchantCode) return null
    return {
      merchantCode,
      amount: Number(qr.amount ?? qr.Amount ?? 0) || 0,
      currency: String(qr.currency ?? qr.Currency ?? ''),
    }
  } catch {
    return null
  }
}
