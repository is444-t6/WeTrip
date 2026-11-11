export const CATEGORIES = [
  { id: 6, label: 'Food' },
  { id: 2, label: 'Transport' },
  { id: 5, label: 'Shopping' },
  { id: 3, label: 'Accommodation' },
  { id: 1, label: 'Activities' },
  { id: 4, label: 'Others' },
]

export const SOURCE = { MANUAL: 1, QR: 2, RECEIPT: 3, BANK: 4 }

// Budgets are SGD by design; a trip's foreign money lives in SmartFX, not here.
export const DEFAULT_CURRENCY = 'SGD'

export const categoryName = (id) => CATEGORIES.find((c) => c.id === Number(id))?.label ?? 'Other'
