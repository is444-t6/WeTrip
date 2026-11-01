import { createFileRoute } from '@tanstack/react-router'
import MyInsurance from '../features/insurance/MyInsurance'
export const Route = createFileRoute('/insurance/policies')({ component: MyInsurance })
