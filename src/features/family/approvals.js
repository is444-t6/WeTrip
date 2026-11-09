// Pure helpers for the pending-approvals list.

const money = (n) => `SGD ${Number(n).toFixed(2)}`

// Old requests hold a payment for a merchant; an "ask for more" has no merchant
// (the backend sends it blank). Newer builds may also flag it outright.
export function isPayment(r) {
  if (r.isPayment !== undefined) return Boolean(r.isPayment)
  if (Number(r.requestedAmount) > 0) return false
  return !(r.merchantAccountId === '' || r.merchantAccountId === null)
}

// The amount a request is about, whichever kind it is.
export const requestAmount = (r) => Number(r.requestedAmount ?? r.amount ?? 0)

// What the child sees when ChildSpend turns a payment down. The server's own
// message wins; otherwise build one from what is left and how far over it is.
export function declineMessage({ message, remaining, shortBy }) {
  if (message) return message
  const left = Number(remaining ?? 0)
  const short = Number(shortBy ?? 0)
  const base =
    left > 0
      ? `You have ${money(left)} left this period.`
      : 'You have nothing left to spend this period.'
  return short > 0 ? `${base} This payment is ${money(short)} over.` : base
}

// Approving moves money out of the child's own account, so a request larger
// than their balance cannot go through until they are topped up.
export function exceedsBalance(request, child) {
  return Boolean(child) && Number(request.amount ?? 0) > Number(child.balance ?? 0)
}

// One entry per child who cannot cover some of their waiting requests, so the
// list can say it once instead of on every row.
export function shortfalls(requests, children) {
  const byLink = new Map((children ?? []).map((c) => [c.familyLinkId, c]))
  const found = new Map()
  for (const r of (requests ?? []).filter(isPayment)) {
    const child = byLink.get(r.familyLinkId)
    if (!exceedsBalance(r, child)) continue
    const entry = found.get(child.familyLinkId) ?? {
      name: child.nickname || child.childCustomerId,
      balance: Number(child.balance ?? 0),
      count: 0,
    }
    entry.count += 1
    found.set(child.familyLinkId, entry)
  }
  return [...found.values()]
}

export function shortfallMessage({ name, balance, count }) {
  const what = count === 1 ? '1 request' : `${count} requests`
  return `${name} has ${money(balance)}, so ${what} above that will not go through until you top them up.`
}

export function approvalsSummary(requests) {
  const list = requests ?? []
  return { count: list.length, total: list.reduce((sum, r) => sum + requestAmount(r), 0) }
}
