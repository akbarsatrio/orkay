import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'
import { config as loadEnv } from 'dotenv'

loadEnv()

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolvePath(p, fallback) {
  const val = p || fallback
  return isAbsolute(val) ? val : join(__dirname, val)
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  // PIN untuk masuk aplikasi. WAJIB diganti di production via .env
  pin: process.env.APP_PIN || '123456',

  // Rahasia untuk menandatangani token sesi. Ganti di production.
  authSecret: process.env.AUTH_SECRET || 'ubah-rahasia-ini-di-production',

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
