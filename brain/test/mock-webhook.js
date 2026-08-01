// Mock webhook: kirim payload ala OpenWA (message.received) ke Brain,
// tanpa perlu OpenWA jalan. Balasan Brain muncul sebagai [WA STUB] di console Brain.
//
// Cara pakai:
//   1) Jalankan Brain di terminal lain:  npm start   (di folder brain/)
//   2) Pastikan server Orkay (:3001) + MySQL jalan.
//   3) node test/mock-webhook.js "jajan 25rb gopay"
//
// Argumen pertama = teks pesan. Default beberapa skenario kalau tanpa argumen.

const BRAIN_URL = process.env.BRAIN_URL || 'http://localhost:4000/webhook/wa'
const FROM = process.env.MOCK_FROM || '628123456789'

function payload(text) {
  return {
    event: 'message.received',
    timestamp: new Date().toISOString(),
    sessionId: 'mock',
    idempotencyKey: `msg_mock_${Date.now()}`,
    deliveryId: `dlv_${Date.now()}`,
    data: {
      id: `true_${FROM}@c.us_${Date.now()}`,
      from: `${FROM}@c.us`,
      to: '628000000000@c.us',
      chatId: `${FROM}@c.us`,
      body: text,
      type: 'text',
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: false,
      isGroup: false,
      kind: 'individual',
      author: `${FROM}@c.us`,
      senderPhone: FROM,
    },
  }
}

async function send(text) {
  console.log(`\n>>> KIRIM: "${text}"`)
  const res = await fetch(BRAIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload(text)),
  })
  console.log(`<<< HTTP ${res.status}`, await res.text())
}

async function main() {
  const arg = process.argv.slice(2).join(' ').trim()
  if (arg) {
    await send(arg)
    return
  }
  // Skenario default (jeda antar pesan biar balasan Brain sempat kelihatan).
  const scenarios = [
    'saldo gua berapa?',
    'jajan 25rb pakai gopay buat makan',
    'tagihan pay later ada?',
    'cicilan yang aktif apa aja?',
  ]
  for (const s of scenarios) {
    await send(s)
    await new Promise((r) => setTimeout(r, 6000))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
