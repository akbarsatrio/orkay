// Test unit verify brain: HMAC signature + whitelist, fokus perilaku FAIL-CLOSED.
// verify.js membaca env saat load (const top-level), jadi tiap skenario env
// dijalankan di subprocess terpisah lewat helper runScenario().
// Jalankan: node --test brain/test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VERIFY = join(__dirname, '..', 'src', 'verify.js')

// Jalankan skenario: import verify.js dengan env tertentu, panggil fungsi,
// cetak hasil sebagai JSON. Mengembalikan objek hasil.
function runScenario(env, code) {
  const script = `
    import { verifySignature, isAllowed } from ${JSON.stringify(VERIFY)}
    import crypto from 'node:crypto'
    const out = (${code})({ verifySignature, isAllowed, crypto })
    process.stdout.write(JSON.stringify(out))
  `
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, ...env },
    encoding: 'utf-8',
  })
  if (r.status !== 0) throw new Error(`subprocess gagal: ${r.stderr}`)
  return JSON.parse(r.stdout)
}

test('production tanpa SECRET → verifySignature FAIL CLOSED', () => {
  const out = runScenario(
    { NODE_ENV: 'production', WA_WEBHOOK_SECRET: '', WA_DEV_OPEN: '1' },
    `({ verifySignature }) => verifySignature({ headers: {}, rawBody: Buffer.from('x') })`
  )
  assert.equal(out.ok, false, 'di production tanpa secret harus ditolak walau DEV_OPEN=1')
})

test('production tanpa whitelist → isAllowed tolak semua', () => {
  const out = runScenario(
    { NODE_ENV: 'production', WA_ALLOWED_NUMBERS: '', WA_DEV_OPEN: '1' },
    `({ isAllowed }) => ({ allowed: isAllowed('628123456789') })`
  )
  assert.equal(out.allowed, false)
})

test('dev + WA_DEV_OPEN=1 tanpa secret → boleh skip (dev nyaman)', () => {
  const out = runScenario(
    { NODE_ENV: 'development', WA_WEBHOOK_SECRET: '', WA_DEV_OPEN: '1' },
    `({ verifySignature }) => verifySignature({ headers: {}, rawBody: Buffer.from('x') })`
  )
  assert.equal(out.ok, true)
  assert.equal(out.skipped, true)
})

test('dev TANPA WA_DEV_OPEN tanpa secret → tetap fail closed', () => {
  const out = runScenario(
    { NODE_ENV: 'development', WA_WEBHOOK_SECRET: '', WA_DEV_OPEN: '' },
    `({ verifySignature }) => verifySignature({ headers: {}, rawBody: Buffer.from('x') })`
  )
  assert.equal(out.ok, false)
})

test('HMAC signature valid diterima', () => {
  const out = runScenario(
    { NODE_ENV: 'production', WA_WEBHOOK_SECRET: 'rahasia123' },
    `({ verifySignature, crypto }) => {
       const raw = Buffer.from(JSON.stringify({ event: 'message.received' }))
       const sig = 'sha256=' + crypto.createHmac('sha256', 'rahasia123').update(raw).digest('hex')
       return verifySignature({ headers: { 'x-openwa-signature': sig }, rawBody: raw })
     }`
  )
  assert.equal(out.ok, true)
})

test('HMAC signature salah ditolak', () => {
  const out = runScenario(
    { NODE_ENV: 'production', WA_WEBHOOK_SECRET: 'rahasia123' },
    `({ verifySignature }) => {
       const raw = Buffer.from('halo')
       return verifySignature({ headers: { 'x-openwa-signature': 'sha256=deadbeef' }, rawBody: raw })
     }`
  )
  assert.equal(out.ok, false)
})

test('whitelist cocok → izinkan, tidak cocok → tolak', () => {
  const out = runScenario(
    { NODE_ENV: 'production', WA_ALLOWED_NUMBERS: '628111, 628222' },
    `({ isAllowed }) => ({ ok1: isAllowed('628111'), ok2: isAllowed('628222@c.us'), no: isAllowed('628999') })`
  )
  assert.equal(out.ok1, true)
  assert.equal(out.ok2, true, 'suffix @c.us harus dinormalisasi')
  assert.equal(out.no, false)
})
