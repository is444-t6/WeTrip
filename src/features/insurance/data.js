export function formatMoney(amount, currencyCode = 'SGD') {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currencyCode || 'SGD',
    }).format(value)
  } catch {
    return `${currencyCode || 'SGD'} ${value.toFixed(2)}`
  }
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(new Date(value))
}

export function planLabel(plan) {
  return plan?.name || plan?.planCode || `Plan ${plan?.id ?? ''}`
}
