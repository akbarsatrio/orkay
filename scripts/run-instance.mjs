// Runner instance Orkay untuk development.
//
// Membaca config instance, meng-inject environment per komponen, lalu
// menjalankan service dengan concurrently:
//   - mode web : server + client
//   - mode full: server + client + brain (brain spawn mcp sendiri via stdio)
//
// Env di-inject saat spawn (bukan nulis .env), jadi beberapa instance dari
// satu checkout kode bisa jalan berdampingan tanpa saling menimpa .env.
//
// Pemakaian:
//   node scripts/run-instance.mjs                       (instance "default")
//   node scripts/run-instance.mjs --instance=budi
//   npm run dev -- --instance=budi

import { spawn, spawnSync } from 'node:child_process'
import { ROOT, SERVER_DIR, CLIENT_DIR, BRAIN_DIR } from './lib/paths.mjs'
import { loadInstance, instanceExists, portsForInstance } from './lib/config.mjs'
import { serverEnv, clientEnv, brainEnv } from './lib/env.mjs'
import { parseArgs } from './lib/prompt.mjs'

const args = parseArgs(process.argv.slice(2))
const name = args.instance || args._[0] || 'default'
const isWin = process.platform === 'win32'

function log(msg) {
  process.stdout.write(msg + '\n')
}

// Auto-bootstrap kalau instance belum ada.
if (!instanceExists(name)) {
  log(`[run] Instance "${name}" belum ada — menjalankan bootstrap dulu...\n`)
  const bootstrapArgs = ['scripts/bootstrap.mjs', name]
  if (args.mode) bootstrapArgs.push(`--mode=${args.mode}`)
  const res = spawnSync('node', bootstrapArgs, { cwd: ROOT, stdio: 'inherit' })
  if (res.status !== 0) {
    console.error('[run] bootstrap gagal. Batal menjalankan instance.')
    process.exit(1)
  }
}

const cfg = loadInstance(name)
const ports = portsForInstance(cfg)

log(`\n=== Menjalankan Orkay: instance "${cfg.name}" (mode ${cfg.mode}) ===`)
log(`  server : http://localhost:${ports.server}`)
log(`  web    : http://localhost:${ports.vite}`)
if (cfg.mode === 'full') log(`  brain  : http://localhost:${ports.brain}`)
log('')

// Bangun daftar proses yang mau dijalankan.
const procs = [
  {
    label: 'server',
    color: 'blue',
    cwd: SERVER_DIR,
    cmd: 'node',
    cmdArgs: ['--watch', 'index.js'],
    env: serverEnv(cfg, { prod: false }),
  },
  {
    label: 'client',
    color: 'green',
    cwd: CLIENT_DIR,
    cmd: 'npm',
    cmdArgs: ['run', 'dev'],
    env: clientEnv(cfg),
  },
]

if (cfg.mode === 'full') {
  procs.push({
    label: 'brain',
    color: 'magenta',
    cwd: BRAIN_DIR,
    cmd: 'node',
    cmdArgs: ['--watch', 'src/index.js'],
    env: brainEnv(cfg),
  })
}

// Spawn manual (tidak lewat `concurrently`) supaya bisa inject env berbeda
// per proses. Prefix log sederhana + propagasi exit.
const children = []
let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) {
    if (!c.killed) {
      try {
        c.kill('SIGTERM')
      } catch {}
    }
  }
  setTimeout(() => process.exit(code), 300)
}

for (const p of procs) {
  const child = spawn(p.cmd, p.cmdArgs, {
    cwd: p.cwd,
    env: { ...process.env, ...p.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
  })
  children.push(child)

  const prefix = `[${p.label}]`
  const pipe = (stream, out) => {
    let buf = ''
    stream.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) out.write(`${prefix} ${line}\n`)
    })
    stream.on('end', () => {
      if (buf) out.write(`${prefix} ${buf}\n`)
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      log(`\n[run] proses "${p.label}" berhenti (code=${code} signal=${signal}). Mematikan yang lain...`)
      shutdown(code || 0)
    }
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
