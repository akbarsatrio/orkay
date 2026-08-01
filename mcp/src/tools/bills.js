import { z } from 'zod'
import { client } from '../client.js'
import { resolveAccount, resolveInstallment } from '../resolve.js'
import { text, safeTool, parseAmount, resolveDate } from '../util.js'
import { formatRupiah, formatDate, periodLabel } from '../format.js'
import { getUnpaidStatements } from '../paylater.js'
import { getPendingInstallments } from '../installments.js'
import { computeBalances } from '../balances.js'

export function registerBillTools(server) {
  server.tool(
    'list_bills',
    'Daftar tagihan pay later (statement non-cicilan) yang belum lunas & sudah closing.',
    {},
    safeTool(async () => {
      const { accounts, transactions } = await client.bootstrap()
      const bills = getUnpaidStatements(accounts, transactions)
      if (!bills.length) return text('✅ Tidak ada tagihan pay later yang belum dibayar. Aman!')

      let out = '🧾 *Tagihan Pay Later Belum Lunas*\n'
      let total = 0
      for (const b of bills) {
        total += b.unpaid
        out += `\n• ${b.account.name} — ${periodLabel(b.period)}` +
          `\n  Tagihan: ${formatRupiah(b.unpaid)}` +
          (b.paid > 0 ? ` (sebagian sudah dibayar ${formatRupiah(b.paid)})` : '') +
          `\n  Jatuh tempo: ${formatDate(b.dueDate)}`
      }
      out += `\n———\nTotal: *${formatRupiah(total)}*`
      return text(out)
    })
  )

  server.tool(
    'list_installments',
    'Daftar cicilan aktif + termin berikutnya yang harus dibayar.',
    {},
    safeTool(async () => {
      const { accounts, installments } = await client.bootstrap()
      const pending = getPendingInstallments(installments, accounts)
      if (!pending.length) return text('✅ Tidak ada cicilan aktif yang perlu dibayar.')

      let out = '📆 *Cicilan Aktif*\n'
      let total = 0
      for (const p of pending) {
        total += p.amount
        out += `\n• ${p.installment.name} (${p.account?.name || '-'})` +
          `\n  Termin ${p.termin}/${p.installment.tenor}: ${formatRupiah(p.amount)}` +
          `\n  Jatuh tempo: ${formatDate(p.dueDate)}${p.isDue ? ' ⚠️ sudah jatuh tempo' : ''}`
      }
      out += `\n———\nTotal termin bulan ini: *${formatRupiah(total)}*`
      return text(out)
    })
  )

  server.tool(
    'pay_bill',
    'Bayar tagihan statement pay later. Uang keluar dari rekening cash ke akun pay later ' +
      '(mengurangi saldo cash & utang statement, tidak dihitung ulang sebagai pengeluaran).',
    {
      paylater: z.string().describe('Nama akun pay later yang tagihannya dibayar'),
      from: z.string().describe('Nama rekening cash sumber pembayaran'),
      amount: z.union([z.number(), z.string()]).optional()
        .describe('Jumlah bayar (default: total tagihan tertua yang belum lunas)'),
      date: z.string().optional().describe('Tanggal YYYY-MM-DD (default hari ini)'),
    },
    safeTool(async (a) => {
      const { accounts, transactions } = await client.bootstrap()
      const pl = resolveAccount(a.paylater, accounts, { paylaterOnly: true })
      const from = resolveAccount(a.from, accounts, { cashOnly: true })

      const bills = getUnpaidStatements(accounts, transactions).filter((b) => b.account.id === pl.id)
      if (!bills.length) return text(`✅ ${pl.name} tidak punya tagihan yang belum lunas.`)
      const target = bills[0] // tertua / paling dekat jatuh tempo

      const amount = a.amount ? parseAmount(a.amount) : target.unpaid
      if (!(amount > 0)) throw new Error('Jumlah bayar harus lebih dari 0.')
      const date = resolveDate(a.date)

      await client.post('/api/paylater/pay-statement', {
        paylaterAccountId: pl.id,
        fromAccountId: from.id,
        amount,
        date,
        statementPeriod: target.period,
      })
      client.invalidate()

      const fresh = await client.bootstrap(true)
      const bal = computeBalances(fresh.accounts, fresh.transactions)[from.id]
      return text(
        `✅ Bayar tagihan ${pl.name} (${periodLabel(target.period)}) ${formatRupiah(amount)} dari ${from.name}.` +
          `\nSaldo ${from.name} sekarang: ${formatRupiah(bal)}.`
      )
    })
  )

  server.tool(
    'pay_installment',
    'Bayar 1 termin cicilan. Uang keluar dari rekening cash (dihitung sebagai pengeluaran ' +
      'bulan ini) dan termin cicilan bertambah.',
    {
      installment: z.string().describe('Nama cicilan, mis. "iphone"'),
      from: z.string().describe('Nama rekening cash pembayar'),
      date: z.string().optional().describe('Tanggal YYYY-MM-DD (default hari ini)'),
    },
    safeTool(async (a) => {
      const { accounts, installments } = await client.bootstrap()
      const inst = resolveInstallment(a.installment, installments)
      const from = resolveAccount(a.from, accounts, { cashOnly: true })
      const date = resolveDate(a.date)

      const res = await client.post(`/api/installments/${inst.id}/pay`, {
        date,
        fromAccountId: from.id,
      })
      client.invalidate()

      const fresh = await client.bootstrap(true)
      const bal = computeBalances(fresh.accounts, fresh.transactions)[from.id]
      const termin = res.paidCount
      let line = `✅ Bayar cicilan ${inst.name} termin ${termin}/${inst.tenor} — ${formatRupiah(inst.monthlyAmount)} dari ${from.name}.`
      if (termin >= inst.tenor) line += `\n🎉 Cicilan ${inst.name} LUNAS!`
      line += `\nSaldo ${from.name} sekarang: ${formatRupiah(bal)}.`
      return text(line)
    })
  )
}
