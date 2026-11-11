import { CATEGORIES as BUDGET_CATEGORIES } from '../budget/constants'

// Budget owns the category list (Budget_Atomic /categories). Family uses the
// same six labels, so a child's spend, a parent's rule and a trip budget all
// talk about the same "Food" or "Transport". Read-only use of Budget's list.
export const CATEGORIES = BUDGET_CATEGORIES.map((c) => c.label)

export const DEFAULT_CATEGORY = 'Others'

// Spends recorded before the switch used Family's own names. Shown under the
// Budget category they belong to; anything unknown is Others.
const OLD_NAMES = {
  general: 'Others',
  study: 'Others',
  other: 'Others',
  fun: 'Activities',
  rent: 'Accommodation',
}

export function toCategory(label) {
  const text = String(label ?? '').trim()
  const match = CATEGORIES.find((c) => c.toLowerCase() === text.toLowerCase())
  return match ?? OLD_NAMES[text.toLowerCase()] ?? DEFAULT_CATEGORY
}

// Rows of { category, total } with old names folded into Budget's, largest first.
export function mergeByCategory(rows) {
  const totals = new Map()
  for (const r of rows ?? []) {
    const key = toCategory(r.category)
    totals.set(key, (totals.get(key) ?? 0) + Number(r.total ?? 0))
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}
