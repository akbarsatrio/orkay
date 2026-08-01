const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const idrCompact = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const numberID = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export function formatRupiah(value) {
  return idr.format(Math.round(value || 0))
}

// "Rp1,2 jt" untuk axis chart / ruang sempit
export function formatRupiahCompact(value) {
  return 'Rp' + idrCompact.format(Math.round(value || 0)).replace('rb', 'rb').replace('jt', 'jt')
}

// Angka polos dengan pemisah ribuan (buat input)
export function formatNumber(value) {
  return numberID.format(value || 0)
}

// Ambil angka dari string input berformat
export function parseNumber(str) {
  if (typeof str === 'number') return str
  const cleaned = String(str).replace(/[^\d]/g, '')
  return cleaned ? parseInt(cleaned, 10) : 0
}

const dayNamesID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const monthNamesID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const monthShortID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

export function toISODate(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(iso, opts = {}) {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  const day = d.getDate()
  const month = opts.short ? monthShortID[d.getMonth()] : monthNamesID[d.getMonth()]
  const year = d.getFullYear()
  if (opts.withDay) {
    return `${dayNamesID[d.getDay()]}, ${day} ${month} ${year}`
  }
  return `${day} ${month} ${year}`
}

export function formatDateShort(iso) {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()} ${monthShortID[d.getMonth()]}`
}

export function monthLabel(year, month, short = false) {
  const arr = short ? monthShortID : monthNamesID
  return `${arr[month]} ${year}`
}

export function dayName(iso) {
  const d = new Date(iso + 'T00:00:00')
  return dayNamesID[d.getDay()]
}

export { monthNamesID, monthShortID, dayNamesID }
