import { z } from 'zod'
import { client } from '../client.js'
import { resolveCategory } from '../resolve.js'
import { text, safeTool, parseAmount } from '../util.js'
import { formatRupiah, periodLabel, currentPeriod } from '../format.js'

// Filter transaksi berdasarkan periode "YYYY-MM".
function inPeriod(tx, period) {
  return typeof tx.date === 'string' && tx.date.slice(0, 7) === period
}

function catName(categories, id) {
  const c = categories.find((x) => x.id === id)
  return c ? c.name : 'Tanpa kategori'
}

export function registerReportTools(server) {
  server.tool(
    'spending_by_category',
    'Rincian pengeluaran per kategori pada suatu bulan (default bulan ini). ' +
      'Pembelian cicilan (type installment) tidak dihitung; pembayaran termin (expense) dihitung.',
    {
      period: z.string().optional().describe('Bulan "YYYY-MM" (default bulan ini)'),
    },
    safeTool(async (a) => {
      const { transactions, categories } = await client.bootstrap()
      const period = a.period || currentPeriod()
      const byCat = {}
      let total = 0
      for (const t of transactions) {
        if (t.type !== 'expense') continue
        if (!inPeriod(t, period)) continue
        byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount
        total += t.amount
      }
      const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1])
      if (!rows.length) return text(`Belum ada pengeluaran di ${periodLabel(period)}.`)

      let out = `📉 *Pengeluaran ${periodLabel(period)}*\n`
      for (const [id, amt] of rows) {
        const pct = total ? Math.round((amt / total) * 100) : 0
        out += `\n• ${catName(categories, id)}: ${formatRupiah(amt)} (${pct}%)`
      }
      out += `\n———\nTotal: *${formatRupiah(total)}*`
      return text(out)
    })
  )

  server.tool(
    'monthly_summary',
    'Ringkasan bulanan: total pemasukan, pengeluaran, selisih (net), dan kategori pengeluaran teratas.',
    {
      period: z.string().optional().describe('Bulan "YYYY-MM" (default bulan ini)'),
    },
    safeTool(async (a) => {
      const { transactions, categories } = await client.bootstrap()
      const period = a.period || currentPeriod()
      let income = 0
      let expense = 0
      const byCat = {}
      for (const t of transactions) {
        if (!inPeriod(t, period)) continue
        if (t.type === 'income') income += t.amount
        else if (t.type === 'expense') {
          expense += t.amount
          byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount
        }
      }
      const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3)
      const net = income - expense

      let out = `🗓️ *Ringkasan ${periodLabel(period)}*\n` +
        `\nPemasukan: ${formatRupiah(income)}` +
        `\nPengeluaran: ${formatRupiah(expense)}` +
        `\nSelisih: *${formatRupiah(net)}*${net < 0 ? ' (defisit)' : ''}`
      if (top.length) {
        out += '\n\nTop pengeluaran:'
        for (const [id, amt] of top) out += `\n• ${catName(categories, id)}: ${formatRupiah(amt)}`
      }
      return text(out)
    })
  )

  server.tool(
    'budget_status',
    'Status budget tiap kategori bulan ini: batas, terpakai, sisa, dan persentase.',
    {
      period: z.string().optional().describe('Bulan "YYYY-MM" (default bulan ini)'),
    },
    safeTool(async (a) => {
      const { transactions, categories, budgets } = await client.bootstrap()
      if (!budgets.length) return text('Belum ada budget yang diset.')
      const period = a.period || currentPeriod()

      const spent = {}
      for (const t of transactions) {
        if (t.type !== 'expense') continue
        if (!inPeriod(t, period)) continue
        spent[t.categoryId] = (spent[t.categoryId] || 0) + t.amount
      }

      let out = `🎯 *Status Budget ${periodLabel(period)}*\n`
      for (const b of budgets) {
        const used = spent[b.categoryId] || 0
        const limit = b.limit
        const pct = limit ? Math.round((used / limit) * 100) : 0
        const sisa = limit - used
        const flag = used > limit ? ' ⚠️ OVER' : pct >= 80 ? ' ⚡' : ''
        out += `\n• ${catName(categories, b.categoryId)}: ${formatRupiah(used)} / ${formatRupiah(limit)} (${pct}%)` +
          `${flag}\n  Sisa: ${formatRupiah(sisa)}`
      }
      return text(out)
    })
  )

  server.tool(
    'set_budget',
    'Set/ubah budget bulanan untuk sebuah kategori pengeluaran (mis. "budget makan 2jt"). ' +
      'Kalau kategori sudah punya budget, nilainya diperbarui.',
    {
      category: z.string().describe('Nama kategori pengeluaran'),
      limit: z.union([z.number(), z.string()]).describe('Batas budget per bulan, mis. 2000000, "2jt"'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const cat = resolveCategory(a.category, boot.categories, 'expense')
      const limit = parseAmount(a.limit)
      if (!(limit > 0)) throw new Error('Batas budget harus lebih dari 0.')

      await client.post('/api/budgets', { categoryId: cat.id, limit })
      client.invalidate()
      return text(`✅ Budget ${cat.name} diset ${formatRupiah(limit)}/bulan.`)
    })
  )

  server.tool(
    'delete_budget',
    'Hapus budget sebuah kategori. Konfirmasi dulu ke user sebelum menghapus.',
    {
      category: z.string().describe('Nama kategori yang budgetnya mau dihapus'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const cat = resolveCategory(a.category, boot.categories, 'expense')
      const budget = boot.budgets.find((b) => b.categoryId === cat.id)
      if (!budget) return text(`Kategori ${cat.name} belum punya budget.`)
      await client.del(`/api/budgets/${budget.id}`)
      client.invalidate()
      return text(`🗑️ Budget ${cat.name} dihapus.`)
    })
  )
}
