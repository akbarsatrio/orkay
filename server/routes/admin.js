import { Router } from 'express'
import { withTransaction } from '../db.js'
import { wrap } from './helpers.js'

const router = Router()

// Destroy: hapus transaksi & budget, saldo awal rekening -> 0, reset histori recurring.
// Kategori, income source, rekening (nama/warna), dan settings TETAP.
router.post('/destroy', wrap(async (req, res) => {
  await withTransaction(async ({ run }) => {
    await run('DELETE FROM transactions')
    await run('DELETE FROM budgets')
    await run('UPDATE accounts SET openingBalance = 0')
    await run("UPDATE recurring SET generatedPeriods = '[]'")
  })
  res.json({ ok: true })
}))

export default router
