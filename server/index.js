import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { query, queryOne, parseRecurring, initDb } from './db.js'
import { ensureSettings } from './seed.js'
import { wrap } from './routes/helpers.js'
import { config } from './config.js'
import { createToken, checkPin, requireAuth, loginRateLimit, resetRateLimit } from './auth.js'

import categories from './routes/categories.js'
import accounts from './routes/accounts.js'
import incomeSources from './routes/incomeSources.js'
import transactions from './routes/transactions.js'
import recurring from './routes/recurring.js'
import budgets from './routes/budgets.js'
import settings from './routes/settings.js'
import installments from './routes/installments.js'
import paylater from './routes/paylater.js'
import admin from './routes/admin.js'

const app = express()
app.set('trust proxy', 1) // di belakang Nginx/Cloudflare, biar req.ip benar

// CORS hanya diperlukan saat dev (client & server beda origin/port).
if (!config.isProd) {
  app.use(cors())
}

app.use(express.json({ limit: '5mb' }))

// ---- Auth ----
app.post('/api/login', loginRateLimit, (req, res) => {
  const { pin } = req.body || {}
  if (!checkPin(pin)) {
    return res.status(401).json({ error: 'PIN salah' })
  }
  resetRateLimit(req)
  res.json({ token: createToken() })
})

app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }))
app.get('/api/health', (req, res) => res.json({ ok: true }))

// ---- Semua route data di bawah ini WAJIB auth ----
app.use('/api', requireAuth)

app.get('/api/bootstrap', wrap(async (req, res) => {
  const [categoriesRows, accountsRows, incomeRows, txRows, recRows, budgetRows, instRows, settingsRow] = await Promise.all([
    query('SELECT * FROM categories'),
    query('SELECT * FROM accounts'),
    query('SELECT * FROM income_sources'),
    query('SELECT * FROM transactions ORDER BY date DESC'),
    query('SELECT * FROM recurring'),
    query('SELECT * FROM budgets'),
    query('SELECT * FROM installments'),
    queryOne('SELECT payDay, theme, currency FROM settings WHERE id = 1'),
  ])
  res.json({
    categories: categoriesRows,
    accounts: accountsRows,
    incomeSources: incomeRows,
    transactions: txRows,
    recurring: recRows.map(parseRecurring),
    budgets: budgetRows,
    installments: instRows.map((i) => ({ ...i, active: !!i.active })),
    settings: settingsRow || { payDay: 28, theme: 'light', currency: 'IDR' },
  })
}))

app.use('/api/categories', categories)
app.use('/api/accounts', accounts)
app.use('/api/income-sources', incomeSources)
app.use('/api/transactions', transactions)
app.use('/api/recurring', recurring)
app.use('/api/budgets', budgets)
app.use('/api/settings', settings)
app.use('/api/installments', installments)
app.use('/api/paylater', paylater)
app.use('/api/admin', admin)

// ---- Serve React build di production (SPA fallback) ----
if (config.isProd) {
  if (existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist))
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(join(config.clientDist, 'index.html'))
    })
  } else {
    console.warn(`[server] CLIENT_DIST tidak ditemukan di ${config.clientDist}. Jalankan "npm run build" dulu.`)
  }
}

// Error handler
app.use((err, req, res, next) => {
  console.error('[error]', err)
  res.status(500).json({ error: err.message || 'internal error' })
})

// ---- Startup ----
async function main() {
  try {
    await initDb()
    await ensureSettings()
    console.log('[db] schema siap.')
  } catch (err) {
    console.error('[db] gagal inisialisasi database:', err.message)
    console.error('     Pastikan MySQL berjalan & kredensial di .env benar.')
    process.exit(1)
  }

  app.listen(config.port, () => {
    console.log(`[server] Orkay berjalan di http://localhost:${config.port} (${config.nodeEnv})`)
    if (config.pin === '123456') {
      console.warn('[server] ⚠  APP_PIN masih default (123456). Ganti di server/.env sebelum deploy!')
    }
  })
}

main()
