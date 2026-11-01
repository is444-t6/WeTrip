const KEY = 'wetrip.illustrative.insurancePolicies'

export function getPolicies() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function savePolicy(policy) {
  const policies = getPolicies()
  policies.unshift(policy)
  localStorage.setItem(KEY, JSON.stringify(policies))
  return policy
}
