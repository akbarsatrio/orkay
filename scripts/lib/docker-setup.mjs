import { spawn, spawnSync } from 'node:child_process'
import { portsForInstance } from './config.mjs'

// Opsi B: MySQL otomatis via Docker. Tiap instance dapat satu container MySQL
// sendiri (data persisten di named volume), expose ke localhost di port slot.
//
// Nama resource per instance:
//   container : orkay-mysql-<instance>
//   volume    : orkay-data-<instance>
//
// Konsumen (server Orkay) tetap konek ke localhost:<mysqlPort> pakai kredensial
// instance biasa (config.db). Jadi dari sisi app tak ada beda dengan MySQL host.

const IMAGE = 'mysql:8.0'

function sh(args, opts = {}) {
  return spawnSync('docker', args, {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
    ...opts,
  })
}

export function containerName(cfg) {
  return `orkay-mysql-${cfg.name}`
}

export function volumeName(cfg) {
  return `orkay-data-${cfg.name}`
}

function containerState(name) {
  // Return 'running' | 'exited' | 'absent'
  const res = sh(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.State}}'])
  const out = (res.stdout || '').trim()
  if (!out) return 'absent'
  return out
}

// Buat/nyalakan container MySQL untuk instance. onLog(line) untuk streaming.
// Return { host, port } yang harus dipakai app untuk konek.
export async function ensureMysqlContainer(cfg, onLog = () => {}) {
  const ports = portsForInstance(cfg)
  const name = containerName(cfg)
  const vol = volumeName(cfg)
  const state = containerState(name)

  if (state === 'running') {
    onLog(`[docker] container "${name}" sudah berjalan.`)
    await waitForMysql(cfg, onLog)
    return { host: '127.0.0.1', port: ports.mysql }
  }

  if (state === 'exited') {
    onLog(`[docker] menjalankan ulang container "${name}"...`)
    const res = sh(['start', name])
    if (res.status !== 0) throw new Error(`docker start gagal: ${res.stderr || res.stdout}`)
    await waitForMysql(cfg, onLog)
    return { host: '127.0.0.1', port: ports.mysql }
  }

  // Absent -> buat baru.
  onLog(`[docker] membuat container MySQL "${name}" di port ${ports.mysql}...`)
  const args = [
    'run', '-d',
    '--name', name,
    '--restart', 'unless-stopped',
    '-p', `${ports.mysql}:3306`,
    '-v', `${vol}:/var/lib/mysql`,
    '-e', `MYSQL_ROOT_PASSWORD=${cfg.db.password}`,
    '-e', `MYSQL_DATABASE=${cfg.db.name}`,
    '-e', `MYSQL_USER=${cfg.db.user}`,
    '-e', `MYSQL_PASSWORD=${cfg.db.password}`,
    IMAGE,
  ]
  const res = sh(args)
  if (res.status !== 0) {
    // Kalau image belum ada, docker run otomatis pull; error lain -> lempar.
    throw new Error(`docker run gagal: ${res.stderr || res.stdout}`)
  }
  onLog(`[docker] container dibuat. Menunggu MySQL siap (bisa ~20-40 detik saat pertama)...`)
  await waitForMysql(cfg, onLog)
  return { host: '127.0.0.1', port: ports.mysql }
}

// Tunggu sampai MySQL di dalam container menerima koneksi.
async function waitForMysql(cfg, onLog) {
  const name = containerName(cfg)
  const maxTries = 60
  for (let i = 0; i < maxTries; i++) {
    const res = sh(['exec', name, 'mysqladmin', 'ping', '-h', '127.0.0.1', '--silent'])
    if (res.status === 0) {
      onLog('[docker] MySQL siap.')
      return true
    }
    await new Promise((r) => setTimeout(r, 2000))
    if (i % 5 === 0) onLog(`[docker] masih menunggu MySQL... (${i * 2}s)`)
  }
  throw new Error('Timeout menunggu MySQL di container siap.')
}

// Pull image lebih dulu dengan streaming progress (opsional; run juga auto-pull).
export function pullImage(onLog = () => {}) {
  return new Promise((resolve, reject) => {
    onLog(`[docker] menarik image ${IMAGE} (sekali saja)...`)
    const child = spawn('docker', ['pull', IMAGE], { shell: process.platform === 'win32' })
    child.stdout.on('data', (d) => onLog(d.toString().trimEnd()))
    child.stderr.on('data', (d) => onLog(d.toString().trimEnd()))
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('docker pull gagal'))))
  })
}

// Info status container untuk halaman kelola.
export function containerStatus(cfg) {
  return containerState(containerName(cfg))
}

export function stopContainer(cfg) {
  return sh(['stop', containerName(cfg)]).status === 0
}

// Hapus container MySQL instance. Kalau withVolume=true, hapus juga volume data
// (PERMANEN — semua data keuangan instance ini hilang). Idempotent.
export function removeContainer(cfg, { withVolume = false } = {}) {
  const name = containerName(cfg)
  const removed = { container: false, volume: false }
  // -f agar container yang sedang jalan ikut terhapus.
  if (sh(['rm', '-f', name]).status === 0) removed.container = true
  if (withVolume) {
    if (sh(['volume', 'rm', volumeName(cfg)]).status === 0) removed.volume = true
  }
  return removed
}
