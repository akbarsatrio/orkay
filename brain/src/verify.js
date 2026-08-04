// Keamanan webhook: verifikasi HMAC signature dari OpenWA + whitelist nomor.
import 'dotenv/config'
import crypto from 'node:crypto'

const SECRET = process.env.WA_WEBHOOK_SECRET || ''
const ALLOWED = (process.env.WA_ALLOWED_NUMBERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Flag lingkungan: di production wajib fail-closed; "dev open" harus EKSPLISIT.
const IS_PROD = process.env.NODE_ENV === 'production'
const DEV_OPEN = process.env.WA_DEV_OPEN === '1'

// Verifikasi HMAC-SHA256 atas RAW body. OpenWA mengirim signature di header
// "X-OpenWA-Signature" dengan format "sha256=<hex>".
// Kalau SECRET kosong: FAIL CLOSED di production (atau saat DEV_OPEN != 1).
// Skip verifikasi HANYA di dev lokal yang eksplisit set WA_DEV_OPEN=1.
export function verifySignature(req) {
  if (!SECRET) {
    if (!IS_PROD && DEV_OPEN) return { ok: true, skipped: true }
    return { ok: false, reason: 'WA_WEBHOOK_SECRET wajib diisi' }
  }
  const raw = req.rawBody
  if (!raw) return { ok: false, reason: 'raw body tidak tersedia' }

  const provided =
    req.headers['x-openwa-signature'] ||
    req.headers['x-webhook-signature'] || // fallback bila konfigurasi berbeda
    ''
  if (!provided) return { ok: false, reason: 'signature tidak ada di header' }

  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex')

  const a = Buffer.from(String(provided))
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'signature tidak cocok' }
  }
  return { ok: true }
}

// Normalisasi nomor: ambil digit saja, buang suffix WA (@c.us) & tanda +.
export function normalizeNumber(chatId) {
  return String(chatId || '').replace(/@.*/, '').replace(/[^\d]/g, '')
}

// Cek apakah nomor diizinkan.
// ALLOWED kosong: TOLAK SEMUA di production (atau saat DEV_OPEN != 1) — fail closed.
// Izinkan semua HANYA di dev lokal yang eksplisit set WA_DEV_OPEN=1.
export function isAllowed(number) {
  if (ALLOWED.length === 0) return !IS_PROD && DEV_OPEN
  const n = normalizeNumber(number)
  return ALLOWED.some((a) => normalizeNumber(a) === n)
}
