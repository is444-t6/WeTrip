import { defineConfig, devices } from '@playwright/test'

// UI regression suite for the WeTrip frontend. It runs against the Vite dev
// server, which proxies /api/family and /api/fx to the live sandbox — so the
// tests read real data. tests/family.spec.js is read-only; tests/smartfx-api.spec.js
// writes trips to the sandbox and is serialized with the UI suite.
const PORT = 5199

export default defineConfig({
  testDir: './tests',
  // The suite talks to one shared live sandbox; parallel workers make the
  // Family API time out under load.
  workers: 1,
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
