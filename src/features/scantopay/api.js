import { createClient } from '../../lib/http'

const { call, qs } = createClient({
  base: import.meta.env.VITE_SCANTOPAY_API_BASE || '/scantopay',
  apiKey: import.meta.env.VITE_SCANTOPAY_KEY,
  // GetHistory's list items arrive PascalCase. Note that normalising turns
  // BNPLPlanId into bNPLPlanId.
  normalize: true,
})

const withCustomer = (method, customerId) => `${method}${qs({ CustomerId: customerId })}`

// qrText is the scanned string as-is. amount is only read when the QR is an
// open amount (amount: 0), and numberOfMonths only by PayLater.
export const ScanToPayApi = {
  previewPayment: ({ customerId, qrText, amount = 0 }) =>
    call('POST', withCustomer('PreviewPayment', customerId), {
      qrText,
      amount,
      numberOfMonths: 0,
    }),
  // PayNow and PayLater move money. Nothing may call them automatically.
  payNow: ({ customerId, qrText, amount = 0 }) =>
    call('POST', withCustomer('PayNow', customerId), { qrText, amount, numberOfMonths: 0 }),
  payLater: ({ customerId, qrText, amount = 0, numberOfMonths }) =>
    call('POST', withCustomer('PayLater', customerId), { qrText, amount, numberOfMonths }),
  getHistory: (customerId) => call('GET', withCustomer('GetHistory', customerId)),
}
