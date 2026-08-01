// Keamanan webhook: verifikasi HMAC signature dari OpenWA + whitelist nomor.
import 'dotenv/config'
import crypto from 'node:crypto'

const SECRET = process.env.WA_WEBHOOK_SECRET || ''
const ALLOWED = (process.env.WA_ALLOWED_NUMBERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Verifikasi HMAC-SHA256 atas RAW body. OpenWA mengirim signature di header
// "X-OpenWA-Signature" dengan format "sha256=<hex>".
// Kalau SECRET kosong -> lewati verifikasi (mode test lokal).
export function verifySignature(req) {
  if (!SECRET) return { ok: true, skipped: true }
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

// Cek apakah nomor diizinkan. ALLOWED kosong -> izinkan semua (test lokal).
export function isAllowed(number) {
  if (ALLOWED.length === 0) return true
  const n = normalizeNumber(number)
  return ALLOWED.some((a) => normalizeNumber(a) === n)
}
