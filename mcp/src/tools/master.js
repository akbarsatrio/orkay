import { z } from 'zod'
import { client } from '../client.js'
import { text, safeTool } from '../util.js'

export function registerMasterTools(server) {
  server.tool(
    'list_categories',
    'Daftar kategori. Bisa difilter tipe pengeluaran/pemasukan.',
    {
      type: z.enum(['expense', 'income']).optional().describe('Filter tipe kategori'),
    },
    safeTool(async (a) => {
      const { categories } = await client.bootstrap()
      const rows = a.type ? categories.filter((c) => c.type === a.type) : categories
      if (!rows.length) return text('Belum ada kategori.')
      const exp = rows.filter((c) => c.type === 'expense').map((c) => c.name)
      const inc = rows.filter((c) => c.type === 'income').map((c) => c.name)
      let out = '🏷️ *Kategori*'
      if (exp.length) out += `\n\nPengeluaran: ${exp.join(', ')}`
      if (inc.length) out += `\n\nPemasukan: ${inc.join(', ')}`
      return text(out)
    })
  )

  server.tool(
    'list_accounts',
    'Daftar semua rekening + jenisnya (cash / pay later).',
    {},
    safeTool(async () => {
      const { accounts } = await client.bootstrap()
      if (!accounts.length) return text('Belum ada rekening.')
      let out = '🏦 *Rekening*'
      const cash = accounts.filter((a) => a.kind !== 'paylater').map((a) => a.name)
      const pl = accounts.filter((a) => a.kind === 'paylater').map((a) => a.name)
      if (cash.length) out += `\n\nCash: ${cash.join(', ')}`
      if (pl.length) out += `\n\nPay Later: ${pl.join(', ')}`
      return text(out)
    })
  )

  server.tool(
    'add_category',
    'Buat kategori baru (mis. saat menemukan kategori pengeluaran yang belum ada).',
    {
      name: z.string().describe('Nama kategori'),
      type: z.enum(['expense', 'income']).describe('Tipe kategori'),
      icon: z.string().optional().describe('Nama ikon (opsional)'),
      color: z.string().optional().describe('Warna hex (opsional)'),
    },
    safeTool(async (a) => {
      const { categories } = await client.bootstrap()
      const exists = categories.find(
        (c) => c.type === a.type && c.name.toLowerCase() === a.name.toLowerCase()
      )
      if (exists) return text(`Kategori "${exists.name}" (${a.type}) sudah ada.`)

      const created = await client.post('/api/categories', {
        name: a.name,
        type: a.type,
        icon: a.icon ?? null,
        color: a.color ?? null,
      })
      client.invalidate()
      return text(`✅ Kategori "${created.name}" (${a.type}) dibuat.`)
    })
  )
}
