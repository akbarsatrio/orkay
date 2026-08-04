// Orkay Brain — orchestrator webhook WhatsApp -> LLM (9Router) -> MCP Orkay -> balas WA.
import 'dotenv/config'
import express from 'express'
import { verifySignature, isAllowed, normalizeNumber } from './verify.js'
import { getHistory, setHistory, clearHistory } from './memory.js'
import { runAgent } from './llm.js'
import { sendText, resolveSenderNumber, isStub } from './wa.js'
import { mcp } from './mcp-client.js'

const PORT = Number(process.env.PORT) || 4000
const app = express()

// Rate limit per nomor WA (in-memory) — hemat token: tolak sebelum panggil LLM.
const RATE_MAX = Number(process.env.WA_RATE_MAX) || 15
const RATE_WINDOW_MS = Number(process.env.WA_RATE_WINDOW_MS) || 60000
const rateMap = new Map() // number -> { count, resetAt }

// true kalau nomor masih dalam kuota (dan increment). false kalau kelewat.
function rateAllow(number) {
  const now = Date.now()
  const rec = rateMap.get(number)
  if (!rec || now >= rec.resetAt) {
    rateMap.set(number, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (rec.count >= RATE_MAX) return false
  rec.count++
  return true
}

// GC ringan: buang entri kadaluarsa tiap 1 window. unref agar tak menahan exit.
setInterval(() => {
  const now = Date.now()
  for (const [num, rec] of rateMap) {
    if (now >= rec.resetAt) rateMap.delete(num)
  }
}, RATE_WINDOW_MS).unref()

// Simpan raw body untuk verifikasi HMAC (signature dihitung atas byte mentah).
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf
    },
  })
)

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'orkay-brain', waMode: isStub ? 'stub' : 'live' })
})

// Webhook dari OpenWA.
app.post('/webhook/wa', async (req, res) => {
  // 1) Verifikasi HMAC
  const sig = verifySignature(req)
  if (!sig.ok) {
    console.error(`[brain] tolak webhook: ${sig.reason}`)
    return res.status(401).json({ error: 'invalid signature' })
  }

  const body = req.body || {}
  const event = body.event || req.headers['x-openwa-event']
  const data = body.data || {}

  // Balas cepat supaya OpenWA tidak retry (proses LLM async di belakang).
  res.json({ ok: true })

  // Hanya proses pesan masuk teks dari user (bukan pesan kita sendiri / grup).
  if (event && event !== 'message.received') return
  if (data.fromMe) return
  if (data.isGroup) return
  const textIn = (data.body || '').trim()
  if (!textIn) return

  const chatId = data.chatId || data.from
  // Resolve pengirim: kalau LID, petakan ke nomor asli via OpenWA contacts.
  let number = normalizeNumber(data.senderPhone || '')
  if (!number) {
    number = (await resolveSenderNumber(data.from || chatId)) || normalizeNumber(chatId)
  }

  // 2) Whitelist nomor
  if (!isAllowed(number)) {
    console.error(`[brain] abaikan pesan dari nomor non-whitelist: ${number}`)
    return
  }

  // 3) Rate limit per nomor — tolak sebelum panggil LLM untuk hemat token.
  if (!rateAllow(number)) {
    console.error(`[brain] rate limit tercapai untuk ${number}, abaikan pesan.`)
    try {
      await sendText(chatId, 'Kebanyakan pesan, coba lagi sebentar ya. ⏳')
    } catch { /* noop */ }
    return
  }
  console.error(`[brain] proses pesan dari ${number} (chatId=${chatId}): "${textIn}"`)

  try {
    // Perintah util sederhana.
    if (/^(reset|mulai baru|clear)$/i.test(textIn)) {
      clearHistory(number)
      await sendText(chatId, 'Oke, percakapan direset. 👍')
      return
    }

    // 4) Agent loop
    const history = getHistory(number)
    console.error(`[brain] panggil LLM (history ${history.length} pesan)...`)
    const { reply, messages } = await runAgent(textIn, history)
    console.error(`[brain] LLM balas: "${(reply || '').slice(0, 60)}..."`)
    setHistory(number, messages)

    // 5) Balas
    await sendText(chatId, reply || 'Maaf, aku belum paham. Coba ulangi ya.')
    console.error(`[brain] balasan terkirim ke ${chatId}`)
  } catch (err) {
    // Log full error di server; JANGAN bocorkan detail (URL/kredensial) ke user.
    console.error('[brain] error proses pesan:', err)
    const isProd = process.env.NODE_ENV === 'production'
    const userMsg = isProd
      ? '⚠️ Maaf, lagi ada kendala teknis. Coba lagi sebentar ya.'
      : `⚠️ Maaf, ada kendala: ${err.message}`
    try {
      await sendText(chatId, userMsg)
    } catch { /* noop */ }
  }
})

async function main() {
  // Guard startup: di production, webhook WAJIB punya secret + whitelist.
  // Tanpanya server REFUSE TO START (fail closed) — tidak ada override untuk production.
  const IS_PROD = process.env.NODE_ENV === 'production'
  const hasSecret = !!(process.env.WA_WEBHOOK_SECRET || '').trim()
  const hasWhitelist = !!(process.env.WA_ALLOWED_NUMBERS || '').trim()
  if (IS_PROD && (!hasSecret || !hasWhitelist)) {
    console.error('[brain] ❌ REFUSE TO START (production):')
    if (!hasSecret) console.error('        - WA_WEBHOOK_SECRET wajib diisi.')
    if (!hasWhitelist) console.error('        - WA_ALLOWED_NUMBERS wajib diisi.')
    console.error('        Isi kedua env di atas lalu jalankan ulang.')
    process.exit(1)
  }
  if (!IS_PROD && (!hasSecret || !hasWhitelist) && process.env.WA_DEV_OPEN !== '1') {
    console.error('[brain] ⚠  Tanpa WA_WEBHOOK_SECRET/WA_ALLOWED_NUMBERS & WA_DEV_OPEN!=1:')
    console.error('        webhook akan MENOLAK SEMUA pesan. Set WA_DEV_OPEN=1 untuk dev lokal.')
  }

  // Spawn MCP Orkay lebih awal agar tools siap & error konfigurasi cepat ketahuan.
  try {
    await mcp.connect()
  } catch (err) {
    console.error('[brain] gagal connect MCP Orkay:', err.message)
    console.error('       Pastikan server Orkay (:3001) + MySQL jalan, dan MCP_ENTRY benar.')
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.error(`[brain] jalan di http://localhost:${PORT}  (WA mode: ${isStub ? 'STUB/log' : 'live OpenWA'})`)
    if (!process.env.LLM_API_KEY) {
      console.error('[brain] ⚠  LLM_API_KEY kosong — panggilan ke 9Router akan gagal. Isi di .env.')
    }
  })
}

main()
