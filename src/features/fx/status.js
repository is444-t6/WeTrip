export const TRIP_STATUS = {
  Watching: { label: 'Watching', tone: 'pending' },
  PartiallyLocked: { label: 'Partly locked', tone: 'active' },
  Locked: { label: 'Locked', tone: 'active' },
  Spending: { label: 'Spending', tone: 'active' },
  Completed: { label: 'Completed', tone: '' },
  Cancelled: { label: 'Cancelled', tone: 'removed' },
}

export const isEnded = (status) => status === 'Completed' || status === 'Cancelled'

export function tripStatus(status) {
  return TRIP_STATUS[status] || { label: status, tone: 'pending' }
}

// Active trips first by start date; ended ones (newest first) go under "Past trips".
export function splitTrips(trips) {
  const list = trips ?? []
  const byStart = (a, b) => String(a.tripStartDate).localeCompare(String(b.tripStartDate))
  return {
    active: list.filter((t) => !isEnded(t.status)).sort(byStart),
    ended: list.filter((t) => isEnded(t.status)).sort((a, b) => byStart(b, a)),
  }
}
