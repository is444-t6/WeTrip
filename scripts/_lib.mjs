// Tiny test runner shared by test-atomic.mjs and test-composite.mjs.
// No dependencies — just global fetch (Node 20+).

let pass = 0
let fail = 0
const failures = []

export function env(name, fallback) {
  const v = process.env[name] ?? fallback
  if (v === undefined) {
    throw new Error(`Missing required env var ${name}. Fill it in .env.test (see .env.test.example).`)
  }
  return v
}

export async function step(name, fn) {
  try {
    const result = await fn()
    pass++
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
    return result
  } catch (err) {
    fail++
    failures.push({ name, err })
    console.log(`  \x1b[31m✗\x1b[0m ${name}`)
    console.log(`      ${err.message}`)
    return undefined
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function summary() {
  console.log('')
  console.log(`${pass} passed, ${fail} failed`)
  if (failures.length) {
    console.log('\nFailed steps:')
    for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`)
  }
  process.exitCode = fail > 0 ? 1 : 0
}

export async function http(baseUrl, method, path, { headers = {}, body } = {}) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { _raw: text }
  }
  return { status: res.status, ok: res.ok, json }
}
