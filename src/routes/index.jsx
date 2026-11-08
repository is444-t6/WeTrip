import { createFileRoute } from '@tanstack/react-router'
import FrontDoor from '../features/home/FrontDoor'

export const Route = createFileRoute('/')({
  component: FrontDoor,
})
