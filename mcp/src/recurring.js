// COPY dari client/src/lib/recurring.js (keputusan A1).
// Import diarahkan ke ./format.js lokal. Logika TIDAK diubah.
import { toISODate, periodKey } from './format.js'

// Tanggal jatuh tempo efektif untuk recurring di bulan tertentu (clamp ke akhir bulan).
export function dueDateFor(rec, year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(rec.dueDay || 1, lastDay)
  return toISODate(new Date(year, month, day))
}

// Semua recurring aktif untuk bulan berjalan yang BELUM dikonfirmasi.
// Return [{ recurring, dueDate, period, isDue }]
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
    pending.push({ recurring: rec, dueDate: due, period: pk, isDue })
  }
  return pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// Semua recurring dengan status konfirmasi bulan ini (buat list lengkap).
// Return [{ recurring, dueDate, period, confirmed, isDue }]
export function recurringStatus(recurring, today = new Date()) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const pk = periodKey(y, m)
  const todayISO = toISODate(today)
  return recurring
    .map((rec) => {
      const due = dueDateFor(rec, y, m)
      return {
        recurring: rec,
        dueDate: due,
        period: pk,
        confirmed: (rec.generatedPeriods || []).includes(pk),
        isDue: due <= todayISO,
      }
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
