import { toISODate } from './format.js'

// Kunci periode "YYYY-MM" untuk menandai recurring sudah digenerate bulan apa saja.
export function periodKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

// Tanggal jatuh tempo efektif untuk recurring di bulan tertentu (clamp ke akhir bulan).
export function dueDateFor(rec, year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(rec.dueDay || 1, lastDay)
  return toISODate(new Date(year, month, day))
}

/**
 * Semua recurring aktif untuk bulan berjalan yang BELUM dikonfirmasi
 * (belum ada di generatedPeriods untuk periode itu).
 *
 * Tidak lagi di-gate oleh tanggal jatuh tempo: begitu masuk bulannya, tagihan
 * langsung bisa dikonfirmasi (kamu bisa bayar lebih awal atau lewat dari tanggalnya).
 * `isDue` tetap disertakan sebagai INFO status (sudah/belum melewati jatuh tempo).
 */
export function getPendingRecurring(recurring, today = new Date()) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const pk = periodKey(y, m)
  const pending = []

  for (const rec of recurring) {
    if (!rec.active) continue
    const generated = rec.generatedPeriods || []
    if (generated.includes(pk)) continue
    const due = dueDateFor(rec, y, m)
    const dueDate = new Date(due + 'T00:00:00')
    const isDue = dueDate <= new Date(toISODate(today) + 'T23:59:59')
    pending.push({
      recurring: rec,
      dueDate: due,
      period: pk,
      isDue, // info: true = sudah lewat/hari ini jatuh tempo, false = belum jatuh tempo
    })
  }
  return pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// Recurring yang akan datang dalam N hari ke depan (buat widget dashboard).
export function getUpcomingRecurring(recurring, days = 14, today = new Date()) {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const items = []

  for (let i = 0; i <= days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const y = d.getFullYear()
    const m = d.getMonth()
    const pk = periodKey(y, m)
    for (const rec of recurring) {
      if (!rec.active) continue
      const due = dueDateFor(rec, y, m)
      if (due === toISODate(d)) {
        const generated = rec.generatedPeriods || []
        items.push({
          recurring: rec,
          dueDate: due,
          confirmed: generated.includes(pk),
          daysAway: i,
        })
      }
    }
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
