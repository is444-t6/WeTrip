export const CATEGORIES = [
  { id: 6, label: 'Food' },
  { id: 2, label: 'Transport' },
  { id: 5, label: 'Shopping' },
  { id: 3, label: 'Accommodation' },
  { id: 1, label: 'Activities' },
  { id: 4, label: 'Others' },
]

export const SOURCE = { MANUAL: 1, QR: 2, RECEIPT: 3, BANK: 4, FIXED: 5 }

// A fixed-cost row as typed in the forms (strings until submitted).
export const blankFixedCost = () => ({ name: '', categoryId: CATEGORIES[0].id, amount: '' })

// Budgets are SGD by design; a trip's foreign money lives in SmartFX, not here.
export const DEFAULT_CURRENCY = 'SGD'

export const categoryName = (id) => CATEGORIES.find((c) => c.id === Number(id))?.label ?? 'Other'
