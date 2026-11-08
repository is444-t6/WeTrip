export function formatAmount(amount, currency = 'SGD') {
  const n = Number(amount ?? 0)
  return new Intl.NumberFormat('en-SG', {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(Number.isFinite(n) ? n : 0)
}

export function formatMoney(amount, currency = 'SGD') {
  return `${currency} ${formatAmount(amount, currency)}`
}
