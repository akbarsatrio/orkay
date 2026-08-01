import { toISODate } from './format.js'

// Cek weekend (Sabtu=6, Minggu=0)
function isWeekend(date) {
  const d = date.getDay()
  return d === 0 || d === 6
}

// holidaySet: Set berisi string ISO 'YYYY-MM-DD'
function isHoliday(date, holidaySet) {
  return holidaySet.has(toISODate(date))
}

function isNonWorking(date, holidaySet) {
  return isWeekend(date) || isHoliday(date, holidaySet)
}

/**
 * Hitung tanggal gajian efektif.
 * Aturan: gajian di tanggal `payDay`. Kalau jatuh di weekend/libur,
 * MAJU (mundur mundur ke hari sebelumnya) ke hari kerja terdekat.
 *
 * @param {number} year
 * @param {number} month  0-indexed (0 = Januari)
 * @param {number} payDay tanggal target (mis. 28)
 * @param {Set<string>} holidaySet set tanggal libur ISO
 * @returns {{ target: string, effective: string, shifted: boolean, reason: string|null }}
 */
export function getPaydayDate(year, month, payDay = 28, holidaySet = new Set()) {
  // Clamp payDay ke jumlah hari di bulan tsb
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(payDay, lastDay)

  const target = new Date(year, month, day)
  const targetISO = toISODate(target)

  let eff = new Date(year, month, day)
  let guard = 0
  while (isNonWorking(eff, holidaySet) && guard < 40) {
    eff.setDate(eff.getDate() - 1)
    guard++
  }

  const effectiveISO = toISODate(eff)
  const shifted = effectiveISO !== targetISO
  let reason = null
  if (shifted) {
    if (isWeekend(target)) reason = 'weekend'
    else if (isHoliday(target, holidaySet)) reason = 'libur'
    else reason = 'libur'
  }

  return { target: targetISO, effective: effectiveISO, shifted, reason }
}

/**
 * Cari gajian efektif BERIKUTNYA dari tanggal acuan.
 * @param {Date} from
 * @param {number} payDay
 * @param {Set<string>} holidaySet
 */
export function getNextPayday(from, payDay = 28, holidaySet = new Set()) {
  const base = new Date(from)
  base.setHours(0, 0, 0, 0)

  // cek bulan ini & 2 bulan ke depan (untuk aman dekat pergantian bulan)
  for (let i = 0; i < 3; i++) {
    const y = base.getFullYear()
    const m = base.getMonth() + i
    const yy = y + Math.floor(m / 12)
    const mm = ((m % 12) + 12) % 12
    const pd = getPaydayDate(yy, mm, payDay, holidaySet)
    const effDate = new Date(pd.effective + 'T00:00:00')
    if (effDate >= base) {
      return pd
    }
  }
  return getPaydayDate(base.getFullYear(), base.getMonth() + 1, payDay, holidaySet)
}

export function daysUntil(iso, from = new Date()) {
  const a = new Date(iso + 'T00:00:00')
  const b = new Date(from)
  b.setHours(0, 0, 0, 0)
  return Math.round((a - b) / 86400000)
}
