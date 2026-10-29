import { createFileRoute } from '@tanstack/react-router'
import FxHome from '../features/fx/FxHome'

export const Route = createFileRoute('/fx/')({
  component: FxHome,
})
