// COPY dari client/src/lib/paylater.js (keputusan A1).
// Hanya import yang diubah agar mengarah ke ./format.js lokal (yang sudah
// menyediakan toISODate & periodKey). Logika billing TIDAK diubah.
//
// Jika aturan billing di client berubah, sinkronkan file ini secara manual.
import { toISODate, periodKey } from './format.js'

// ---- Billing cycle helpers ----

// Tentukan statement period (YYYY-MM) untuk sebuah transaksi berdasarkan closingDay.
// Transaksi tgl <= closingDay -> statement bulan itu.
// Transaksi tgl >  closingDay -> statement bulan BERIKUTNYA.
export function statementOf(txDateISO, closingDay) {
  const d = new Date(txDateISO + 'T00:00:00')
  let y = d.getFullYear()
  let m = d.getMonth()
  const day = d.getDate()
  if (day > closingDay) {
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return periodKey(y, m)
}

// Tanggal closing untuk sebuah statement period.
export function closingDateOf(statementPeriod, closingDay) {
  const [y, m] = statementPeriod.split('-').map(Number)
  const month = m - 1
  const lastDay = new Date(y, month + 1, 0).getDate()
  const day = Math.min(closingDay, lastDay)
  return toISODate(new Date(y, month, day))
}

// Due date = dueDay pada (bulan statement + dueMonthOffset).
export function dueDateOf(statementPeriod, dueDay, dueMonthOffset = 1) {
  const [y, m] = statementPeriod.split('-').map(Number)
  let year = y
  let month = (m - 1) + dueMonthOffset
  year += Math.floor(month / 12)
  month = ((month % 12) + 12) % 12
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(dueDay, lastDay)
  return toISODate(new Date(year, month, day))
}

// ---- Debt / limit ----

// Total utang cicilan aktif untuk sebuah akun paylater = sisa termin belum dibayar.
export function installmentDebt(account, installments) {
  let debt = 0
  for (const inst of installments) {
    if (inst.accountId !== account.id) continue
    if (!inst.active) continue
    const remaining = Math.max(0, inst.tenor - inst.paidCount)
    debt += remaining * inst.monthlyAmount
  }
  return debt
}

// Utang charge langsung (non-cicilan) = total expense paylater dikurangi pembayaran statement (transfer masuk).
export function directChargeDebt(account, transactions) {
  let charges = 0
  let payments = 0
  for (const t of transactions) {
    if (t.type === 'expense' && t.accountId === account.id && !t.installmentId) {
      charges += t.amount
    } else if (t.type === 'transfer' && t.toAccountId === account.id) {
      payments += t.amount
    }
  }
  return Math.max(0, charges - payments)
}

// Info limit sebuah akun paylater: { limit, used, available }
export function payLaterInfoFor(account, transactions, installments) {
  const used = installmentDebt(account, installments) + directChargeDebt(account, transactions)
  const limit = account.creditLimit || 0
  return { limit, used, available: Math.max(0, limit - used) }
}

// ---- Statements (charge langsung, non-cicilan) ----

// Kelompokkan charge langsung paylater per statement period, hitung tagihan & status bayar.
// Return [{ period, closingDate, dueDate, total, paid, unpaid, charges[] }]
export function computeStatements(account, transactions) {
  const closingDay = account.closingDay || 1
  const dueDay = account.dueDay || 1
  const offset = account.dueMonthOffset ?? 1

  const byPeriod = {}
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (t.accountId !== account.id) continue
    if (t.installmentId) continue // cicilan ditangani terpisah
    const period = statementOf(t.date, closingDay)
    if (!byPeriod[period]) byPeriod[period] = { total: 0, charges: [] }
    byPeriod[period].total += t.amount
    byPeriod[period].charges.push(t)
  }

  // pembayaran statement (transfer ke akun ini), dikelompokkan per statementPeriod kalau ada
  const paidByPeriod = {}
  let unassignedPayment = 0
  for (const t of transactions) {
    if (t.type === 'transfer' && t.toAccountId === account.id) {
      if (t.statementPeriod) {
        paidByPeriod[t.statementPeriod] = (paidByPeriod[t.statementPeriod] || 0) + t.amount
      } else {
        unassignedPayment += t.amount
      }
    }
  }

  const periods = Object.keys(byPeriod).sort()
  const result = periods.map((period) => {
    let paid = paidByPeriod[period] || 0
    // alokasikan pembayaran tanpa periode ke statement terlama dulu
    if (unassignedPayment > 0) {
      const need = byPeriod[period].total - paid
      const alloc = Math.min(Math.max(0, need), unassignedPayment)
      paid += alloc
      unassignedPayment -= alloc
    }
    const total = byPeriod[period].total
    return {
      period,
      closingDate: closingDateOf(period, closingDay),
      dueDate: dueDateOf(period, dueDay, offset),
      total,
      paid,
      unpaid: Math.max(0, total - paid),
      charges: byPeriod[period].charges,
    }
  })
  return result
}

// Statement paylater yang belum lunas & sudah closing (siap dibayar).
export function getUnpaidStatements(accounts, transactions, today = new Date()) {
  const todayISOStr = toISODate(today)
  const items = []
  for (const acc of accounts) {
    if (acc.kind !== 'paylater') continue
    for (const st of computeStatements(acc, transactions)) {
      if (st.unpaid <= 0) continue
      // sudah closing (statement sudah tutup) -> siap ditagih
      if (st.closingDate <= todayISOStr) {
        items.push({ account: acc, ...st })
      }
    }
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
