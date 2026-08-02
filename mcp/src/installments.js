// COPY dari client/src/lib/installments.js (keputusan A1).
// Import diarahkan ke ./format.js & ./paylater.js lokal. Logika TIDAK diubah.
import { toISODate } from './format.js'
import { statementOf, dueDateOf } from './paylater.js'

// Tambah N bulan ke sebuah tanggal ISO, clamp ke akhir bulan bila tanggalnya tidak ada.
// Contoh: 31 Jan + 1 bln -> 28/29 Feb.
export function addMonthsClamp(dateISO, months) {
  const d = new Date(dateISO + 'T00:00:00')
  const day = d.getDate()
  let year = d.getFullYear()
  let month = d.getMonth() + months
  year += Math.floor(month / 12)
  month = ((month % 12) + 12) % 12
  const lastDay = new Date(year, month + 1, 0).getDate()
  return toISODate(new Date(year, month, Math.min(day, lastDay)))
}

// Jadwal cicilan: N termin dengan due date mengikuti model billing akun paylater.
// - model 'anniversary' : jatuh tempo = tanggal beli + (i+1) bulan (bayar di tanggal yang sama).
// - model 'statement'   : mengikuti siklus statement (closingDay/dueDay/dueMonthOffset).
// Return [{ termin, period, dueDate, amount, paid }]
export function installmentSchedule(inst, account) {
  const schedule = []

  if (account?.billingModel === 'anniversary') {
    for (let i = 0; i < inst.tenor; i++) {
      const dueDate = addMonthsClamp(inst.purchaseDate, i + 1)
      schedule.push({
        termin: i + 1,
        period: dueDate.slice(0, 7),
        dueDate,
        amount: inst.monthlyAmount,
        paid: i < inst.paidCount,
      })
    }
    return schedule
  }

  // Model 'statement' (default) — perilaku existing.
  const closingDay = account?.closingDay || 1
  const dueDay = account?.dueDay || 1
  const offset = account?.dueMonthOffset ?? 1

  // statement period untuk termin pertama (berdasarkan tanggal beli & closing)
  const firstPeriod = statementOf(inst.purchaseDate, closingDay)
  const [fy, fm] = firstPeriod.split('-').map(Number)

  for (let i = 0; i < inst.tenor; i++) {
    let year = fy
    let month = (fm - 1) + i
    year += Math.floor(month / 12)
    month = ((month % 12) + 12) % 12
    const period = `${year}-${String(month + 1).padStart(2, '0')}`
    schedule.push({
      termin: i + 1,
      period,
      dueDate: dueDateOf(period, dueDay, offset),
      amount: inst.monthlyAmount,
      paid: i < inst.paidCount,
    })
  }
  return schedule
}

// Termin cicilan berikutnya yang belum dibayar (untuk konfirmasi).
export function nextUnpaidTermin(inst, account) {
  const schedule = installmentSchedule(inst, account)
  return schedule.find((s) => !s.paid) || null
}

// Cicilan aktif yang termin berikutnya sudah jatuh tempo / mendekati (untuk daftar tagihan).
// Return [{ installment, account, termin, dueDate, amount }]
export function getPendingInstallments(installments, accounts, today = new Date()) {
  const todayISOStr = toISODate(today)
  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const items = []
  for (const inst of installments) {
    if (!inst.active) continue
    if (inst.paidCount >= inst.tenor) continue
    const acc = accMap[inst.accountId]
    const next = nextUnpaidTermin(inst, acc)
    if (!next) continue
    items.push({
      installment: inst,
      account: acc,
      termin: next.termin,
      period: next.period,
      dueDate: next.dueDate,
      amount: next.amount,
      isDue: next.dueDate <= todayISOStr,
    })
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
