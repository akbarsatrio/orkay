// Test INTEGRASI race-condition (TOCTOU) untuk pembayaran cicilan & konfirmasi recurring.
// Menembak banyak request paralel ke server nyata + MySQL.
//
// Butuh env DB (DB_HOST/PORT/USER/PASSWORD/NAME). Kalau DB tidak tersedia,
// seluruh test di-SKIP otomatis (tidak dianggap gagal).
//
// Jalankan (contoh instance default):
//   DB_HOST=localhost DB_PORT=3306 DB_USER=orkay_coba DB_PASSWORD=... DB_NAME=orkay_coba \
//   APP_PIN=123456 AUTH_SECRET=xxx node --test server/test/race.integration.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER_DIR = join(__dirname, '..')
const PORT = Number(process.env.TEST_PORT) || 3199
const BASE = `http://127.0.0.1:${PORT}`
const PIN = process.env.APP_PIN || '123456'

let child = null
let token = null
let dbAvailable = false

function startServer() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['index.js'], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(PORT),
        APP_PIN: PIN,
        AUTH_SECRET: process.env.AUTH_SECRET || 'test-secret-race-integration',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    const onData = (d) => {
      out += d.toString()
      if (/berjalan di http/i.test(out)) resolve()
      if (/gagal|ECONNREFUSED|ER_ACCESS|ENOTFOUND/i.test(out)) reject(new Error(out))
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => { if (code !== 0) reject(new Error(`server exit ${code}: ${out}`)) })
    setTimeout(() => reject(new Error('timeout start server: ' + out)), 8000)
  })
}

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  return res
}

before(async () => {
  try {
    await startServer()
    const res = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: PIN }),
    })
    if (!res.ok) throw new Error('login gagal')
    token = (await res.json()).token
    dbAvailable = true
  } catch (err) {
    console.error('[test] DB/server tidak tersedia, SKIP integrasi:', err.message.slice(0, 120))
    if (child) try { child.kill('SIGTERM') } catch {}
    dbAvailable = false
  }
})

after(() => {
  if (child) try { child.kill('SIGTERM') } catch {}
})

test('pay cicilan paralel tidak boleh over-pay melebihi tenor', async (t) => {
  if (!dbAvailable) return t.skip('DB tidak tersedia')

  // Seed: 1 rekening cash + 1 cicilan tenor 3.
  const acc = await (await api('/api/accounts', {
    method: 'POST',
    body: JSON.stringify({ name: 'TEST-RACE-CASH', type: 'bank', kind: 'cash', openingBalance: 100000000 }),
  })).json()

  const inst = await (await api('/api/installments', {
    method: 'POST',
    body: JSON.stringify({
      accountId: acc.id, name: 'TEST-RACE-INST',
      purchaseDate: '2026-01-01', principalTotal: 3000000, tenor: 3, monthlyAmount: 1000000,
    }),
  })).json()
  const instId = inst.installment.id

  // Tembak 6 pembayaran PARALEL untuk cicilan tenor 3.
  const attempts = 6
  const results = await Promise.all(
    Array.from({ length: attempts }, () =>
      api(`/api/installments/${instId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ fromAccountId: acc.id, date: '2026-02-01' }),
      }).then((r) => r.status)
    )
  )

  const ok = results.filter((s) => s === 200).length
  const conflict = results.filter((s) => s === 409).length

  // Verifikasi state akhir di DB.
  const final = await (await api('/api/installments')).json()
  const row = final.find((i) => i.id === instId)

  // Cleanup best-effort.
  await api(`/api/installments/${instId}`, { method: 'DELETE' })
  await api(`/api/accounts/${acc.id}`, { method: 'DELETE' })

  assert.equal(ok, 3, `harus tepat 3 pembayaran sukses, dapat ${ok} (409: ${conflict})`)
  assert.equal(row.paidCount, 3, `paidCount final harus 3, dapat ${row.paidCount}`)
})

test('confirm recurring paralel periode sama hanya boleh 1 kali', async (t) => {
  if (!dbAvailable) return t.skip('DB tidak tersedia')

  const rec = await (await api('/api/recurring', {
    method: 'POST',
    body: JSON.stringify({ name: 'TEST-RACE-REC', amount: 50000, dueDay: 10 }),
  })).json()

  const period = '2026-03'
  const attempts = 5
  const results = await Promise.all(
    Array.from({ length: attempts }, () =>
      api(`/api/recurring/${rec.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ period, dueDate: '2026-03-10' }),
      }).then((r) => r.status)
    )
  )

  const ok = results.filter((s) => s === 200).length

  // Cleanup: hapus transaksi yang tergenerate + recurring.
  const txs = await (await api('/api/transactions')).json()
  for (const tx of txs.filter((t) => t.recurringId === rec.id)) {
    await api(`/api/transactions/${tx.id}`, { method: 'DELETE' })
  }
  await api(`/api/recurring/${rec.id}`, { method: 'DELETE' })

  assert.equal(ok, 1, `konfirmasi periode ${period} hanya boleh sukses 1x, dapat ${ok}`)
})
