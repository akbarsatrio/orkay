import { portsForInstance } from './config.mjs'

// Bangun set environment variable untuk tiap komponen dari config instance.
// Dipakai dua cara:
//   1. runner (dev)   -> di-inject ke process saat spawn (tanpa nulis .env)
//   2. deploy config  -> ditulis jadi file .env per komponen

export function serverEnv(cfg, { prod = false } = {}) {
  const ports = portsForInstance(cfg)
  return {
    PORT: String(ports.server),
    NODE_ENV: prod ? 'production' : 'development',
    APP_PIN: cfg.pin,
    AUTH_SECRET: cfg.authSecret,
    DB_HOST: cfg.db.host,
    DB_PORT: String(cfg.db.port),
    DB_USER: cfg.db.user,
    DB_PASSWORD: cfg.db.password,
    DB_NAME: cfg.db.name,
    CLIENT_DIST: '../client/dist',
  }
}

// Vite dev server: port + target proxy /api ke server instance ini.
export function clientEnv(cfg) {
  const ports = portsForInstance(cfg)
  return {
    ORKAY_VITE_PORT: String(ports.vite),
    ORKAY_API_TARGET: `http://localhost:${ports.server}`,
  }
}

export function mcpEnv(cfg) {
  const ports = portsForInstance(cfg)
  return {
    ORKAY_API_URL: `http://localhost:${ports.server}`,
    ORKAY_PIN: cfg.pin,
  }
}

export function brainEnv(cfg) {
  const ports = portsForInstance(cfg)
  return {
    PORT: String(ports.brain),
    WA_WEBHOOK_SECRET: cfg.ai.waWebhookSecret || '',
    WA_ALLOWED_NUMBERS: cfg.ai.waAllowedNumbers || '',
    OPENWA_API_URL: cfg.ai.openwaApiUrl || 'http://localhost:2785',
    OPENWA_API_KEY: cfg.ai.openwaApiKey || '',
    OPENWA_SESSION_ID: cfg.ai.openwaSessionId || '',
    LLM_BASE_URL: cfg.ai.llmBaseUrl || 'https://api.openai.com/v1',
    LLM_API_KEY: cfg.ai.llmApiKey || '',
    LLM_MODEL: cfg.ai.llmModel || 'cc/claude-opus-4-8',
    MCP_ENTRY: '../mcp/src/index.js',
    ORKAY_API_URL: `http://localhost:${ports.server}`,
    ORKAY_PIN: cfg.pin,
  }
}

// Serialize objek env jadi isi file .env (KEY=value per baris).
export function toEnvFile(obj) {
  return (
    Object.entries(obj)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n'
  )
}
