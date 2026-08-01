import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { uid, wrap } from './helpers.js'

const router = Router()

router.get('/', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM budgets'))
}))

// Upsert by categoryId (satu kategori satu budget)
router.post('/', wrap(async (req, res) => {
  const { categoryId, limit } = req.body
  if (!categoryId || !(Number(limit) > 0)) return res.status(400).json({ error: 'categoryId & limit wajib' })
  const existing = await queryOne('SELECT * FROM budgets WHERE categoryId = :categoryId', { categoryId })
  if (existing) {
    await query('UPDATE budgets SET `limit`=:limit WHERE id=:id', { limit: Number(limit), id: existing.id })
    return res.json({ ...existing, limit: Number(limit) })
  }
  const item = { id: uid('bud'), categoryId, limit: Number(limit) }
  await query('INSERT INTO budgets (id,categoryId,`limit`) VALUES (:id,:categoryId,:limit)', item)
  res.status(201).json(item)
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM budgets WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

export default router
