import { createFileRoute } from '@tanstack/react-router'
import InsurancePlans from '../features/insurance/InsurancePlans'

export const Route = createFileRoute('/insurance/plans')({
  component: InsurancePlans,
})
