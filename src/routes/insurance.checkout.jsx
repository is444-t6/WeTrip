import { createFileRoute } from '@tanstack/react-router'
import Checkout from '../features/insurance/Checkout'
export const Route = createFileRoute('/insurance/checkout')({ component: Checkout })
