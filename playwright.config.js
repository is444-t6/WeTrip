import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

// The live suites and the dev server's proxy need WETRIP_SERVER_KEY. CI sets it;
// locally it comes from .env.local, so the secret is never committed.
if (!process.env.WETRIP_SERVER_KEY && fs.existsSync('.env.local')) {
  const match = fs.readFileSync('.env.local', 'utf8').match(/^WETRIP_SERVER_KEY=(.+)$/m)
  if (match) process.env.WETRIP_SERVER_KEY = match[1].trim()
}

// UI regression suite for the WeTrip frontend. It runs against a production
// build served by `vite preview`, which proxies /api/family and /api/fx to the
// live sandbox — so the tests read real data. tests/family.spec.js is read-only;
// tests/smartfx-api.spec.js writes trips to the sandbox and is serialized with
// the UI suite.
const PORT = 5199

// Specs that call the shared live sandbox. Everything else is mocked.
const LIVE = ['**/family.spec.js', '**/smartfx-api.spec.js']

export default defineConfig({
  testDir: './tests',
  // Mocked specs never leave the browser, so they run in parallel. The two live
  // specs share one sandbox (parallel calls make the Family API time out, and
  // smartfx-api writes trips), so bun run test:e2e runs them afterwards with one
  // worker. See the "live" project below.
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mocked', testIgnore: LIVE, use: { ...devices['Desktop Chrome'] } },
    { name: 'live', testMatch: LIVE, fullyParallel: false, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // A production build served by vite preview: pages load prebuilt bundles
    // instead of the dev server compiling modules on every fresh page. Preview
    // uses the same API proxy as dev (preview.proxy defaults to server.proxy).
    command: `bun run build && bun --bun vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
