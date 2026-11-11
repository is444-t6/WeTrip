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
