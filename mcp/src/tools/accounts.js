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
} from '../balances.js'

export function registerAccountTools(server) {
  server.tool(
    'get_balances',
    'Lihat saldo semua rekening cash + sisa limit tiap pay later.',
    {},
    safeTool(async () => {
      const { accounts, transactions, installments } = await client.bootstrap()
      const bals = computeBalances(accounts, transactions)
      const pl = computePayLaterInfo(accounts, transactions, installments)

      const cash = accounts.filter((a) => a.kind !== 'paylater')
      const paylater = accounts.filter((a) => a.kind === 'paylater')

      let out = '💰 *Saldo Rekening*\n'
      for (const a of cash) {
        out += `\n• ${a.name}: ${formatRupiah(bals[a.id] || 0)}`
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
    'Total kekayaan bersih = total saldo cash − total utang pay later.',
    {},
    safeTool(async () => {
      const { accounts, transactions, installments } = await client.bootstrap()
      const bals = computeBalances(accounts, transactions)
      const pl = computePayLaterInfo(accounts, transactions, installments)
      const totalDebt = computeTotalDebt(pl)
      const { cash, net } = computeNetWorth(bals, totalDebt)

      const out =
        '📊 *Kekayaan Bersih*\n' +
        `\nTotal saldo cash: ${formatRupiah(cash)}` +
        `\nTotal utang pay later: ${formatRupiah(totalDebt)}` +
        `\n———\nKekayaan bersih: *${formatRupiah(net)}*`
      return text(out)
    })
  )

  server.tool(
    'get_account',
    'Detail satu rekening: saldo (cash) atau limit & tagihan (pay later).',
    {
      account: z.string().describe('Nama rekening'),
    },
    safeTool(async (a) => {
      const { accounts, transactions, installments } = await client.bootstrap()
      const acc = resolveAccount(a.account, accounts)
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
