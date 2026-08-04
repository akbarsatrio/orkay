import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT, SERVER_DIR, CLIENT_DIR } from './paths.mjs'
import { hasMysqlDriver } from './mysql-setup.mjs'

// Kumpulan pengecekan lingkungan untuk ditampilkan di wizard.

export function nodeVersion() {
  return process.version // mis. "v20.11.0"
}

export function nodeVersionOk() {
  const major = Number(process.version.replace(/^v/, '').split('.')[0])
  return major >= 18
}

export function depsInstalled() {
  return (
    existsSync(join(ROOT, 'node_modules')) &&
    existsSync(join(SERVER_DIR, 'node_modules')) &&
    existsSync(join(CLIENT_DIR, 'node_modules'))
  )
}

// Cek apakah sebuah perintah tersedia di PATH (lintas platform).
function commandExists(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which'
  const res = spawnSync(probe, [cmd], { stdio: 'ignore', shell: process.platform === 'win32' })
  return res.status === 0
}

export function dockerAvailable() {
  if (!commandExists('docker')) return false
  // Docker terpasang tapi daemon mungkin mati -> cek `docker info`.
  const res = spawnSync('docker', ['info'], { stdio: 'ignore', shell: process.platform === 'win32' })
  return res.status === 0
}

export function dockerInstalledButStopped() {
  return commandExists('docker') && !dockerAvailable()
}

// Ringkasan lengkap untuk endpoint /api/preflight.
export function preflight() {
  const docker = dockerAvailable()
  return {
    node: {
      version: nodeVersion(),
      ok: nodeVersionOk(),
    },
    deps: {
      installed: depsInstalled(),
    },
    mysqlDriver: {
      installed: hasMysqlDriver(), // mysql2 di server/node_modules
    },
    docker: {
      installed: commandExists('docker'),
      running: docker,
    },
  }
}
