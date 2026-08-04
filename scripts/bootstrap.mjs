// Bootstrap installer Orkay.
//
// Menyiapkan sebuah "instance" siap jalan:
//   1. tanya/isi konfigurasi (nama, mode web/full, PIN, kredensial DB)
//   2. install dependency kalau belum ada
//   3. bikin database + user MySQL (butuh kredensial admin MySQL sekali)
//   4. simpan config ke instances/<nama>.json
//
// Pemakaian:
//   node scripts/bootstrap.mjs                       (interaktif, instance "default")
//   node scripts/bootstrap.mjs myinstance            (interaktif, nama myinstance)
//   node scripts/bootstrap.mjs budi --mode=full --pin=246810 --yes
//   node scripts/bootstrap.mjs --db-admin-user=root --db-admin-pass=root123!

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { ROOT, SERVER_DIR, CLIENT_DIR, MCP_DIR, BRAIN_DIR } from './lib/paths.mjs'
import {
  buildInstanceConfig,
  saveInstance,
  loadInstance,
  instanceExists,
  portsForInstance,
} from './lib/config.mjs'
import { setupDatabase, verifyInstanceDb, hasMysqlDriver } from './lib/mysql-setup.mjs'
import { ask, askSecret, confirm, choose, parseArgs, closePrompt } from './lib/prompt.mjs'

const args = parseArgs(process.argv.slice(2))
const AUTO = !!args.yes || !!args.y // non-interaktif kalau --yes

function log(msg) {
  process.stdout.write(msg + '\n')
}

function depsInstalled() {
  return (
    existsSync(join(ROOT, 'node_modules')) &&
    existsSync(join(SERVER_DIR, 'node_modules')) &&
    existsSync(join(CLIENT_DIR, 'node_modules'))
  )
}

function runInstall(dir, label) {
  log(`\n[install] ${label} (${dir}) ...`)
  const res = spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' })
  if (res.status !== 0) throw new Error(`npm install gagal di ${label}`)
}

async function main() {
  log('=== Orkay Bootstrap Installer ===\n')

  const name = args._[0] || (AUTO ? 'default' : await ask('Nama instance', 'default'))

  if (instanceExists(name)) {
    const cfg = loadInstance(name)
    const reuse = AUTO ? true : await confirm(`Instance "${name}" sudah ada. Pakai config yang ada?`, true)
    if (reuse) {
      await ensureDepsAndDb(cfg)
      finish(cfg)
      return
    }
  }

  // ---- Mode ----
  let mode = args.mode
  if (!mode) {
    if (AUTO) {
      mode = 'web'
    } else {
      const idx = await choose('Mode instance:', [
        'Web app saja (server + client)',
        'Full (server + client + AI/WhatsApp: MCP + Brain)',
      ], 0)
      mode = idx === 0 ? 'web' : 'full'
    }
  }

  // ---- PIN ----
  let pin = args.pin
  if (!pin && !AUTO) {
    pin = await ask('PIN aplikasi (kosong = generate acak 6 digit)', '')
  }

  // ---- DB config ----
  const dbHost = args['db-host'] || (AUTO ? 'localhost' : await ask('DB host', 'localhost'))
  const dbPort = args['db-port'] || (AUTO ? '3306' : await ask('DB port', '3306'))
  const dbName = args['db-name'] || (AUTO ? `orkay_${name}` : await ask('Nama database', `orkay_${name}`))
  const dbUser = args['db-user'] || (AUTO ? `orkay_${name}` : await ask('DB user (khusus instance ini)', `orkay_${name}`))
  const dbPassword = args['db-pass'] || '' // kosong = auto-generate di buildInstanceConfig

  // ---- AI config (hanya kalau full) ----
  const overrides = {
    slot: args.slot,
    mode,
    pin,
    dbHost,
    dbPort,
    dbName,
    dbUser,
  }
  if (dbPassword) overrides.dbPassword = dbPassword

  if (mode === 'full') {
    if (AUTO) {
      overrides.llmApiKey = args['llm-key'] || ''
      overrides.llmBaseUrl = args['llm-url'] || undefined
      overrides.llmModel = args['llm-model'] || undefined
      overrides.waAllowedNumbers = args['wa-numbers'] || ''
    } else {
      log('\n--- Konfigurasi AI (bisa dikosongkan, isi nanti di instances/' + name + '.json) ---')
      overrides.llmBaseUrl = await ask('LLM base URL', 'https://api.openai.com/v1')
      overrides.llmApiKey = await askSecret('LLM API key (kosong = isi nanti)', '')
      overrides.llmModel = await ask('LLM model', 'cc/claude-opus-4-8')
      overrides.waAllowedNumbers = await ask('Nomor WA yang diizinkan (comma, kosong = semua)', '')
    }
  }

  const cfg = buildInstanceConfig(name, overrides)
  const ports = portsForInstance(cfg)

  log('\n--- Ringkasan Instance ---')
  log(`  nama    : ${cfg.name}`)
  log(`  slot    : ${cfg.slot}`)
  log(`  mode    : ${cfg.mode}`)
  log(`  PIN     : ${cfg.pin}`)
  log(`  port    : server=${ports.server}  vite=${ports.vite}  brain=${ports.brain}`)
  log(`  DB      : ${cfg.db.user}@${cfg.db.host}:${cfg.db.port}/${cfg.db.name}`)
  log('')

  saveInstance(cfg)
  log(`[config] disimpan ke instances/${cfg.name}.json`)

  await ensureDepsAndDb(cfg)
  finish(cfg)
}

async function ensureDepsAndDb(cfg) {
  // ---- Dependency ----
  if (!depsInstalled()) {
    const doInstall = AUTO ? true : await confirm('\nDependency belum lengkap. Install sekarang?', true)
    if (doInstall) {
      runInstall(ROOT, 'root')
      runInstall(SERVER_DIR, 'server')
      runInstall(CLIENT_DIR, 'client')
    }
  }
  if (cfg.mode === 'full') {
    if (!existsSync(join(MCP_DIR, 'node_modules'))) runInstall(MCP_DIR, 'mcp')
    if (!existsSync(join(BRAIN_DIR, 'node_modules'))) runInstall(BRAIN_DIR, 'brain')
  }

  // ---- Database ----
  if (!hasMysqlDriver()) {
    log('\n[db] driver mysql2 belum ada — lewati setup DB otomatis.')
    log('     Install dependency dulu lalu jalankan ulang bootstrap.')
    return
  }

  const alreadyOk = await verifyInstanceDb(cfg)
  if (alreadyOk) {
    log('[db] koneksi instance sudah valid — skip setup.')
    return
  }

  const doDb = AUTO ? true : await confirm('\nSetup database + user MySQL sekarang? (butuh akses admin MySQL)', true)
  if (!doDb) {
    log('[db] dilewati. Kamu harus bikin DB & user manual sebelum menjalankan instance.')
    return
  }

  const adminUser = args['db-admin-user'] || (AUTO ? 'root' : await ask('MySQL admin user', 'root'))
  const adminPass =
    args['db-admin-pass'] != null
      ? args['db-admin-pass']
      : AUTO
        ? ''
        : await askSecret('MySQL admin password (tidak disimpan)', '')

  try {
    const res = await setupDatabase(cfg, {
      host: cfg.db.host,
      port: cfg.db.port,
      user: adminUser,
      password: adminPass,
    })
    log(`[db] OK: database "${res.database}" & user "${res.user}" siap.`)
    const ok = await verifyInstanceDb(cfg)
    log(ok ? '[db] verifikasi koneksi instance: OK' : '[db] ⚠ verifikasi koneksi gagal, cek kredensial.')
  } catch (err) {
    log(`[db] ⚠ gagal setup: ${err.message}`)
    log('     Kamu bisa bikin DB manual, lalu jalankan ulang bootstrap.')
  }
}

function finish(cfg) {
  closePrompt()
  log('\n=== Selesai ===')
  log(`Jalankan instance ini dengan:`)
  log(`  npm run dev -- --instance=${cfg.name}`)
  if (cfg.name === 'default') log(`  (atau cukup "npm run dev")`)
  log('')
}

main().catch((err) => {
  closePrompt()
  console.error('\n[bootstrap] error:', err.message)
  process.exit(1)
})
