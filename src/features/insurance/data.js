export function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDateInputValue() {
  return toDateInputValue(new Date())
}

export function getYesterdayDateInputValue() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return toDateInputValue(yesterday)
}

export function getBirthDateMinInputValue() {
  const earliestDate = new Date()
  earliestDate.setFullYear(earliestDate.getFullYear() - 120)
  return toDateInputValue(earliestDate)
}

export function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isValidTripDates(startDate, endDate, today = getTodayDateInputValue()) {
  return isValidDateInput(startDate)
    && isValidDateInput(endDate)
    && startDate >= today
    && endDate >= startDate
}

export function isReasonableBirthDate(value, today = getTodayDateInputValue()) {
  return isValidDateInput(value)
    && value >= getBirthDateMinInputValue()
    && value < today
}

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
