import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import './index.css'

// A mouse wheel over a focused number field changes its value (800 became 799.60
// mid-scroll). Drop the focus first so the wheel only scrolls the page.
addEventListener(
  'wheel',
  () => {
    const el = document.activeElement
    if (el instanceof HTMLInputElement && el.type === 'number') el.blur()
  },
  { passive: true, capture: true },
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
