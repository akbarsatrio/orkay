import crypto from 'node:crypto'
import { config } from './config.js'

// Token sederhana: base64(payload).hmac
// payload = { iat } — cukup untuk sesi personal single-PIN.
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url')
  return `${body}.${mac}`
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, mac] = token.split('.')
  const expected = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url')
  // bandingkan konstan-waktu
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString())
  } catch {
    return null
  }
  // Cek expiry hanya jika TTL aktif (tokenTtlMs > 0). 0 = token abadi.
  if (config.tokenTtlMs > 0) {
    const iat = payload && payload.iat
    // iat wajib berupa number valid saat TTL aktif; kalau tidak → tolak.
    if (typeof iat !== 'number' || !Number.isFinite(iat)) return null
    if (Date.now() - iat > config.tokenTtlMs) return null
  }
  return payload
}

export function createToken() {
  return sign({ iat: Date.now() })
}

// Bandingkan PIN secara konstan-waktu
export function checkPin(input) {
  const a = Buffer.from(String(input || ''))
  const b = Buffer.from(String(config.pin))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Middleware proteksi: butuh header Authorization: Bearer <token>
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!verify(token)) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  next()
}

// --- Rate limit sederhana untuk endpoint login (anti brute-force) ---
// CATATAN: penyimpanan ini per-proses (in-memory). Aman untuk PM2 fork mode
// single instance. TIDAK cluster-safe: di mode cluster/multi-instance tiap
// worker punya Map sendiri sehingga batas percobaan jadi longgar. Kalau butuh
// cluster-safe, pakai store eksternal (mis. Redis) — jangan pakai DB app ini.
const attempts = new Map() // ip -> { count, first }
const WINDOW_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 10

// GC sederhana: buang entri yang jendela waktunya sudah lewat.
function gcAttempts(now = Date.now()) {
  for (const [ip, rec] of attempts) {
    if (now - rec.first >= WINDOW_MS) attempts.delete(ip)
  }
}

// Bersihkan berkala supaya Map tidak tumbuh tak terbatas walau login sepi.
// .unref() supaya interval ini tidak menahan proses exit.
const gcTimer = setInterval(() => gcAttempts(), WINDOW_MS)
if (typeof gcTimer.unref === 'function') gcTimer.unref()

export function loginRateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  gcAttempts(now) // bersihkan entri kadaluarsa setiap kali dipanggil
  const rec = attempts.get(ip)
  if (rec && now - rec.first < WINDOW_MS) {
    if (rec.count >= MAX_ATTEMPTS) {
      const waitSec = Math.ceil((WINDOW_MS - (now - rec.first)) / 1000)
      return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${waitSec} detik.` })
    }
    rec.count++
  } else {
    attempts.set(ip, { count: 1, first: now })
  }
  next()
}

export function resetRateLimit(req) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  attempts.delete(ip)
}
