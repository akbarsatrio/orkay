import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'
import { config as loadEnv } from 'dotenv'

loadEnv()

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolvePath(p, fallback) {
  const val = p || fallback
  return isAbsolute(val) ? val : join(__dirname, val)
}

// Nilai default yang TIDAK boleh dipakai di production.
const DEFAULT_PIN = '123456'
const DEFAULT_AUTH_SECRET = 'ubah-rahasia-ini-di-production'
// TTL token default 30 hari. 0 = tanpa expiry (token abadi, sengaja).
const DEFAULT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  // PIN untuk masuk aplikasi. WAJIB diganti di production via .env
  pin: process.env.APP_PIN || DEFAULT_PIN,
  // true jika PIN masih memakai nilai default (dipakai index.js untuk refuse-to-start)
  pinIsDefault: (process.env.APP_PIN || DEFAULT_PIN) === DEFAULT_PIN,

  // Rahasia untuk menandatangani token sesi. Ganti di production.
  authSecret: process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET,
  // true jika AUTH_SECRET masih memakai nilai default (dipakai index.js untuk refuse-to-start)
  authSecretIsDefault: (process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET) === DEFAULT_AUTH_SECRET,

  // Umur token sesi dalam ms. 0 = tanpa expiry (token abadi). Default 30 hari.
  // Diisi via AUTH_TOKEN_TTL_MS. Nilai < 0 dianggap default.
  tokenTtlMs: (() => {
    const raw = process.env.AUTH_TOKEN_TTL_MS
    if (raw === undefined || raw === '') return DEFAULT_TOKEN_TTL_MS
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TOKEN_TTL_MS
  })(),

  // ---- MySQL ----
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'economic_analytic',
  },

  // Folder hasil build React yang akan diserve saat production
  clientDist: resolvePath(process.env.CLIENT_DIST, '../client/dist'),
}

export default config
