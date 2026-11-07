import { createFileRoute } from '@tanstack/react-router'
import MyPayments from '../features/scantopay/MyPayments'

export const Route = createFileRoute('/pay/history')({ component: MyPayments })
