import { createFileRoute } from '@tanstack/react-router'
import TripHub from '../features/trips/TripHub'

export const Route = createFileRoute('/trips/$tripId')({
  component: TripHub,
})
