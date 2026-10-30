import { createFileRoute } from '@tanstack/react-router'
import Login from '../features/family/Login'

export const Route = createFileRoute('/family/dev-login')({
  component: Login,
})
