import { monthShortID, formatDateShort, toISODate } from './format.js'
import { installmentSchedule } from './installments.js'

export function inMonth(iso, year, month) {
  return iso.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
}

export function filterMonth(transactions, year, month) {
  return transactions.filter((t) => inMonth(t.date, year, month))
}

export function sumBy(txs, type) {
  return txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
}

// Ringkasan bulan: income, expense, net
export function monthlySummary(transactions, year, month) {
  const txs = filterMonth(transactions, year, month)
  const income = sumBy(txs, 'income')
  const expense = sumBy(txs, 'expense')
  return { income, expense, net: income - expense, count: txs.length }
}

// Breakdown pengeluaran per kategori -> [{name, value, color}]
// Biaya admin transfer (fee + feeCategoryId) ikut dihitung sebagai pengeluaran.
export function categoryBreakdown(transactions, categoryMap, year, month) {
  const txs = filterMonth(transactions, year, month)
  const map = {}
  for (const t of txs) {
    if (t.type === 'expense') {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount
    } else if (t.type === 'transfer' && t.fee > 0 && t.feeCategoryId) {
      map[t.feeCategoryId] = (map[t.feeCategoryId] || 0) + t.fee
    }
  }
  return Object.entries(map)
    .map(([id, value]) => ({
      id,
      name: categoryMap[id]?.name || 'Lainnya',
      color: categoryMap[id]?.color || '#71717a',
      value,
    }))
    .sort((a, b) => b.value - a.value)
}

// Tren pengeluaran harian, rolling `days` hari terakhir sampai `ref` -> [{date, label, value}]
// Termasuk biaya admin transfer.
export function dailySpendingTrend(transactions, ref = new Date(), days = 30) {
  const buckets = new Map()
  const arr = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i)
    const iso = toISODate(d)
    const entry = { date: iso, label: formatDateShort(iso), value: 0 }
    buckets.set(iso, entry)
    arr.push(entry)
  }
  for (const t of transactions) {
    const entry = buckets.get(t.date.slice(0, 10))
    if (!entry) continue
    if (t.type === 'expense') entry.value += t.amount
    else if (t.type === 'transfer' && t.fee > 0) entry.value += t.fee
  }
  return arr
}

// Cashflow N bulan terakhir -> [{label, income, expense}]
export function cashflowByMonth(transactions, monthsBack = 6, ref = new Date()) {
  const result = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const txs = filterMonth(transactions, y, m)
    result.push({
      year: y,
      month: m,
      label: monthShortID[m],
      income: sumBy(txs, 'income'),
      expense: sumBy(txs, 'expense'),
    })
  }
  return result
}

// Pengeluaran per kategori utk budget (bulan berjalan)
// Biaya admin transfer ikut masuk ke kategori feeCategoryId.
export function spendingPerCategory(transactions, year, month) {
  const txs = filterMonth(transactions, year, month)
  const map = {}
  for (const t of txs) {
    if (t.type === 'expense') map[t.categoryId] = (map[t.categoryId] || 0) + t.amount
    else if (t.type === 'transfer' && t.fee > 0 && t.feeCategoryId) map[t.feeCategoryId] = (map[t.feeCategoryId] || 0) + t.fee
  }
  return map
}

// ---- Net worth over time ----

// Total saldo cash pada akhir tanggal `dateISO` (inklusif).
// Mereplikasi logika accountBalances (DataContext) tapi hanya memproses transaksi <= dateISO.
export function cashBalanceAt(accounts, transactions, dateISO) {
  const map = {}
  for (const a of accounts) {
    if (a.kind === 'paylater') continue
    map[a.id] = a.openingBalance || 0
  }
  for (const t of transactions) {
    if (t.date.slice(0, 10) > dateISO) continue
    if (t.type === 'transfer') {
      if (t.fromAccountId in map) map[t.fromAccountId] -= t.amount + (t.fee || 0)
      if (t.toAccountId in map) map[t.toAccountId] += t.amount
    } else if (t.type === 'expense' || t.type === 'income') {
      if (!(t.accountId in map)) continue
      map[t.accountId] += t.type === 'income' ? t.amount : -t.amount
    }
  }
  return Object.values(map).reduce((s, v) => s + v, 0)
}

// Utang paylater (charge langsung + sisa cicilan) pada akhir tanggal `dateISO`.
// Charge langsung: total expense paylater − pembayaran (transfer masuk), keduanya <= dateISO.
// Cicilan: jumlah termin yang due-nya <= dateISO dan belum jatuh pada window itu, diperkirakan
//   dari schedule (dueDate <= dateISO dianggap sudah tertagih; sisanya utang berjalan).
function paylaterDebtAt(accounts, transactions, installments, dateISO) {
  let debt = 0
  for (const acc of accounts) {
    if (acc.kind !== 'paylater') continue
    let charges = 0
    let payments = 0
    for (const t of transactions) {
      if (t.date.slice(0, 10) > dateISO) continue
      if (t.type === 'expense' && t.accountId === acc.id && !t.installmentId) charges += t.amount
      else if (t.type === 'transfer' && t.toAccountId === acc.id) payments += t.amount
    }
    debt += Math.max(0, charges - payments)

    for (const inst of installments) {
      if (inst.accountId !== acc.id) continue
      // Termin yang sudah "berjalan" (dueDate <= dateISO) tapi belum lunas dianggap utang.
      const schedule = installmentSchedule(inst, acc)
      const started = schedule.filter((s) => s.dueDate <= dateISO).length
      const remainingTerms = Math.max(0, inst.tenor - started)
      debt += remainingTerms * inst.monthlyAmount
    }
  }
  return debt
}

// Tren kekayaan bersih N bulan terakhir (nilai di akhir tiap bulan) -> [{label, monthEnd, value}]
export function netWorthTrend(accounts, transactions, installments, months = 6, ref = new Date()) {
  const result = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i + 1, 0) // hari terakhir bulan tsb
    // Bulan berjalan: pakai tanggal ref (hari ini), bukan akhir bulan yang belum terjadi.
    const isCurrent = i === 0
    const end = isCurrent ? new Date(ref) : d
    const monthEnd = toISODate(end)
    const cash = cashBalanceAt(accounts, transactions, monthEnd)
    const debt = paylaterDebtAt(accounts, transactions, installments, monthEnd)
    result.push({
      label: monthShortID[d.getMonth()],
      monthEnd,
      value: cash - debt,
    })
  }
  return result
}

// ---- Forecast arus kas sampai gajian berikutnya ----

// Proyeksi saldo pas gajian: saldo sekarang − semua tagihan yang jatuh tempo sebelum payday.
// bills = gabungan recurring/statement/installment { name, dueDate, amount }.
// Return { saldoSekarang, tagihanTotal, proyeksi, status, paydayISO, bills }
export function forecastToPayday({ totalBalance, bills, paydayISO, bufferRatio = 0.1 }) {
  const relevant = (bills || [])
    .filter((b) => b.dueDate <= paydayISO)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const tagihanTotal = relevant.reduce((s, b) => s + b.amount, 0)
  const proyeksi = totalBalance - tagihanTotal
  const buffer = Math.max(0, totalBalance) * bufferRatio
  let status = 'aman'
  if (proyeksi < 0) status = 'minus'
  else if (proyeksi < buffer) status = 'mepet'
  return { saldoSekarang: totalBalance, tagihanTotal, proyeksi, status, paydayISO, bills: relevant }
}
