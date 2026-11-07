import { createFileRoute } from '@tanstack/react-router'
import ScanToPay from '../features/scantopay/ScanToPay'

export const Route = createFileRoute('/pay/')({ component: ScanToPay })
