import { createFileRoute, redirect } from '@tanstack/react-router'
import Home from '../features/home/Home'
import { isLoggedIn } from '../features/family/session'

// The home page needs a signed-in customer; the sign-in card lives on /family.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!isLoggedIn()) throw redirect({ to: '/family' })
  },
  component: Home,
})
