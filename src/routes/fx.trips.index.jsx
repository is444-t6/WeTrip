import { createFileRoute, redirect } from '@tanstack/react-router'

// Trips are listed on /fx; there is no list page of their own.
export const Route = createFileRoute('/fx/trips/')({
  beforeLoad: () => {
    throw redirect({ to: '/fx' })
  },
})
