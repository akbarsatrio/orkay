import { monthShortID, formatDateShort, toISODate } from './format.js'

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
