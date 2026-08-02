import { z } from 'zod'
import { client } from '../client.js'
import { resolveAccount, resolveCategory, resolveRecurring } from '../resolve.js'
import { text, safeTool, parseAmount } from '../util.js'
import { formatRupiah, formatDate, currentPeriod } from '../format.js'
import { recurringStatus, getPendingRecurring, dueDateFor } from '../recurring.js'

export function registerRecurringTools(server) {
  server.tool(
    'list_recurring',
    'Daftar langganan / tagihan rutin bulanan (Netflix, listrik, dll) + status bulan ini ' +
      '(sudah dikonfirmasi/dibayar atau belum).',
    {
      onlyPending: z.boolean().optional().describe('true = hanya yang belum dikonfirmasi bulan ini'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const rows = a.onlyPending
        ? getPendingRecurring(boot.recurring)
        : recurringStatus(boot.recurring)
      if (!rows.length) return text('Belum ada langganan/tagihan rutin.')

      const catName = (id) => boot.categories.find((c) => c.id === id)?.name
      const accName = (id) => boot.accounts.find((x) => x.id === id)?.name
      let out = '🔁 *Tagihan Rutin*\n'
      let totalPending = 0
      for (const r of rows) {
        const rec = r.recurring
        const status = r.confirmed ? '✅ sudah' : (r.isDue ? '⏰ belum (jatuh tempo)' : '🕒 belum')
        if (!r.confirmed) totalPending += rec.amount
        out += `\n• ${rec.name}: ${formatRupiah(rec.amount)} — tgl ${rec.dueDay}` +
          `${accName(rec.accountId) ? ` @ ${accName(rec.accountId)}` : ''}` +
          `${catName(rec.categoryId) ? ` [${catName(rec.categoryId)}]` : ''}` +
          `${rec.active ? '' : ' (nonaktif)'}` +
          `\n  ${status} — jatuh tempo ${formatDate(r.dueDate)}`
      }
      if (totalPending > 0) out += `\n———\nBelum dibayar bulan ini: *${formatRupiah(totalPending)}*`
      return text(out)
    })
  )

  server.tool(
    'add_recurring',
    'Buat langganan / tagihan rutin bulanan baru (mis. "Netflix 186rb tiap tanggal 5").',
    {
      name: z.string().describe('Nama tagihan, mis. "Netflix"'),
      amount: z.union([z.number(), z.string()]).describe('Nominal per bulan'),
      dueDay: z.number().describe('Tanggal jatuh tempo tiap bulan (1-31)'),
      category: z.string().optional().describe('Kategori pengeluaran'),
      account: z.string().optional().describe('Rekening pembayar default'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const amount = parseAmount(a.amount)
      if (!(amount > 0)) throw new Error('Nominal harus lebih dari 0.')
      const dueDay = Math.min(31, Math.max(1, Math.round(Number(a.dueDay) || 1)))
      const cat = a.category ? resolveCategory(a.category, boot.categories, 'expense') : null
      const acc = a.account ? resolveAccount(a.account, boot.accounts) : null

      const created = await client.post('/api/recurring', {
        name: a.name,
        amount,
        dueDay,
        categoryId: cat?.id ?? null,
        accountId: acc?.id ?? null,
        active: true,
      })
      client.invalidate()
      let line = `✅ Tagihan rutin dibuat: *${created.name}* ${formatRupiah(amount)}/bln, jatuh tempo tgl ${dueDay}.`
      if (acc) line += `\nRekening: ${acc.name}`
      if (cat) line += `\nKategori: ${cat.name}`
      return text(line)
    })
  )

  server.tool(
    'confirm_recurring',
    'Konfirmasi/bayar tagihan rutin untuk bulan ini — membuat transaksi pengeluaran & menandai ' +
      'periode bulan ini sudah dibayar. Pakai saat langganan sudah benar-benar dibayar.',
    {
      name: z.string().describe('Nama tagihan rutin yang mau dikonfirmasi'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const rec = resolveRecurring(a.name, boot.recurring)
      const period = currentPeriod()
      if ((rec.generatedPeriods || []).includes(period)) {
        return text(`${rec.name} sudah dikonfirmasi/dibayar untuk bulan ini.`)
      }
      const [y, m] = period.split('-').map(Number)
      const dueDate = dueDateFor(rec, y, m - 1)

      await client.post(`/api/recurring/${rec.id}/confirm`, { dueDate, period })
      client.invalidate()
      return text(`✅ ${rec.name} ${formatRupiah(rec.amount)} dikonfirmasi untuk bulan ini (dicatat sebagai pengeluaran ${formatDate(dueDate)}).`)
    })
  )

  server.tool(
    'update_recurring',
    'Ubah langganan/tagihan rutin (nominal, tanggal jatuh tempo, aktif/nonaktif). ' +
      'Hanya field yang diisi yang diubah.',
    {
      name: z.string().describe('Nama tagihan rutin yang mau diubah'),
      amount: z.union([z.number(), z.string()]).optional().describe('Nominal baru per bulan'),
      dueDay: z.number().optional().describe('Tanggal jatuh tempo baru (1-31)'),
      active: z.boolean().optional().describe('true=aktifkan, false=nonaktifkan'),
      category: z.string().optional().describe('Kategori baru'),
      account: z.string().optional().describe('Rekening baru'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const rec = resolveRecurring(a.name, boot.recurring)
      const patch = {}
      if (a.amount !== undefined) {
        const amt = parseAmount(a.amount)
        if (!(amt > 0)) throw new Error('Nominal harus lebih dari 0.')
        patch.amount = amt
      }
      if (a.dueDay !== undefined) patch.dueDay = Math.min(31, Math.max(1, Math.round(a.dueDay)))
      if (a.active !== undefined) patch.active = a.active
      if (a.category !== undefined) patch.categoryId = resolveCategory(a.category, boot.categories, 'expense').id
      if (a.account !== undefined) patch.accountId = resolveAccount(a.account, boot.accounts).id
      if (Object.keys(patch).length === 0) throw new Error('Tidak ada perubahan yang diberikan.')

      const updated = await client.put(`/api/recurring/${rec.id}`, patch)
      client.invalidate()
      return text(
        `✏️ Tagihan rutin diperbarui: *${updated.name}* ${formatRupiah(updated.amount)}/bln, ` +
          `tgl ${updated.dueDay}${updated.active ? '' : ' (nonaktif)'}.`
      )
    })
  )

  server.tool(
    'delete_recurring',
    'Hapus langganan/tagihan rutin. Konfirmasi dulu ke user sebelum menghapus.',
    {
      name: z.string().describe('Nama tagihan rutin yang mau dihapus'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const rec = resolveRecurring(a.name, boot.recurring)
      await client.del(`/api/recurring/${rec.id}`)
      client.invalidate()
      return text(`🗑️ Tagihan rutin "${rec.name}" dihapus.`)
    })
  )
}
