import { createFileRoute } from '@tanstack/react-router'
import MilesHome from '../features/miles/MilesHome'

export const Route = createFileRoute('/miles/')({ component: MilesHome })
