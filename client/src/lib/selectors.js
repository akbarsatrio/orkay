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

// Proyeksi saldo pas gajian: saldo sekarang − tagihan terjadwal − perkiraan belanja harian.
// bills = gabungan recurring/statement/installment { name, dueDate, amount }.
// discretionary = total perkiraan belanja diskresioner sampai payday (0 kalau tidak dipakai).
// Return { saldoSekarang, tagihanTotal, belanjaEstimasi, proyeksi, status, paydayISO, bills }
export function forecastToPayday({ totalBalance, bills, paydayISO, discretionary = 0, bufferRatio = 0.1 }) {
  const relevant = (bills || [])
    .filter((b) => b.dueDate <= paydayISO)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const tagihanTotal = relevant.reduce((s, b) => s + b.amount, 0)
  const belanjaEstimasi = Math.max(0, discretionary)
  const proyeksi = totalBalance - tagihanTotal - belanjaEstimasi
  const buffer = Math.max(0, totalBalance) * bufferRatio
  let status = 'aman'
  if (proyeksi < 0) status = 'minus'
  else if (proyeksi < buffer) status = 'mepet'
  return { saldoSekarang: totalBalance, tagihanTotal, belanjaEstimasi, proyeksi, status, paydayISO, bills: relevant }
}

// ---- Estimasi belanja harian (behavior-aware) ----

const median = (nums) => {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const mean = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0)

// Belanja DISKRESIONER per hari kalender dalam `lookback` hari terakhir (sblm hari ini).
// Diskresioner = expense tanpa recurringId & installmentId (biar tidak dobel dgn tagihan terjadwal).
// Return array of { iso, weekend, value } urut lama->baru, termasuk hari Rp0.
function discretionaryDailySeries(transactions, ref, lookback) {
  const buckets = new Map()
  const days = []
  // sampai kemarin (i=1) supaya hari berjalan yang belum penuh tidak menekan rata-rata
  for (let i = lookback; i >= 1; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i)
    const iso = toISODate(d)
    const dow = d.getDay()
    const entry = { iso, weekend: dow === 0 || dow === 6, value: 0 }
    buckets.set(iso, entry)
    days.push(entry)
  }
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (t.recurringId || t.installmentId) continue
    const entry = buckets.get(t.date.slice(0, 10))
    if (entry) entry.value += t.amount
  }
  return days
}

// Estimasi laju belanja harian dgn 4 metode.
// method: 'mean' | 'median' | 'weekpart' | 'trim'
// Return { method, perDay, weekday, weekend } (perDay = laju gabungan utk metode flat).
export function estimateDailyBurn(transactions, ref = new Date(), lookback = 60, method = 'weekpart') {
  const series = discretionaryDailySeries(transactions, ref, lookback)
  const values = series.map((d) => d.value)
  const wdVals = series.filter((d) => !d.weekend).map((d) => d.value)
  const weVals = series.filter((d) => d.weekend).map((d) => d.value)

  let perDay = 0
  if (method === 'median') {
    perDay = median(values)
  } else if (method === 'trim') {
    const sorted = [...values].sort((a, b) => a - b)
    const cut = Math.floor(sorted.length * 0.1)
    perDay = mean(cut ? sorted.slice(0, sorted.length - cut) : sorted)
  } else {
    // 'mean' & fallback utk 'weekpart' (perDay dipakai kalau proyeksi butuh angka tunggal)
    perDay = mean(values)
  }

  return {
    method,
    perDay,
    weekday: mean(wdVals),
    weekend: mean(weVals),
  }
}

// Proyeksikan total belanja diskresioner dari `fromISO` (eksklusif hari ini) s/d `toISO` (inklusif).
// Metode 'weekpart' menghitung jumlah hari kerja vs weekend nyata di window.
export function projectDiscretionary(estimate, fromExclusiveISO, toISO) {
  const start = new Date(fromExclusiveISO + 'T00:00:00')
  const end = new Date(toISO + 'T00:00:00')
  if (end <= start) return 0

  if (estimate.method === 'weekpart') {
    let wd = 0
    let we = 0
    const cur = new Date(start)
    cur.setDate(cur.getDate() + 1) // mulai besok
    while (cur <= end) {
      const dow = cur.getDay()
      if (dow === 0 || dow === 6) we++
      else wd++
      cur.setDate(cur.getDate() + 1)
    }
    return wd * estimate.weekday + we * estimate.weekend
  }

  const days = Math.round((end - start) / 86400000)
  return Math.max(0, days) * estimate.perDay
}
