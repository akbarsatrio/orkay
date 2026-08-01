import { toISODate } from './format.js'
import { statementOf, dueDateOf } from './paylater.js'

// Jadwal cicilan: N termin dengan due date mengikuti billing cycle akun paylater.
// Termin ke-1 masuk statement dari purchaseDate, termin berikutnya +1 bulan, dst.
// Return [{ termin, dueDate, amount, paid }]
export function installmentSchedule(inst, account) {
  const schedule = []
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
  const todayISO = toISODate(today)
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
      isDue: next.dueDate <= todayISO,
    })
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
