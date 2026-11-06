// Copy the real Ids from the atomic's static entities (Data tab > Category / ExpenseSource > records).
export const CATEGORIES = [
  { id: 1, label: 'Food' },
  { id: 2, label: 'Transport' },
  { id: 3, label: 'Shopping' },
  { id: 4, label: 'Accommodation' },
  { id: 5, label: 'Activities' },
  { id: 6, label: 'Others' },
]

export const SOURCE = { MANUAL: 1, QR: 2, RECEIPT: 3, BANK: 4 }

// TODO: read from the trip once Charles's trip API is wired in.
export const DEFAULT_CURRENCY = 'SGD'

export const categoryName = (id) => CATEGORIES.find((c) => c.id === Number(id))?.label ?? 'Other'
