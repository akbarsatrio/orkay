// Helper format & tanggal — self-contained (tanpa dependency browser).
// Sebagian di-port dari client/src/lib/format.js + recurring.js agar logika
// billing yang di-copy (paylater.js, installments.js) tetap konsisten.

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const numberID = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export function formatRupiah(value) {
  return idr.format(Math.round(value || 0))
}

export function formatNumber(value) {
  return numberID.format(Math.round(value || 0))
}

// Ambil angka bulat dari string (mis. "25.000" / "Rp 25rb" -> caller yang urai satuan).
export function parseNumber(str) {
  if (typeof str === 'number') return Math.round(str)
  const cleaned = String(str).replace(/[^\d]/g, '')
  return cleaned ? parseInt(cleaned, 10) : 0
}

const dayNamesID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const monthNamesID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function toISODate(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Tanggal ISO hari ini (zona waktu lokal server).
export function todayISO() {
  return toISODate(new Date())
}

export function formatDate(iso, opts = {}) {
  if (!iso) return '-'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  const day = d.getDate()
  const month = monthNamesID[d.getMonth()]
  const year = d.getFullYear()
  if (opts.withDay) {
    return `${dayNamesID[d.getDay()]}, ${day} ${month} ${year}`
  }
  return `${day} ${month} ${year}`
}

// Kunci periode "YYYY-MM".
export function periodKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

// Label periode "Maret 2026" dari "YYYY-MM".
export function periodLabel(period) {
  if (!period) return '-'
  const [y, m] = period.split('-').map(Number)
  return `${monthNamesID[(m - 1 + 12) % 12]} ${y}`
}

// Periode berjalan (bulan ini) sebagai "YYYY-MM".
export function currentPeriod() {
  const now = new Date()
  return periodKey(now.getFullYear(), now.getMonth())
}

export { monthNamesID, dayNamesID }
