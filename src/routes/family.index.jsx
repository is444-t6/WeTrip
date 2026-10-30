import { createFileRoute } from '@tanstack/react-router'
import FamilyHome from '../features/family/FamilyHome'

export const Route = createFileRoute('/family/')({
  component: FamilyHome,
})
