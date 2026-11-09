import { createFileRoute, redirect } from '@tanstack/react-router'

// The sign-in used to live under /family. It belongs to the whole app, so it
// moved to /login; this keeps old links and bookmarks working.
export const Route = createFileRoute('/family/dev-login')({
  beforeLoad: () => {
    throw redirect({ to: '/login' })
  },
})
