import { createFileRoute } from '@tanstack/react-router'
import TripDetail from '../features/fx/TripDetail'

export const Route = createFileRoute('/fx/trips/$tripId')({
  component: TripDetail,
})
