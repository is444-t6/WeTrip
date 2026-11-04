
import { createClient } from '../../lib/http'

const { call } = createClient({
  base:
    import.meta.env.VITE_INSURANCE_API_BASE ||
    'https://smuedu-dev.outsystemsenterprise.com/WeTrip_Insurance_Composite/rest/InsuranceAPI',

  apiKey:
    import.meta.env.VITE_INSURANCE_API_KEY ||
    import.meta.env.VITE_FAMILY_API_KEY,

  auth: 'header',
  normalize: true,
})

export const insuranceApi = {
  getPlans: async () => {
    const response = await call('GET', 'Plans')

    console.log('Insurance Plans API response:', response)

    const plans = Array.isArray(response)
      ? response
      : response.plans ?? response.Plans ?? []

    return Array.isArray(plans) ? plans : []
  },

  getQuote: (body) => call('POST', 'Quote', body),

  purchase: (body) => call('POST', 'Purchase', body),

  getMyInsurance: () => call('GET', 'MyInsurance'),
}

export const InsuranceApi = insuranceApi
