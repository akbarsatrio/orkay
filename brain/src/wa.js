// Kirim balasan ke WhatsApp lewat OpenWA Gateway REST.
// MODE STUB: kalau OPENWA_API_KEY kosong, balasan hanya di-log ke console
// (biar bisa test end-to-end tanpa OpenWA jalan).
import 'dotenv/config'

const API_URL = (process.env.OPENWA_API_URL || 'http://localhost:2785').replace(/\/$/, '')
const API_KEY = process.env.OPENWA_API_KEY || ''
const SESSION_ID = process.env.OPENWA_SESSION_ID || ''

export const isStub = !API_KEY

// Cache LID -> nomor asli (biar tidak call OpenWA tiap pesan).
const lidCache = new Map()

// Resolve pengirim ke nomor asli.
// WhatsApp "privacy mode" mengirim LID (mis. "23725...@lid") tanpa nomor asli.
// OpenWA GET /contacts/:id bisa memetakan LID -> "6281...@c.us".
// Return string nomor (digit) atau null kalau gagal.
export async function resolveSenderNumber(from) {
  if (!from) return null
  const raw = String(from)
  // Kalau sudah nomor biasa (@c.us / @s.whatsapp.net), ambil digitnya langsung.
  if (!raw.includes('@lid')) {
    return raw.replace(/@.*/, '').replace(/[^\d]/g, '') || null
  }
  if (isStub) return raw.replace(/@.*/, '').replace(/[^\d]/g, '') || null

  const lidKey = raw.replace(/@.*/, '')
  if (lidCache.has(lidKey)) return lidCache.get(lidKey)

  try {
    const url = `${API_URL}/api/sessions/${SESSION_ID}/contacts/${encodeURIComponent(raw)}`
    const res = await fetch(url, { headers: { 'X-API-Key': API_KEY } })
    if (res.ok) {
      const c = await res.json()
      // c.id biasanya "6281...@c.us"
      const num = String(c.id || '').replace(/@.*/, '').replace(/[^\d]/g, '')
      if (num && !num.startsWith('237')) { // bukan LID lagi
        lidCache.set(lidKey, num)
        return num
      }
    }
  } catch { /* noop */ }
  // fallback: pakai LID apa adanya (whitelist bisa menerima LID juga)
  const fallback = lidKey.replace(/[^\d]/g, '')
  lidCache.set(lidKey, fallback)
  return fallback
}

// chatId: id chat WhatsApp (mis. "628xxx@c.us"). text: isi balasan.
export async function sendText(chatId, text) {
  if (isStub) {
    console.error(`\n[WA STUB → ${chatId}]\n${text}\n`)
    return { stub: true }
  }

  const url = `${API_URL}/api/sessions/${SESSION_ID}/messages/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ chatId, text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Kirim WA gagal (${res.status}): ${body}`)
  }
  return res.json().catch(() => ({ ok: true }))
}
