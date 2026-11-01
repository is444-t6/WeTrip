import { createFileRoute } from '@tanstack/react-router'
import InsuranceHome from '../features/insurance/InsuranceHome'
export const Route = createFileRoute('/insurance/')({ validateSearch: search => ({ destination: String(search.destination || ''), startDate: String(search.startDate || ''), endDate: String(search.endDate || '') }), component: InsuranceHome })
