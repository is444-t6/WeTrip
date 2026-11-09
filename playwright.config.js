import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

// The API suite needs the SmartFX ApiKey site property. Prefer the env CI
// provides, then fall back to .env.local so the secret is never committed.
if (!process.env.SMARTFX_API_KEY) {
  if (process.env.VITE_FX_API_KEY) {
    process.env.SMARTFX_API_KEY = process.env.VITE_FX_API_KEY
  } else if (fs.existsSync('.env.local')) {
    const match = fs.readFileSync('.env.local', 'utf8').match(/^VITE_FX_API_KEY=(.+)$/m)
    if (match) process.env.SMARTFX_API_KEY = match[1].trim()
  }
}

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
