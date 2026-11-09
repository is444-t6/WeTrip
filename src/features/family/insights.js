// Pure helpers behind the budget alerts and spending insights. No React, no
// fetching, so the date and threshold maths can be tested on their own.

// A budget counts as "nearly used" from this share of it onwards.
export const NEAR_LIMIT = 0.8

const DAY_MS = 86_400_000

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const diffDays = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS)
const money = (n) => `SGD ${Number(n).toFixed(2)}`

// Local-date YYYY-MM-DD. toISOString() converts to UTC, which shifts the date
// by a day for anyone east of Greenwich (e.g. Singapore, UTC+8).
export function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function budgetStatus(spent, budget) {
  const b = Number(budget ?? 0)
  const s = Number(spent ?? 0)
  if (!(b > 0)) return { level: 'none', pct: 0, spent: s, budget: 0, remaining: 0 }
  const ratio = s / b
  return {
    level: ratio >= 1 ? 'over' : ratio >= NEAR_LIMIT ? 'near' : 'ok',
    pct: Math.round(ratio * 100),
    spent: s,
    budget: b,
    remaining: Math.max(0, b - s),
  }
}

// What to tell the parent or the child about their budget, or null when there
// is nothing to say. "over" covers spending exactly the whole budget too, since
// any further payment is declined until the parent raises the limit.
export function alertMessage({ who, name, spent, budget, period }) {
  const st = budgetStatus(spent, budget)
  if (st.level !== 'over' && st.level !== 'near') return null
  const span = period === 'Weekly' ? 'weekly' : 'monthly'
  const thisSpan = period === 'Weekly' ? "this week's" : "this month's"
  const pct = Math.min(st.pct, 999)

  if (who === 'child') {
    if (st.level === 'near') {
      return {
        kind: 'warn',
        text: `You've used ${pct}% of ${thisSpan} budget. ${money(st.remaining)} left.`,
      }
    }
    return {
      kind: 'error',
      text: `You've reached ${thisSpan} budget. New payments will be declined unless your parent raises your limit.`,
    }
  }

  if (st.level === 'near') {
    return {
      kind: 'warn',
      text: `${name} has used ${pct}% of their ${span} budget (${money(st.spent)} of ${money(st.budget)}).`,
    }
  }
  const over = st.spent > st.budget
  return {
    kind: 'error',
    text: over
      ? `${name} is over their ${span} budget by ${money(st.spent - st.budget)}. New payments will be declined unless you raise their limit.`
      : `${name} has used all of their ${span} budget. New payments will be declined unless you raise their limit.`,
  }
}

// The calendar window a budget period covers around `now`. Weeks start on
// Monday, months on the 1st.
export function periodBounds(period, now = new Date()) {
  const today = startOfDay(now)
  let start
  let length
  if (period === 'Weekly') {
    start = addDays(today, -((today.getDay() + 6) % 7))
    length = 7
  } else {
    start = new Date(today.getFullYear(), today.getMonth(), 1)
    length = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  }
  return { start, end: addDays(start, length - 1), length, elapsed: diffDays(today, start) + 1 }
}

export function previousPeriod(period, bounds) {
  if (period === 'Weekly') {
    return { start: addDays(bounds.start, -7), end: addDays(bounds.start, -1) }
  }
  return {
    start: new Date(bounds.start.getFullYear(), bounds.start.getMonth() - 1, 1),
    end: addDays(bounds.start, -1),
  }
}

// Straight-line projection of the period's spending from the pace so far.
// Too few days of data make the pace meaningless, so the first days of a
// period report 'early' instead of a number.
export function forecast({ spent, budget, bounds, now = new Date() }) {
  const s = Number(spent ?? 0)
  const b = Number(budget ?? 0)
  if (!(b > 0)) return { state: 'nobudget' }
  if (s > b) return { state: 'over', overBy: s - b }

  const minDays = Math.min(3, Math.ceil(bounds.length / 4))
  if (s > 0 && bounds.elapsed < minDays) return { state: 'early' }

  const perDay = s / bounds.elapsed
  const projected = perDay * bounds.length
  if (projected <= b) return { state: 'on-track', projected }

  const daysToLimit = Math.ceil((b - s) / perDay)
  return {
    state: 'over-pace',
    projected,
    overBy: projected - b,
    runsOutOn: addDays(startOfDay(now), daysToLimit),
  }
}

// Spending per category, largest first, each with its share of the total.
export function categoryTotals(expenses) {
  const totals = new Map()
  for (const x of expenses ?? []) {
    const key = x.category?.trim() || 'Other'
    totals.set(key, (totals.get(key) ?? 0) + Number(x.amount ?? 0))
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0)
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total, share: sum > 0 ? total / sum : 0 }))
    .sort((a, b) => b.total - a.total)
}

// Whole-percent change from `previous` to `current`; null when there is no
// earlier spending to compare against.
export function percentChange(current, previous) {
  const p = Number(previous ?? 0)
  if (!(p > 0)) return null
  return Math.round(((Number(current ?? 0) - p) / p) * 100)
}

// Days left in the period counting today, and how far through it we are.
export function periodTiming(bounds) {
  return {
    daysLeft: Math.max(0, bounds.length - bounds.elapsed + 1),
    elapsedPct: Math.min(100, (bounds.elapsed / bounds.length) * 100),
  }
}

// What the child can spend each remaining day and still end inside the budget.
export function safeDailySpend(remaining, daysLeft) {
  const r = Number(remaining ?? 0)
  return daysLeft > 0 && r > 0 ? r / daysLeft : 0
}

// Spending per day from the start of the period up to today, zero days
// included, so a chart shows the quiet days as well as the busy ones.
export function dailyTotals(expenses, bounds) {
  const byDay = new Map()
  for (const x of expenses ?? []) {
    const key = String(x.date ?? '').slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + Number(x.amount ?? 0))
  }
  const days = []
  for (let i = 0; i < Math.min(bounds.elapsed, bounds.length); i++) {
    const key = ymd(addDays(bounds.start, i))
    days.push({ date: key, total: byDay.get(key) ?? 0 })
  }
  return days
}

// One word for how the budget is going. "watch" means spending is clearly
// ahead of the calendar; it stays quiet in the first days of a period, when
// one purchase would make any pace look alarming.
export function budgetHealth({ spent, budget, bounds }) {
  const st = budgetStatus(spent, budget)
  if (st.level === 'none') return { state: 'none', label: 'No budget set' }
  if (st.level === 'over') return { state: 'over', label: 'Over budget' }
  const minDays = Math.min(3, Math.ceil(bounds.length / 4))
  const ahead = st.spent / st.budget - bounds.elapsed / bounds.length > 0.15
  if (ahead && bounds.elapsed >= minDays) return { state: 'watch', label: 'Spending fast' }
  return { state: 'ok', label: 'On track' }
}

// A heads-up for the child before they pay: more than they have, or more than
// is left in the budget (which sends the payment to their parent).
export function payNotice({ amount, balance, remaining, hasBudget }) {
  const a = Number(amount ?? 0)
  if (!(a > 0)) return null
  if (a > Number(balance ?? 0)) {
    return { kind: 'error', text: `That is more than your balance (${money(balance)}).` }
  }
  if (hasBudget && a > Number(remaining ?? 0)) {
    return {
      kind: 'warn',
      text: `That is ${money(a - Number(remaining ?? 0))} over what is left in your budget, so it will be declined unless your parent raises your limit.`,
    }
  }
  return null
}
