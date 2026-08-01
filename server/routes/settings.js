import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { wrap } from './helpers.js'

const router = Router()

router.get('/', wrap(async (req, res) => {
  const row = await queryOne('SELECT payDay, theme, currency FROM settings WHERE id = 1')
  res.json(row || { payDay: 28, theme: 'light', currency: 'IDR' })
}))

router.put('/', wrap(async (req, res) => {
  const existing = await queryOne('SELECT payDay, theme, currency FROM settings WHERE id = 1')
  const merged = { ...(existing || { payDay: 28, theme: 'light', currency: 'IDR' }), ...req.body }
  merged.payDay = Number(merged.payDay) || 28
  await query('UPDATE settings SET payDay=:payDay, theme=:theme, currency=:currency WHERE id=1', {
    payDay: merged.payDay, theme: merged.theme, currency: merged.currency,
  })
  res.json(merged)
}))

export default router
