// Live contract test for WeTrip_Analytics_Composite (#56): RunEtlNow + GetInsights.
//
//   bun --env-file=.env.local scripts/test-analytics.mjs
//
// Writes only to the analytics data mart (EtlRun, staging, facts). Moves no money.
// Runs the ETL twice back to back: the second run must insert no new SourceKeys and
// leave the totals unchanged (upserts, no duplicates). The data mart holds only
// aggregates through this API, so per-row checks (harness trip scrubbed, a closed
// trip's FactTrip.Status) are covered by the counts, not by reading rows.

import { assert, env, field, http, step, summary } from './_lib.mjs'

const BASE = 'https://smuedu-dev.outsystemsenterprise.com/WeTrip_Analytics_Composite/rest/Analytics'
const KEY = env('WETRIP_SERVER_KEY')
const SESSION = `${env('PARENT_CUSTOMER_ID', '0000002169')}:${env('PARENT_ACCOUNT_ID', '0000004554')}:Analytics`
const headers = { 'X-Contacts-Key': KEY, 'X-Session-Token': SESSION }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function insights() {
  const res = await http(BASE, 'GET', 'GetInsights', { headers })
  assert(res.ok, `GetInsights ${res.status}: ${JSON.stringify(res.json)}`)
  return res.json
}

// Starts a run and waits for it to finish (the timer usually picks it up within seconds).
async function runOnce() {
  const res = await http(BASE, 'POST', 'RunEtlNow', { headers })
  assert(res.ok, `RunEtlNow ${res.status}: ${JSON.stringify(res.json)}`)
  const id = field(res.json, 'etlRunId')
  assert(id > 0, `RunEtlNow returned no run: ${JSON.stringify(res.json)}`)
  for (let i = 0; i < 60; i++) {
    const data = await insights()
    const run = data.LastRun
    if (run.EtlRunId === id && run.Status !== 'Running') return { run, data }
    await sleep(3000)
  }
  throw new Error(`run ${id} still Running after 3 minutes`)
}

const balanced = (r) => r.RowsExtracted === r.RowsLoaded + r.RowsRejected

console.log('Analytics composite (live)')

await step('GetInsights refuses a request without a session', async () => {
  const res = await http(BASE, 'GET', 'GetInsights', { headers: { 'X-Contacts-Key': KEY } })
  assert(!res.ok, `expected an error, got ${res.status}`)
})

await step('GetInsights refuses a wrong key', async () => {
  const res = await http(BASE, 'GET', 'GetInsights', {
    headers: { ...headers, 'X-Contacts-Key': 'nope' },
  })
  assert(!res.ok, `expected an error, got ${res.status}`)
})

const before = await step('GetInsights reads the mart', insights)

const first = await step('run 1 finishes Success with Extracted = Loaded + Rejected', async () => {
  const r = await runOnce()
  assert(r.run.Status === 'Success', `status ${r.run.Status}: ${r.run.Error}`)
  assert(balanced(r.run), `counts ${JSON.stringify(r.run)}`)
  console.log(
    `      run ${r.run.EtlRunId}: ${r.run.RowsExtracted} extracted, ${r.run.RowsLoaded} loaded, ${r.run.RowsRejected} rejected, ${r.run.RowsInserted} new`,
  )
  return r
})

// Only the first-ever run (no earlier success) is a full-history extract.
if (first && String(before?.LastSuccessOn ?? '').startsWith('1900')) {
  await step('the first full load rejects the test trips (Trip harness, E2E…)', async () => {
    assert(first.run.RowsRejected > 0, 'expected harness/E2E rows to be scrubbed')
  })
}

await step('run 2 inserts no new SourceKeys and leaves the totals unchanged', async () => {
  assert(first, 'run 1 failed')
  const { run, data } = await runOnce()
  assert(run.Status === 'Success', `status ${run.Status}: ${run.Error}`)
  assert(balanced(run), `counts ${JSON.stringify(run)}`)
  assert(run.RowsInserted === 0, `run 2 inserted ${run.RowsInserted} new rows`)
  assert(
    data.SpendSgd === first.data.SpendSgd,
    `SpendSgd ${first.data.SpendSgd} -> ${data.SpendSgd}`,
  )
  assert(
    data.Bnpl.Plans === first.data.Bnpl.Plans,
    `plans ${first.data.Bnpl.Plans} -> ${data.Bnpl.Plans}`,
  )
  assert(
    data.TripsCount === first.data.TripsCount,
    `trips ${first.data.TripsCount} -> ${data.TripsCount}`,
  )
  console.log(
    `      SpendSgd ${data.SpendSgd}, saved vs spot ${data.SavedVsSpotSgd}, trips ${data.TripsCount}, plans ${data.Bnpl.Plans}`,
  )
})

await step('insights carry no customer ids', async () => {
  const text = JSON.stringify(await insights())
  assert(!/CustomerId|AccountId|\b000000\d{4}\b/.test(text), 'found an id in GetInsights')
})

summary()
