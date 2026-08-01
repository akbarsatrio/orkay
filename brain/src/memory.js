// Memori percakapan in-memory per nomor WhatsApp.
// Menyimpan N pesan terakhir dengan TTL, agar follow-up ("eh salah, 30rb") tetap nyambung.
// Hilang saat Brain restart — cukup untuk pemakaian personal.

const MAX_MESSAGES = Number(process.env.MEMORY_MAX_MESSAGES) || 12
const TTL_MS = Number(process.env.MEMORY_TTL_MS) || 30 * 60 * 1000

const store = new Map() // number -> { messages: [], updatedAt }

// Ambil riwayat (tanpa system prompt) untuk sebuah nomor.
export function getHistory(number) {
  const rec = store.get(number)
  if (!rec) return []
  if (Date.now() - rec.updatedAt > TTL_MS) {
    store.delete(number)
    return []
  }
  return rec.messages
}

// Simpan riwayat terbaru. Buang system & pangkas ke MAX_MESSAGES pesan terakhir.
export function setHistory(number, messages) {
  const trimmed = messages.filter((m) => m.role !== 'system')
  // Simpan hanya ekor percakapan agar tidak membengkak.
  const tail = trimmed.slice(-MAX_MESSAGES)
  store.set(number, { messages: tail, updatedAt: Date.now() })
}

// Reset percakapan sebuah nomor (mis. perintah "reset"/"mulai baru").
export function clearHistory(number) {
  store.delete(number)
}
