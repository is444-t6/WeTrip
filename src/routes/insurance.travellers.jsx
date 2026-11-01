import { createFileRoute } from '@tanstack/react-router'
import TravellerDetails from '../features/insurance/TravellerDetails'
export const Route = createFileRoute('/insurance/travellers')({ validateSearch: search => ({ planId: String(search.planId || '') }), component: TravellerDetails })
