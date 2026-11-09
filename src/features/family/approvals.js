// Pure helpers for the pending-approvals list.

const money = (n) => `SGD ${Number(n).toFixed(2)}`

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
  for (const r of requests ?? []) {
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
  return { count: list.length, total: list.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) }
}
