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
  console.error(`[brain] proses pesan dari ${number} (chatId=${chatId}): "${textIn}"`)

  try {
    // Perintah util sederhana.
    if (/^(reset|mulai baru|clear)$/i.test(textIn)) {
      clearHistory(number)
      await sendText(chatId, 'Oke, percakapan direset. 👍')
      return
    }

    // 3) Agent loop
    const history = getHistory(number)
    console.error(`[brain] panggil LLM (history ${history.length} pesan)...`)
    const { reply, messages } = await runAgent(textIn, history)
    console.error(`[brain] LLM balas: "${(reply || '').slice(0, 60)}..."`)
    setHistory(number, messages)

    // 4) Balas
    await sendText(chatId, reply || 'Maaf, aku belum paham. Coba ulangi ya.')
    console.error(`[brain] balasan terkirim ke ${chatId}`)
  } catch (err) {
    console.error('[brain] error proses pesan:', err)
    try {
      await sendText(chatId, `⚠️ Maaf, ada kendala: ${err.message}`)
    } catch { /* noop */ }
  }
})

async function main() {
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
