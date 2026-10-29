import { createFileRoute } from '@tanstack/react-router'
import DevLogin from '../features/family/DevLogin'

export const Route = createFileRoute('/family/dev-login')({
  component: DevLogin,
})
