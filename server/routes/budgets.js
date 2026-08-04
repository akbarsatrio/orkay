import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { uid, wrap } from './helpers.js'

const router = Router()

router.get('/', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM budgets'))
}))

// Upsert by categoryId (satu kategori satu budget).
// Atomik via UNIQUE(categoryId) + ON DUPLICATE KEY UPDATE (bebas race check-then-insert).
router.post('/', wrap(async (req, res) => {
  const { categoryId, limit } = req.body
  if (!categoryId || !(Number(limit) > 0)) return res.status(400).json({ error: 'categoryId & limit wajib' })
  const lim = Number(limit)
  await query(
    'INSERT INTO budgets (id,categoryId,`limit`) VALUES (:id,:categoryId,:limit) ON DUPLICATE KEY UPDATE `limit`=:limit',
    { id: uid('bud'), categoryId, limit: lim }
  )
  // Ambil ulang untuk dapat id yang benar (bisa row lama saat update).
  const item = await queryOne('SELECT * FROM budgets WHERE categoryId = :categoryId', { categoryId })
  res.status(201).json(item)
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM budgets WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

export default router
