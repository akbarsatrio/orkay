import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { INSTANCES_DIR, instanceFile } from './paths.mjs'
import { portsForSlot, firstFreeSlot } from './ports.mjs'

export function randomHex(bytes = 32) {
  return randomBytes(bytes).toString('hex')
}

// Daftar nama instance yang tersimpan (file .json kecuali example).
export function listInstanceNames() {
  if (!existsSync(INSTANCES_DIR)) return []
  return readdirSync(INSTANCES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'example.json')
    .map((f) => f.replace(/\.json$/, ''))
}

export function listInstances() {
  return listInstanceNames()
    .map((name) => {
      try {
        return loadInstance(name)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export function instanceExists(name) {
  return existsSync(instanceFile(name))
}

export function loadInstance(name) {
  const file = instanceFile(name)
  if (!existsSync(file)) {
    throw new Error(`Instance "${name}" tidak ditemukan (${file}). Buat dulu: npm run instance:new`)
  }
  const cfg = JSON.parse(readFileSync(file, 'utf-8'))
  cfg.name = cfg.name || name
  return cfg
}

export function saveInstance(cfg) {
  if (!existsSync(INSTANCES_DIR)) mkdirSync(INSTANCES_DIR, { recursive: true })
  writeFileSync(instanceFile(cfg.name), JSON.stringify(cfg, null, 2) + '\n', 'utf-8')
}

// Hapus file config instance. Idempotent (aman kalau sudah tidak ada).
export function deleteInstance(name) {
  const file = instanceFile(name)
  if (existsSync(file)) {
    rmSync(file, { force: true })
    return true
  }
  return false
}

// Bentuk config instance baru dengan default aman. `overrides` bisa mengisi field.
export function buildInstanceConfig(name, overrides = {}) {
  const existing = listInstances()
  const usedSlots = existing.map((i) => i.slot)
  const slot = overrides.slot != null ? Number(overrides.slot) : firstFreeSlot(usedSlots)

  // Provider DB: 'host' (MySQL biasa/opsi A) atau 'docker' (opsi B).
  const dbProvider = overrides.dbProvider || 'host'
  // Untuk docker, host/port ditentukan oleh container (localhost:<mysqlPort slot>).
  const dockerPorts = portsForSlot(slot)
  const dbHost = dbProvider === 'docker' ? '127.0.0.1' : overrides.dbHost || 'localhost'
  const dbPort = dbProvider === 'docker' ? dockerPorts.mysql : Number(overrides.dbPort) || 3306

  return {
    name,
    slot,
    mode: overrides.mode || 'web', // 'web' | 'full'
    dbProvider, // 'host' | 'docker'
    pin: overrides.pin || String(Math.floor(100000 + Math.random() * 900000)),
    authSecret: overrides.authSecret || randomHex(32),
    db: {
      host: dbHost,
      port: dbPort,
      name: overrides.dbName || `orkay_${name}`,
      user: overrides.dbUser || `orkay_${name}`,
      password: overrides.dbPassword || randomHex(12),
    },
    ai: {
      waWebhookSecret: overrides.waWebhookSecret || randomHex(24),
      waAllowedNumbers: overrides.waAllowedNumbers || '',
      openwaApiUrl: overrides.openwaApiUrl || 'http://localhost:2785',
      openwaApiKey: overrides.openwaApiKey || '',
      openwaSessionId: overrides.openwaSessionId || '',
      llmBaseUrl: overrides.llmBaseUrl || 'https://api.openai.com/v1',
      llmApiKey: overrides.llmApiKey || '',
      llmModel: overrides.llmModel || 'cc/claude-opus-4-8',
    },
  }
}

export function portsForInstance(cfg) {
  return portsForSlot(cfg.slot)
}
