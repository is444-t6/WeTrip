import { createFileRoute } from '@tanstack/react-router'
import BudgetDetail from '../features/budget/BudgetDetail'

export const Route = createFileRoute('/budget/$tripId')({ component: BudgetDetail })
