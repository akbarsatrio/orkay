import { z } from 'zod'
import { client } from '../client.js'
import { resolveAccount } from '../resolve.js'
import { text, safeTool } from '../util.js'
import { formatRupiah } from '../format.js'
import {
  computeBalances,
  computePayLaterInfo,
  computeTotalDebt,
  computeNetWorth,
  computeInvestmentValue,
} from '../balances.js'
import { summarizeInvestment } from '../investment.js'

export function registerAccountTools(server) {
  server.tool(
    'get_balances',
    'Lihat saldo semua rekening cash + sisa limit tiap pay later.',
    {},
    safeTool(async () => {
      const { accounts, transactions, installments, investmentSnapshots = [] } = await client.bootstrap()
      const bals = computeBalances(accounts, transactions)
      const pl = computePayLaterInfo(accounts, transactions, installments)

      const cash = accounts.filter((a) => a.kind !== 'paylater' && a.kind !== 'investment')
      const paylater = accounts.filter((a) => a.kind === 'paylater')
      const investment = accounts.filter((a) => a.kind === 'investment')

      let out = '💰 *Saldo Rekening*\n'
      for (const a of cash) {
        out += `\n• ${a.name}: ${formatRupiah(bals[a.id] || 0)}`
      }
      if (investment.length) {
        out += '\n\n📈 *Investasi*'
        const byAcc = {}
        for (const s of investmentSnapshots) (byAcc[s.accountId] ||= []).push(s)
        for (const a of investment) {
          const sum = summarizeInvestment(byAcc[a.id] || [])
          const ret = sum.cumulativeReturn
          const sign = ret > 0 ? '+' : ret < 0 ? '−' : ''
          out += `\n• ${a.name}: ${formatRupiah(sum.marketValue)} (untung/rugi ${sign}${formatRupiah(Math.abs(ret))})`
        }
      }
      if (paylater.length) {
        out += '\n\n💳 *Pay Later*'
        for (const a of paylater) {
          const info = pl[a.id]
          out += `\n• ${a.name}: terpakai ${formatRupiah(info.used)} / limit ${formatRupiah(info.limit)} (sisa ${formatRupiah(info.available)})`
        }
      }
      return text(out)
    })
  )

  server.tool(
    'get_networth',
    'Total kekayaan bersih = total saldo cash + nilai investasi − total utang pay later.',
    {},
    safeTool(async () => {
      const { accounts, transactions, installments, investmentSnapshots = [] } = await client.bootstrap()
      const bals = computeBalances(accounts, transactions)
      const pl = computePayLaterInfo(accounts, transactions, installments)
      const totalDebt = computeTotalDebt(pl)
      const invValue = computeInvestmentValue(accounts, investmentSnapshots)
      const { cash, net } = computeNetWorth(bals, totalDebt, invValue)

      let out =
        '📊 *Kekayaan Bersih*\n' +
        `\nTotal saldo cash: ${formatRupiah(cash)}`
      if (invValue > 0) out += `\nNilai investasi: ${formatRupiah(invValue)}`
      out +=
        `\nTotal utang pay later: ${formatRupiah(totalDebt)}` +
        `\n———\nKekayaan bersih: *${formatRupiah(net)}*`
      return text(out)
    })
  )

  server.tool(
    'get_account',
    'Detail satu rekening: saldo (cash), limit & tagihan (pay later), atau nilai portfolio & untung/rugi (investasi).',
    {
      account: z.string().describe('Nama rekening'),
    },
    safeTool(async (a) => {
      const { accounts, transactions, installments, investmentSnapshots = [] } = await client.bootstrap()
      const acc = resolveAccount(a.account, accounts)
      if (acc.kind === 'investment') {
        const snaps = investmentSnapshots.filter((s) => s.accountId === acc.id)
        const sum = summarizeInvestment(snaps)
        const ret = sum.cumulativeReturn
        const sign = ret > 0 ? '+' : ret < 0 ? '−' : ''
        return text(
          `📈 *${acc.name}* (investasi)\n` +
            `\nNilai portfolio: ${formatRupiah(sum.marketValue)}` +
            `\nModal bersih (setor−tarik): ${formatRupiah(sum.netInvested)}` +
            `\nUntung/rugi: ${sign}${formatRupiah(Math.abs(ret))} (${sum.returnPct >= 0 ? '+' : ''}${sum.returnPct.toFixed(1)}%)` +
            `\nTotal biaya: fee ${formatRupiah(sum.totalFee)} · tax ${formatRupiah(sum.totalTax)}` +
            `\nJumlah catatan: ${sum.count}`
        )
      }
      if (acc.kind === 'paylater') {
        const info = computePayLaterInfo(accounts, transactions, installments)[acc.id]
        return text(
          `💳 *${acc.name}* (pay later)\n` +
            `\nLimit: ${formatRupiah(info.limit)}` +
            `\nTerpakai: ${formatRupiah(info.used)}` +
            `\nSisa limit: ${formatRupiah(info.available)}`
        )
      }
      const bal = computeBalances(accounts, transactions)[acc.id] || 0
      return text(`🏦 *${acc.name}*\n\nSaldo: ${formatRupiah(bal)}`)
    })
  )
}
