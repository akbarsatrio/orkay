import { monthShortID, formatDateShort } from './format.js'

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

// Tren pengeluaran harian dalam 1 bulan -> [{label, value}]
// Termasuk biaya admin transfer.
export function dailySpendingTrend(transactions, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const arr = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, label: `${i + 1}`, value: 0 }))
  for (const t of transactions) {
    if (!inMonth(t.date, year, month)) continue
    const d = parseInt(t.date.slice(8, 10), 10)
    if (!arr[d - 1]) continue
    if (t.type === 'expense') arr[d - 1].value += t.amount
    else if (t.type === 'transfer' && t.fee > 0) arr[d - 1].value += t.fee
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
