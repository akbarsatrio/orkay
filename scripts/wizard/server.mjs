// Server wizard installer Orkay (GUI berbasis browser).
//
// HTTP server minimal TANPA dependency (pakai modul bawaan Node) supaya bisa
// jalan bahkan sebelum `npm install`. Menyajikan halaman wizard + endpoint JSON
// yang memakai ulang "mesin" di scripts/lib/*.
//
// Jalankan: node scripts/wizard/server.mjs
// Lalu buka http://localhost:7777 (otomatis dibuka oleh launcher).

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ROOT, SERVER_DIR, CLIENT_DIR, MCP_DIR, BRAIN_DIR, DEPLOY_OUT_DIR } from '../lib/paths.mjs'
import {
  buildInstanceConfig,
  saveInstance,
  loadInstance,
  listInstances,
  instanceExists,
  portsForInstance,
  deleteInstance,
  randomHex,
} from '../lib/config.mjs'
import { firstFreeSlot } from '../lib/ports.mjs'
import { serverEnv, brainEnv, mcpEnv, toEnvFile } from '../lib/env.mjs'
import { preflight, dockerAvailable } from '../lib/preflight.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, 'public')
const PORT = Number(process.env.ORKAY_WIZARD_PORT) || 7777
const isWin = process.platform === 'win32'

// Lazy import mysql-setup & docker-setup: keduanya butuh mysql2 (dari
// server/node_modules). Kalau belum terpasang, fungsi tetap ada tapi akan
// memberi pesan yang jelas.
async function loadMysql() {
  return import('../lib/mysql-setup.mjs')
}
async function loadDocker() {
  return import('../lib/docker-setup.mjs')
}

// Registry proses instance yang sedang berjalan (dijalankan dari wizard).
const running = new Map() // name -> child process

// ---------- util ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
  })
}

async function serveStatic(res, urlPath) {
  let file = urlPath === '/' ? '/index.html' : urlPath
  const full = join(PUBLIC_DIR, file)
  if (!full.startsWith(PUBLIC_DIR) || !existsSync(full)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  const buf = await readFile(full)
  res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' })
  res.end(buf)
}

// SSE helper untuk streaming progress instalasi.
function sseStart(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  return {
    log: (msg) => res.write(`event: log\ndata: ${JSON.stringify(String(msg))}\n\n`),
    done: (obj) => {
      res.write(`event: done\ndata: ${JSON.stringify(obj)}\n\n`)
      res.end()
    },
    error: (msg) => {
      res.write(`event: error\ndata: ${JSON.stringify(String(msg))}\n\n`)
      res.end()
    },
  }
}

// Jalankan npm install di sebuah folder dengan streaming ke SSE.
function npmInstall(dir, onLog) {
  return new Promise((resolve, reject) => {
    onLog(`$ npm install (${dir})`)
    const child = spawn('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: dir,
      shell: isWin,
    })
    child.stdout.on('data', (d) => onLog(d.toString().trimEnd()))
    child.stderr.on('data', (d) => onLog(d.toString().trimEnd()))
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`npm install gagal di ${dir}`))
    )
  })
}

function depsInstalled() {
  return (
    existsSync(join(ROOT, 'node_modules')) &&
    existsSync(join(SERVER_DIR, 'node_modules')) &&
    existsSync(join(CLIENT_DIR, 'node_modules'))
  )
}

// ---------- handlers ----------

async function handleSuggest(res) {
  const existing = listInstances()
  const usedSlots = existing.map((i) => i.slot)
  const slot = firstFreeSlot(usedSlots)
  const suggestedName = existing.length === 0 ? 'default' : `instance${slot}`
  sendJson(res, 200, {
    name: suggestedName,
    slot,
    pin: String(Math.floor(100000 + Math.random() * 900000)),
    dockerAvailable: dockerAvailable(),
  })
}

async function handleTestMysql(res, body) {
  if (!depsInstalled()) {
    return sendJson(res, 200, {
      ok: false,
      needInstall: true,
      message: 'Dependency belum terpasang. Klik "Pasang & Jalankan" — koneksi akan dites saat instalasi.',
    })
  }
  const { hasMysqlDriver } = await loadMysql()
  if (!hasMysqlDriver()) {
    return sendJson(res, 200, { ok: false, needInstall: true, message: 'Driver MySQL belum siap.' })
  }
  try {
    const { createRequire } = await import('node:module')
    const require = createRequire(SERVER_DIR + '/package.json')
    const mysql = require('mysql2/promise')
    const conn = await mysql.createConnection({
      host: body.host || 'localhost',
      port: Number(body.port) || 3306,
      user: body.user || 'root',
      password: body.password || '',
      connectTimeout: 5000,
    })
    await conn.query('SELECT 1')
    await conn.end()
    sendJson(res, 200, { ok: true, message: 'Koneksi MySQL berhasil.' })
  } catch (err) {
    sendJson(res, 200, { ok: false, message: `Gagal konek: ${err.message}` })
  }
}

async function handleInstances(res) {
  const list = listInstances().map((cfg) => {
    const ports = portsForInstance(cfg)
    return {
      name: cfg.name,
      slot: cfg.slot,
      mode: cfg.mode,
      dbProvider: cfg.dbProvider || 'host',
      pin: cfg.pin,
      ports,
      running: running.has(cfg.name),
      url: `http://localhost:${ports.vite}`,
    }
  })
  sendJson(res, 200, { instances: list })
}

// POST /api/install (SSE): install dep -> setup DB (host/docker) -> simpan config
async function handleInstall(req, res, body) {
  const sse = sseStart(res)
  try {
    const name = (body.name || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '')
    if (!name) throw new Error('Nama instance tidak valid.')

    const dbProvider = body.dbProvider === 'docker' ? 'docker' : 'host'

    sse.log(`=== Memasang instance "${name}" (mode ${body.mode}, DB ${dbProvider}) ===`)

    // 1. Bangun / muat config
    let cfg
    if (instanceExists(name)) {
      cfg = loadInstance(name)
      sse.log(`Config instance sudah ada, dipakai ulang.`)
    } else {
      cfg = buildInstanceConfig(name, {
        mode: body.mode === 'full' ? 'full' : 'web',
        dbProvider,
        pin: body.pin || undefined,
        dbHost: body.dbHost || undefined,
        dbPort: body.dbPort || undefined,
        llmApiKey: body.llmApiKey || undefined,
        llmBaseUrl: body.llmBaseUrl || undefined,
        llmModel: body.llmModel || undefined,
        waAllowedNumbers: body.waAllowedNumbers || undefined,
      })
      saveInstance(cfg)
      sse.log(`Config disimpan ke instances/${name}.json`)
    }

    // 2. Install dependency
    if (!depsInstalled()) {
      sse.log('\n--- Memasang dependency (bisa 1-3 menit) ---')
      await npmInstall(ROOT, sse.log)
      await npmInstall(SERVER_DIR, sse.log)
      await npmInstall(CLIENT_DIR, sse.log)
    } else {
      sse.log('Dependency inti sudah terpasang.')
    }
    if (cfg.mode === 'full') {
      if (!existsSync(join(MCP_DIR, 'node_modules'))) await npmInstall(MCP_DIR, sse.log)
      if (!existsSync(join(BRAIN_DIR, 'node_modules'))) await npmInstall(BRAIN_DIR, sse.log)
    }

    // 3. Setup database
    sse.log('\n--- Menyiapkan database ---')
    if (dbProvider === 'docker') {
      const { ensureMysqlContainer } = await loadDocker()
      await ensureMysqlContainer(cfg, sse.log)
      // Server Orkay tetap perlu bikin schema; koneksi via localhost:mysqlPort.
      const { setupDatabase } = await loadMysql()
      // Untuk docker, root == kredensial instance (MYSQL_ROOT_PASSWORD).
      await setupDatabase(cfg, {
        host: cfg.db.host,
        port: cfg.db.port,
        user: 'root',
        password: cfg.db.password,
      }).catch((e) => sse.log(`[db] catatan: ${e.message} (biasanya aman, user/db sudah dibuat container)`))
    } else {
      // Opsi A: MySQL host. Butuh kredensial admin dari form.
      const { setupDatabase, verifyInstanceDb } = await loadMysql()
      const already = await verifyInstanceDb(cfg)
      if (already) {
        sse.log('[db] koneksi instance sudah valid — skip.')
      } else {
        sse.log('[db] membuat database & user...')
        await setupDatabase(cfg, {
          host: cfg.db.host,
          port: cfg.db.port,
          user: body.dbAdminUser || 'root',
          password: body.dbAdminPass != null ? body.dbAdminPass : '',
        })
        const ok = await verifyInstanceDb(cfg)
        sse.log(ok ? '[db] OK.' : '[db] ⚠ verifikasi gagal, cek kredensial.')
      }
    }

    const ports = portsForInstance(cfg)
    sse.log('\n=== Selesai! ===')
    sse.done({
      ok: true,
      name: cfg.name,
      pin: cfg.pin,
      mode: cfg.mode,
      ports,
      url: `http://localhost:${ports.vite}`,
    })
  } catch (err) {
    sse.error(err.message)
  }
}

// POST /api/start { name }
async function handleStart(res, body) {
  const name = body.name
  if (!name || !instanceExists(name)) return sendJson(res, 404, { error: 'Instance tidak ditemukan.' })
  if (running.has(name)) {
    const cfg = loadInstance(name)
    const ports = portsForInstance(cfg)
    return sendJson(res, 200, { ok: true, already: true, url: `http://localhost:${ports.vite}` })
  }
  const child = spawn('node', ['scripts/run-instance.mjs', `--instance=${name}`], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: false,
  })
  running.set(name, child)
  child.on('exit', () => running.delete(name))

  const cfg = loadInstance(name)
  const ports = portsForInstance(cfg)
  // Beri jeda kecil supaya vite mulai listen.
  setTimeout(() => sendJson(res, 200, { ok: true, url: `http://localhost:${ports.vite}` }), 1500)
}

// POST /api/stop { name }
async function handleStop(res, body) {
  const name = body.name
  const child = running.get(name)
  if (child) {
    try {
      child.kill('SIGTERM')
    } catch {}
    running.delete(name)
  }
  sendJson(res, 200, { ok: true })
}

// POST /api/export { name, domain } -> generate deploy config
async function handleExport(res, body) {
  const name = body.name
  if (!name || !instanceExists(name)) return sendJson(res, 404, { error: 'Instance tidak ditemukan.' })
  const args = [name]
  if (body.domain) args.push(`--domain=${body.domain}`)
  const r = spawnSync('node', ['scripts/deploy-config.mjs', ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: isWin,
  })
  if (r.status !== 0) return sendJson(res, 500, { error: r.stderr || 'gagal generate' })
  sendJson(res, 200, { ok: true, dir: join(DEPLOY_OUT_DIR, name), output: r.stdout })
}

// POST /api/delete { name, dropData, dbAdminUser, dbAdminPass }
// Default (dropData=false): stop proses + hapus file config saja (data DB aman).
// dropData=true: juga hapus database. docker -> hapus container+volume;
//                host -> DROP DATABASE (butuh kredensial admin MySQL).
async function handleDelete(res, body) {
  const name = body.name
  if (!name || !instanceExists(name)) {
    return sendJson(res, 404, { error: 'Instance tidak ditemukan.' })
  }
  const cfg = loadInstance(name)
  const dropData = body.dropData === true || body.dropData === 'true'
  const result = { name, stopped: false, configRemoved: false, data: null }

  // 1. Stop proses yang sedang berjalan (kalau ada).
  const child = running.get(name)
  if (child) {
    try {
      child.kill('SIGTERM')
    } catch {}
    running.delete(name)
    result.stopped = true
  }

  // 2. Hapus data DB (opsional, permanen).
  if (dropData) {
    try {
      if ((cfg.dbProvider || 'host') === 'docker') {
        const { removeContainer } = await loadDocker()
        result.data = { type: 'docker', ...removeContainer(cfg, { withVolume: true }) }
      } else {
        const { dropDatabase } = await loadMysql()
        const dropped = await dropDatabase(cfg, {
          host: cfg.db.host,
          port: cfg.db.port,
          user: body.dbAdminUser || 'root',
          password: body.dbAdminPass != null ? body.dbAdminPass : '',
        })
        result.data = { type: 'host', ...dropped }
      }
    } catch (err) {
      // Data gagal dihapus: JANGAN hapus config supaya user bisa coba lagi.
      return sendJson(res, 200, {
        ok: false,
        message: `Config tidak dihapus karena gagal menghapus data: ${err.message}`,
      })
    }
  }

  // 3. Hapus file config.
  result.configRemoved = deleteInstance(name)

  sendJson(res, 200, { ok: true, ...result })
}

// ---------- router ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  try {
    if (req.method === 'GET' && path === '/api/preflight') {
      return sendJson(res, 200, preflight())
    }
    if (req.method === 'GET' && path === '/api/suggest') {
      return handleSuggest(res)
    }
    if (req.method === 'GET' && path === '/api/instances') {
      return handleInstances(res)
    }
    if (req.method === 'POST' && path === '/api/test-mysql') {
      return handleTestMysql(res, await readBody(req))
    }
    if (req.method === 'POST' && path === '/api/install') {
      return handleInstall(req, res, await readBody(req))
    }
    if (req.method === 'POST' && path === '/api/start') {
      return handleStart(res, await readBody(req))
    }
    if (req.method === 'POST' && path === '/api/stop') {
      return handleStop(res, await readBody(req))
    }
    if (req.method === 'POST' && path === '/api/export') {
      return handleExport(res, await readBody(req))
    }
    if (req.method === 'POST' && path === '/api/delete') {
      return handleDelete(res, await readBody(req))
    }
    if (req.method === 'GET') {
      return serveStatic(res, path)
    }
    res.writeHead(405)
    res.end('Method not allowed')
  } catch (err) {
    sendJson(res, 500, { error: err.message })
  }
})

server.listen(PORT, () => {
  const uiUrl = `http://localhost:${PORT}`
  process.stdout.write(`\n  Orkay Installer siap di: ${uiUrl}\n`)
  process.stdout.write('  (Jendela browser akan terbuka otomatis. Kalau tidak, buka URL di atas.)\n\n')
  openBrowser(uiUrl)
})

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  try {
    spawn(cmd, [url], { shell: true, stdio: 'ignore', detached: true }).unref()
  } catch {}
}
