import { createFileRoute } from '@tanstack/react-router'
import PlanDetails from '../features/insurance/PlanDetails'
export const Route = createFileRoute('/insurance/plan/$planId')({ component: PlanDetails })
