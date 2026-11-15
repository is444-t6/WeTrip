import { createFileRoute } from '@tanstack/react-router'
import Insights from '../features/analytics/Insights'

export const Route = createFileRoute('/insights')({
  component: Insights,
})
