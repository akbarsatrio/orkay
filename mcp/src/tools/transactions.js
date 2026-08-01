import { z } from 'zod'
import { client } from '../client.js'
import { resolveAccount, resolveCategory, resolveIncomeSource } from '../resolve.js'
import { text, safeTool, parseAmount, resolveDate } from '../util.js'
import { formatRupiah, formatDate } from '../format.js'
import { computeBalances } from '../balances.js'

// Ringkas 1 transaksi jadi teks (buat daftar & konfirmasi edit/hapus).
function describeTx(tx, boot) {
  const accName = (id) => boot.accounts.find((a) => a.id === id)?.name || '-'
  const catName = (id) => boot.categories.find((c) => c.id === id)?.name || null
  const label =
    tx.type === 'income' ? 'Masuk' :
    tx.type === 'expense' ? 'Keluar' :
    tx.type === 'transfer' ? 'Transfer' :
    tx.type === 'installment' ? 'Beli cicilan' : tx.type
  let s = `${formatDate(tx.date)} — ${label} ${formatRupiah(tx.amount)}`
  if (tx.type === 'transfer') {
    s += ` (${accName(tx.fromAccountId)} → ${accName(tx.toAccountId)})`
  } else {
    s += ` @ ${accName(tx.accountId)}`
    const c = catName(tx.categoryId)
    if (c) s += ` [${c}]`
  }
  if (tx.note) s += ` — "${tx.note}"`
  s += `\n  id: ${tx.id}`
  return s
}

export function registerTransactionTools(server) {
  server.tool(
    'add_expense',
    'Catat pengeluaran (belanja/jajan). Uang keluar dari sebuah rekening. ' +
      'Untuk rekening pay later, ini dihitung sebagai charge (masuk tagihan statement).',
    {
      account: z.string().describe('Nama rekening sumber, mis. "gopay", "jago", atau nama pay later'),
      amount: z.union([z.number(), z.string()]).describe('Jumlah, mis. 25000, "25rb", "1,2jt"'),
      category: z.string().optional().describe('Nama kategori pengeluaran, mis. "makan"'),
      date: z.string().optional().describe('Tanggal YYYY-MM-DD (default hari ini)'),
      note: z.string().optional().describe('Catatan bebas'),
    },
    safeTool(async (a) => {
      const { accounts, categories } = await client.bootstrap()
      const acc = resolveAccount(a.account, accounts)
      const amount = parseAmount(a.amount)
      if (!(amount > 0)) throw new Error('Jumlah harus lebih dari 0.')
      const cat = a.category ? resolveCategory(a.category, categories, 'expense') : null
      const date = resolveDate(a.date)

      await client.post('/api/transactions', {
        type: 'expense',
        date,
        amount,
        accountId: acc.id,
        categoryId: cat?.id ?? null,
        note: a.note ?? null,
      })
      client.invalidate()

      const fresh = await client.bootstrap(true)
      let line = `✅ Pengeluaran ${formatRupiah(amount)} dicatat dari ${acc.name}`
      if (cat) line += ` (${cat.name})`
      line += ` — ${formatDate(date)}.`
      if (acc.kind !== 'paylater') {
        const bal = computeBalances(fresh.accounts, fresh.transactions)[acc.id]
        line += `\nSaldo ${acc.name} sekarang: ${formatRupiah(bal)}.`
      } else {
        line += `\n(Masuk tagihan pay later ${acc.name}.)`
      }
      return text(line)
    })
  )

  server.tool(
    'add_income',
    'Catat pemasukan (gaji, transferan masuk, dsb). Uang masuk ke sebuah rekening.',
    {
      account: z.string().describe('Nama rekening tujuan'),
      amount: z.union([z.number(), z.string()]).describe('Jumlah, mis. 5000000, "5jt"'),
      incomeSource: z.string().optional().describe('Nama sumber pemasukan'),
      date: z.string().optional().describe('Tanggal YYYY-MM-DD (default hari ini)'),
      note: z.string().optional().describe('Catatan bebas'),
    },
    safeTool(async (a) => {
      const { accounts, incomeSources } = await client.bootstrap()
      const acc = resolveAccount(a.account, accounts, { cashOnly: true })
      const amount = parseAmount(a.amount)
      if (!(amount > 0)) throw new Error('Jumlah harus lebih dari 0.')
      const src = a.incomeSource ? resolveIncomeSource(a.incomeSource, incomeSources) : null
      const date = resolveDate(a.date)

      await client.post('/api/transactions', {
        type: 'income',
        date,
        amount,
        accountId: acc.id,
        incomeSourceId: src?.id ?? null,
        note: a.note ?? null,
      })
      client.invalidate()

      const fresh = await client.bootstrap(true)
      const bal = computeBalances(fresh.accounts, fresh.transactions)[acc.id]
      let line = `✅ Pemasukan ${formatRupiah(amount)} dicatat ke ${acc.name}`
      if (src) line += ` (${src.name})`
      line += ` — ${formatDate(date)}.\nSaldo ${acc.name} sekarang: ${formatRupiah(bal)}.`
      return text(line)
    })
  )

  server.tool(
    'add_transfer',
    'Transfer/pindah uang antar rekening. Bisa dengan biaya admin (fee).',
    {
      from: z.string().describe('Nama rekening asal'),
      to: z.string().describe('Nama rekening tujuan'),
      amount: z.union([z.number(), z.string()]).describe('Jumlah transfer'),
      fee: z.union([z.number(), z.string()]).optional().describe('Biaya admin (opsional)'),
      date: z.string().optional().describe('Tanggal YYYY-MM-DD (default hari ini)'),
      note: z.string().optional().describe('Catatan bebas'),
    },
    safeTool(async (a) => {
      const { accounts } = await client.bootstrap()
      const from = resolveAccount(a.from, accounts)
      const to = resolveAccount(a.to, accounts)
      if (from.id === to.id) throw new Error('Rekening asal dan tujuan tidak boleh sama.')
      const amount = parseAmount(a.amount)
      if (!(amount > 0)) throw new Error('Jumlah transfer harus lebih dari 0.')
      const fee = a.fee ? parseAmount(a.fee) : 0
      const date = resolveDate(a.date)

      await client.post('/api/transactions', {
        type: 'transfer',
        date,
        amount,
        fromAccountId: from.id,
        toAccountId: to.id,
        fee,
        note: a.note ?? null,
      })
      client.invalidate()

      const fresh = await client.bootstrap(true)
      const bals = computeBalances(fresh.accounts, fresh.transactions)
      let line = `✅ Transfer ${formatRupiah(amount)} dari ${from.name} ke ${to.name}`
      if (fee > 0) line += ` (biaya ${formatRupiah(fee)})`
      line += ` — ${formatDate(date)}.`
      if (from.kind !== 'paylater') line += `\nSaldo ${from.name}: ${formatRupiah(bals[from.id])}.`
      if (to.kind !== 'paylater') line += `\nSaldo ${to.name}: ${formatRupiah(bals[to.id])}.`
      return text(line)
    })
  )

  server.tool(
    'list_recent_transactions',
    'Lihat transaksi terbaru (default 10, terurut terbaru dulu). Berguna untuk menemukan ' +
      'id transaksi sebelum mengedit/menghapus, atau mencari transaksi tertentu. ' +
      'Bisa difilter per rekening dan/atau kata kunci di catatan.',
    {
      limit: z.number().optional().describe('Jumlah transaksi (default 10, maks 30)'),
      account: z.string().optional().describe('Filter nama rekening'),
      query: z.string().optional().describe('Kata kunci pencarian di catatan (note)'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      let txs = [...boot.transactions] // sudah terurut date DESC dari API
      if (a.account) {
        const acc = resolveAccount(a.account, boot.accounts)
        txs = txs.filter(
          (t) => t.accountId === acc.id || t.fromAccountId === acc.id || t.toAccountId === acc.id
        )
      }
      if (a.query) {
        const q = a.query.toLowerCase()
        txs = txs.filter((t) => (t.note || '').toLowerCase().includes(q))
      }
      const limit = Math.min(30, Math.max(1, Number(a.limit) || 10))
      const rows = txs.slice(0, limit)
      if (!rows.length) return text('Tidak ada transaksi yang cocok.')
      const out = rows.map((t) => `• ${describeTx(t, boot)}`).join('\n')
      return text(`🧾 *Transaksi Terbaru* (${rows.length})\n\n${out}`)
    })
  )

  server.tool(
    'update_transaction',
    'Ubah/koreksi transaksi yang sudah ada berdasarkan id. Pakai ini untuk membetulkan ' +
      'nominal/kategori/catatan/tanggal yang salah — JANGAN membuat transaksi baru untuk koreksi. ' +
      'Cari id dulu via list_recent_transactions. Hanya field yang diisi yang diubah.',
    {
      id: z.string().describe('id transaksi (mis. dari list_recent_transactions)'),
      amount: z.union([z.number(), z.string()]).optional().describe('Nominal baru, mis. 30000, "30rb"'),
      category: z.string().optional().describe('Kategori baru (untuk income/expense)'),
      account: z.string().optional().describe('Rekening baru (untuk income/expense)'),
      date: z.string().optional().describe('Tanggal baru YYYY-MM-DD'),
      note: z.string().optional().describe('Catatan baru'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const existing = boot.transactions.find((t) => t.id === a.id)
      if (!existing) throw new Error(`Transaksi dengan id "${a.id}" tidak ditemukan. Cek dulu via list_recent_transactions.`)

      const patch = {}
      if (a.amount !== undefined) {
        const amt = parseAmount(a.amount)
        if (!(amt > 0)) throw new Error('Nominal harus lebih dari 0.')
        patch.amount = amt
      }
      if (a.note !== undefined) patch.note = a.note
      if (a.date !== undefined) patch.date = resolveDate(a.date)
      if (a.account !== undefined) {
        if (existing.type === 'transfer') throw new Error('Untuk transfer, ubah rekening tidak didukung lewat tool ini.')
        patch.accountId = resolveAccount(a.account, boot.accounts).id
      }
      if (a.category !== undefined) {
        const type = existing.type === 'income' ? 'income' : 'expense'
        patch.categoryId = resolveCategory(a.category, boot.categories, type).id
      }
      if (Object.keys(patch).length === 0) throw new Error('Tidak ada perubahan yang diberikan.')

      const updated = await client.put(`/api/transactions/${a.id}`, patch)
      client.invalidate()
      const fresh = await client.bootstrap(true)
      let line = `✏️ Transaksi diperbarui:\n${describeTx(updated, fresh)}`
      // tampilkan saldo terbaru rekening terkait (kalau cash)
      const bals = computeBalances(fresh.accounts, fresh.transactions)
      const acc = fresh.accounts.find((x) => x.id === updated.accountId)
      if (acc && acc.kind !== 'paylater') line += `\n\nSaldo ${acc.name}: ${formatRupiah(bals[acc.id])}.`
      return text(line)
    })
  )

  server.tool(
    'delete_transaction',
    'Hapus transaksi berdasarkan id (mis. salah catat/dobel). Cari id via list_recent_transactions dulu.',
    {
      id: z.string().describe('id transaksi yang akan dihapus'),
    },
    safeTool(async (a) => {
      const boot = await client.bootstrap()
      const existing = boot.transactions.find((t) => t.id === a.id)
      if (!existing) throw new Error(`Transaksi dengan id "${a.id}" tidak ditemukan.`)
      const desc = describeTx(existing, boot)

      await client.del(`/api/transactions/${a.id}`)
      client.invalidate()
      return text(`🗑️ Transaksi dihapus:\n${desc}`)
    })
  )
}
