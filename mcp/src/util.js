import { todayISO } from './format.js'

// Balikan MCP standar: teks.
export function text(msg) {
  return { content: [{ type: 'text', text: msg }] }
}

// Balikan error MCP (isError true) — pesan ramah buat diteruskan ke user.
export function errorText(msg) {
  return { content: [{ type: 'text', text: `⚠️ ${msg}` }], isError: true }
}

// Bungkus handler tool: tangkap error jadi errorText, jangan bikin server crash.
export function safeTool(fn) {
  return async (args) => {
    try {
      return await fn(args || {})
    } catch (err) {
      return errorText(err.message || String(err))
    }
  }
}

// Urai jumlah uang dari input fleksibel:
//  - number langsung: 25000
//  - "25000", "25.000", "Rp 25.000"
//  - "25rb" / "25 ribu" -> 25000
//  - "1,2jt" / "1.2 juta" -> 1200000
export function parseAmount(input) {
  if (typeof input === 'number') return Math.round(input)
  let s = String(input || '').toLowerCase().trim()
  if (!s) return 0

  // deteksi satuan
  let mult = 1
  if (/(jt|juta)/.test(s)) mult = 1_000_000
  else if (/(rb|ribu|k\b)/.test(s)) mult = 1_000

  // ambil bagian numerik (dukung koma/titik desimal untuk jt/rb)
  s = s.replace(/[^0-9.,]/g, '')
  if (!s) return 0

  if (mult > 1) {
    // untuk "1,2jt" perlakukan koma/titik sebagai desimal
    const numeric = parseFloat(s.replace(',', '.'))
    return Math.round((isNaN(numeric) ? 0 : numeric) * mult)
  }
  // nominal biasa: buang semua pemisah ribuan
  const digits = s.replace(/[.,]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

// Validasi & default tanggal (YYYY-MM-DD). Kalau kosong -> hari ini.
export function resolveDate(input) {
  if (!input) return todayISO()
  const s = String(input).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // toleransi "hari ini" / "today"
  if (/^(hari ini|today|now|sekarang)$/i.test(s)) return todayISO()
  throw new Error(`Format tanggal tidak dikenali: "${input}". Gunakan YYYY-MM-DD.`)
}
