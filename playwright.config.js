import { defineConfig, devices } from '@playwright/test'

// UI regression suite for the WeTrip frontend. It runs against the Vite dev
// server, which proxies /api/family and /api/fx to the live sandbox — so the
// tests read real data. They are read-only; none of them mutate a trip or an
// account.
const PORT = 5199

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
