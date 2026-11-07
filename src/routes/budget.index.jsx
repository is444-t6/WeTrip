import { createFileRoute } from '@tanstack/react-router'
import BudgetHome from '../features/budget/BudgetHome'

export const Route = createFileRoute('/budget/')({ component: BudgetHome })
