import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { uid, wrap } from './helpers.js'

const router = Router()

router.get('/', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM categories'))
}))

router.post('/', wrap(async (req, res) => {
  const { name, type, icon, color } = req.body
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name wajib' })
  const item = { id: uid('cat'), name, type, icon: icon ?? null, color: color ?? null }
  await query('INSERT INTO categories (id,name,type,icon,color) VALUES (:id,:name,:type,:icon,:color)', item)
  res.status(201).json(item)
}))

router.put('/:id', wrap(async (req, res) => {
  const existing = await queryOne('SELECT * FROM categories WHERE id = :id', { id: req.params.id })
  if (!existing) return res.status(404).json({ error: 'not found' })
  const merged = { ...existing, ...req.body, id: existing.id }
  await query('UPDATE categories SET name=:name, type=:type, icon=:icon, color=:color WHERE id=:id', {
    name: merged.name, type: merged.type, icon: merged.icon ?? null, color: merged.color ?? null, id: merged.id,
  })
  res.json(merged)
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM categories WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

export default router
