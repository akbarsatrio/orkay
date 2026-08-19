import { z } from 'zod'
import { client } from '../client.js'
import { resolveAccount } from '../resolve.js'
import { text, safeTool, parseAmount, resolveDate } from '../util.js'
import { formatRupiah, formatDate } from '../format.js'
import { summarizeInvestment, computeSnapshotSeries } from '../investment.js'
import { computeBalances } from '../balances.js'

// Ringkas satu snapshot jadi baris teks.
function describeSnap(s) {
  const isW = s.withdrawal > 0
  const label = isW ? `Tarik ${formatRupiah(s.withdrawal)}` : s.contribution > 0 ? `Setor ${formatRupiah(s.contribution)}` : 'Update nilai'
  let line = `${formatDate(s.date)} — ${label} · nilai ${formatRupiah(s.marketValue)}`
  if (s.fee > 0 || s.tax > 0) line += ` · biaya ${formatRupiah((s.fee || 0) + (s.tax || 0))}`
  if (s.note) line += ` — "${s.note}"`
  line += `\n  id: ${s.id}`
  return line
}

export function registerInvestmentTools(server) {
  // ---- Ringkasan seluruh portfolio ----
  server.tool(
    'get_investments',
    'Ringkasan seluruh rekening investasi: nilai portfolio, modal bersih, untung/rugi (mark-to-market), dan biaya. ' +
      'Untung/rugi dihitung dari selisih nilai pasar, BUKAN bunga.',
    {},
    safeTool(async () => {
      const { accounts, investmentSnapshots = [] } = await client.bootstrap()
      const invAccounts = accounts.filter((a) => a.kind === 'investment')
      if (!invAccounts.length) return text('Belum ada rekening investasi. Buat rekening tipe investasi dulu di web app.')

      const byAcc = {}
      for (const s of investmentSnapshots) (byAcc[s.accountId] ||= []).push(s)

      let tMarket = 0, tNet = 0, tRet = 0, tFee = 0, tTax = 0
      let out = '📈 *Portfolio Investasi*\n'
      for (const a of invAccounts) {
        const sum = summarizeInvestment(byAcc[a.id] || [])
        tMarket += sum.marketValue; tNet += sum.netInvested; tRet += sum.cumulativeReturn
        tFee += sum.totalFee; tTax += sum.totalTax
        const sign = sum.cumulativeReturn > 0 ? '+' : sum.cumulativeReturn < 0 ? '−' : ''
        out += `\n• ${a.name}: ${formatRupiah(sum.marketValue)} ` +
          `(u/r ${sign}${formatRupiah(Math.abs(sum.cumulativeReturn))}, ${sum.returnPct >= 0 ? '+' : ''}${sum.returnPct.toFixed(1)}%)`
      }
      const sign = tRet > 0 ? '+' : tRet < 0 ? '−' : ''
      const totalPct = tNet > 0 ? (tRet / tNet) * 100 : 0
      out += `\n———` +
        `\nTotal nilai: *${formatRupiah(tMarket)}*` +
        `\nModal bersih: ${formatRupiah(tNet)}` +
        `\nUntung/rugi: ${sign}${formatRupiah(Math.abs(tRet))} (${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(1)}%)`
      if (tFee + tTax > 0) out += `\nTotal biaya: ${formatRupiah(tFee + tTax)} (fee ${formatRupiah(tFee)} · tax ${formatRupiah(tTax)})`
      return text(out)
    })
  )

  // ---- Riwayat catatan sebuah akun investasi ----
  server.tool(
    'list_investment_records',
    'Lihat riwayat catatan periode sebuah rekening investasi (setoran/tarikan/update nilai) beserta untung/rugi tiap periode. ' +
      'Berguna untuk menemukan id catatan.',
    {
      account: z.string().describe('Nama rekening investasi'),
      limit: z.number().optional().describe('Jumlah catatan terbaru (default 12, maks 30)'),
    },
    safeTool(async (a) => {
      const { accounts, investmentSnapshots = [] } = await client.bootstrap()
      const acc = resolveAccount(a.account, accounts, { investmentOnly: true })
      const snaps = investmentSnapshots.filter((s) => s.accountId === acc.id)
      if (!snaps.length) return text(`${acc.name} belum punya catatan. Tambahkan setoran periode pertama.`)
      const series = computeSnapshotSeries(snaps).reverse()
      const limit = Math.min(30, Math.max(1, Number(a.limit) || 12))
      const rows = series.slice(0, limit)
      const out = rows.map((s) => {
        const rn = s.returnNet || 0
        const rsign = rn > 0 ? '+' : rn < 0 ? '−' : ''
        const retStr = rn === 0 ? '—' : `${rsign}${formatRupiah(Math.abs(rn))}`
        return `• ${describeSnap(s)}\n  untung/rugi periode: ${retStr}`
      }).join('\n')
      return text(`📈 *Catatan ${acc.name}* (${rows.length})\n\n${out}`)
    })
  )

  // ---- Setor ----
  server.tool(
    'invest_deposit',
    'Setor (top up) ke rekening investasi dari sebuah rekening cash. Otomatis mengurangi saldo cash & mencatat transfer. ' +
      'Isi "marketValue" dengan nilai portfolio TERKINI dari bursa bila diketahui; kalau tidak, dihitung otomatis (setoran + nilai sebelumnya).',
    {
      account: z.string().describe('Nama rekening investasi tujuan'),
      from: z.string().describe('Nama rekening cash sumber dana'),
      amount: z.union([z.number(), z.string()]).describe('Jumlah setoran, mis. 1000000, "1jt"'),
      marketValue: z.union([z.number(), z.string()]).optional().describe('Nilai portfolio terkini dari bursa (opsional)'),
      date: z.string().optional().describe('Tanggal YYYY-MM-DD (default hari ini)'),
      note: z.string().optional().describe('Catatan bebas'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const acc = resolveAccount(a.account, boot.accounts, { investmentOnly: true })
      const cash = resolveAccount(a.from, boot.accounts, { cashOnly: true })
      const amount = parseAmount(a.amount)
      if (!(amount > 0)) throw new Error('Jumlah setoran harus lebih dari 0.')
      const date = resolveDate(a.date)

      // Baseline nilai portfolio = nilai terakhir + setoran (kalau user tak isi).
      const snaps = boot.investmentSnapshots?.filter((s) => s.accountId === acc.id) || []
      const series = computeSnapshotSeries(snaps)
      const prev = series.length ? Number(series[series.length - 1].marketValue) || 0 : 0
      const marketValue = a.marketValue !== undefined ? parseAmount(a.marketValue) : prev + amount

      await client.post('/api/investments', {
        accountId: acc.id,
        cashAccountId: cash.id,
        date,
        contribution: amount,
        withdrawal: 0,
        marketValue,
        note: a.note ?? null,
      })
      client.invalidate()

      const fresh = await client.bootstrap(true)
      const bal = computeBalances(fresh.accounts, fresh.transactions)[cash.id]
      const sum = summarizeInvestment((fresh.investmentSnapshots || []).filter((s) => s.accountId === acc.id))
      return text(
        `✅ Setor ${formatRupiah(amount)} ke ${acc.name} dari ${cash.name} — ${formatDate(date)}.` +
          `\nSaldo ${cash.name}: ${formatRupiah(bal)}.` +
          `\nNilai portfolio ${acc.name}: ${formatRupiah(sum.marketValue)}.`
      )
    })
  )

  // ---- Tarik ----
  server.tool(
    'invest_withdraw',
    'Tarik dana dari rekening investasi ke rekening cash. "amount" = jumlah kotor yang keluar dari portfolio. ' +
      'Fee & pajak (opsional) dipotong dari yang diterima; yang masuk ke cash = kotor − fee − pajak.',
    {
      account: z.string().describe('Nama rekening investasi sumber'),
      to: z.string().describe('Nama rekening cash tujuan dana'),
      amount: z.union([z.number(), z.string()]).describe('Jumlah tarikan kotor (yang keluar dari portfolio)'),
      fee: z.union([z.number(), z.string()]).optional().describe('Biaya admin, nominal Rp (opsional)'),
      tax: z.union([z.number(), z.string()]).optional().describe('Pajak, nominal Rp (opsional)'),
      marketValue: z.union([z.number(), z.string()]).optional().describe('Nilai portfolio terkini dari bursa (opsional)'),
      date: z.string().optional().describe('Tanggal YYYY-MM-DD (default hari ini)'),
      note: z.string().optional().describe('Catatan bebas'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const acc = resolveAccount(a.account, boot.accounts, { investmentOnly: true })
      const cash = resolveAccount(a.to, boot.accounts, { cashOnly: true })
      const amount = parseAmount(a.amount)
      if (!(amount > 0)) throw new Error('Jumlah tarikan harus lebih dari 0.')
      const fee = a.fee ? parseAmount(a.fee) : 0
      const tax = a.tax ? parseAmount(a.tax) : 0
      const date = resolveDate(a.date)

      const snaps = boot.investmentSnapshots?.filter((s) => s.accountId === acc.id) || []
      const series = computeSnapshotSeries(snaps)
      const prev = series.length ? Number(series[series.length - 1].marketValue) || 0 : 0
      const marketValue = a.marketValue !== undefined ? parseAmount(a.marketValue) : Math.max(0, prev - amount)

      await client.post('/api/investments', {
        accountId: acc.id,
        cashAccountId: cash.id,
        date,
        contribution: 0,
        withdrawal: amount,
        fee,
        tax,
        marketValue,
        note: a.note ?? null,
      })
      client.invalidate()

      const fresh = await client.bootstrap(true)
      const bal = computeBalances(fresh.accounts, fresh.transactions)[cash.id]
      const received = Math.max(0, amount - fee - tax)
      const sum = summarizeInvestment((fresh.investmentSnapshots || []).filter((s) => s.accountId === acc.id))
      let line = `✅ Tarik ${formatRupiah(amount)} dari ${acc.name} ke ${cash.name} — ${formatDate(date)}.`
      if (fee + tax > 0) line += `\nBiaya: fee ${formatRupiah(fee)} + pajak ${formatRupiah(tax)} → diterima ${formatRupiah(received)}.`
      line += `\nSaldo ${cash.name}: ${formatRupiah(bal)}.\nNilai portfolio ${acc.name}: ${formatRupiah(sum.marketValue)}.`
      return text(line)
    })
  )

  // ---- Update nilai portfolio (mark-to-market, tanpa uang bergerak) ----
  server.tool(
    'invest_update_value',
    'Perbarui nilai portfolio terkini sebuah rekening investasi (mark-to-market) tanpa setor/tarik. ' +
      'Selisih dari nilai sebelumnya menjadi untung/rugi pasar. Tidak menyentuh saldo cash.',
    {
      account: z.string().describe('Nama rekening investasi'),
      marketValue: z.union([z.number(), z.string()]).describe('Nilai portfolio terkini dari bursa'),
      date: z.string().optional().describe('Tanggal YYYY-MM-DD (default hari ini)'),
      note: z.string().optional().describe('Catatan bebas'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const acc = resolveAccount(a.account, boot.accounts, { investmentOnly: true })
      const marketValue = parseAmount(a.marketValue)
      if (!(marketValue >= 0)) throw new Error('Nilai portfolio tidak valid.')
      const date = resolveDate(a.date)

      await client.post('/api/investments', {
        accountId: acc.id,
        cashAccountId: null,
        date,
        contribution: 0,
        withdrawal: 0,
        marketValue,
        note: a.note ?? null,
      })
      client.invalidate()

      const fresh = await client.bootstrap(true)
      const sum = summarizeInvestment((fresh.investmentSnapshots || []).filter((s) => s.accountId === acc.id))
      const ret = sum.cumulativeReturn
      const sign = ret > 0 ? '+' : ret < 0 ? '−' : ''
      return text(
        `✅ Nilai ${acc.name} diperbarui jadi ${formatRupiah(marketValue)} — ${formatDate(date)}.` +
          `\nTotal untung/rugi: ${sign}${formatRupiah(Math.abs(ret))} (${sum.returnPct >= 0 ? '+' : ''}${sum.returnPct.toFixed(1)}%).`
      )
    })
  )

  // ---- Hapus catatan ----
  server.tool(
    'delete_investment_record',
    'Hapus satu catatan periode investasi berdasarkan id (transfer cash terkait, bila ada, ikut terhapus). ' +
      'Cari id via list_investment_records dulu. Konfirmasi ke user sebelum menghapus.',
    {
      id: z.string().describe('id catatan investasi (mis. dari list_investment_records)'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const snap = (boot.investmentSnapshots || []).find((s) => s.id === a.id)
      if (!snap) throw new Error(`Catatan investasi "${a.id}" tidak ditemukan. Cek via list_investment_records.`)
      await client.del(`/api/investments/${a.id}`)
      client.invalidate()
      return text(`🗑️ Catatan investasi dihapus:\n${describeSnap(snap)}`)
    })
  )
}
