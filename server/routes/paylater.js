import { Router } from 'express'
import { queryOne, withTransaction } from '../db.js'
import { uid, wrap } from './helpers.js'
import { normalizeTx } from '../seed.js'
import { TX_INSERT_SQL } from './transactions.js'

const router = Router()

// Bayar tagihan statement pay later (charge langsung, non-cicilan).
// = transfer dari rekening cash -> akun paylater. Mengurangi cash & utang statement.
// TIDAK dihitung sebagai expense (charge sudah dihitung saat transaksi belanja terjadi).
router.post('/pay-statement', wrap(async (req, res) => {
  const { paylaterAccountId, fromAccountId, amount, date, statementPeriod } = req.body
  if (!paylaterAccountId || !fromAccountId) return res.status(400).json({ error: 'paylaterAccountId & fromAccountId wajib' })
  if (!(Number(amount) > 0)) return res.status(400).json({ error: 'amount wajib' })
  if (!date) return res.status(400).json({ error: 'date wajib' })
  if (fromAccountId === paylaterAccountId) return res.status(400).json({ error: 'rekening asal dan tujuan tidak boleh sama' })

  const pl = await queryOne('SELECT * FROM accounts WHERE id = :id', { id: paylaterAccountId })
  if (!pl) return res.status(404).json({ error: 'akun paylater tidak ditemukan' })

  const tx = normalizeTx({
    id: uid('tx'),
    type: 'transfer',
    date,
    amount: Number(amount),
    fromAccountId,
    toAccountId: paylaterAccountId,
    note: `Bayar tagihan ${pl.name}` + (statementPeriod ? ` (${statementPeriod})` : ''),
    statementPeriod: statementPeriod || null,
  })

  await withTransaction(async ({ run }) => {
    await run(TX_INSERT_SQL, tx)
  })

  res.json({ transaction: tx })
}))

export default router
