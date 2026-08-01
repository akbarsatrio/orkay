import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { uid, wrap } from './helpers.js'

const router = Router()

router.get('/', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM income_sources'))
}))

router.post('/', wrap(async (req, res) => {
  const { name, color } = req.body
  const item = { id: uid('inc'), name, color: color ?? null }
  await query('INSERT INTO income_sources (id,name,color) VALUES (:id,:name,:color)', item)
  res.status(201).json(item)
}))

router.put('/:id', wrap(async (req, res) => {
  const existing = await queryOne('SELECT * FROM income_sources WHERE id = :id', { id: req.params.id })
  if (!existing) return res.status(404).json({ error: 'not found' })
  const merged = { ...existing, ...req.body, id: existing.id }
  await query('UPDATE income_sources SET name=:name, color=:color WHERE id=:id', {
    name: merged.name, color: merged.color ?? null, id: merged.id,
  })
  res.json(merged)
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM income_sources WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

export default router
