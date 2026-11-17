import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { wrap } from './helpers.js'

const router = Router()

const DEFAULTS = { payDay: 28, payDayShift: true, theme: 'light', currency: 'IDR' }

// payDayShift disimpan TINYINT di MySQL, dikirim ke client sebagai boolean.
export async function loadSettings() {
  const row = await queryOne('SELECT payDay, payDayShift, theme, currency FROM settings WHERE id = 1')
  return row ? { ...row, payDayShift: !!row.payDayShift } : { ...DEFAULTS }
}

router.get('/', wrap(async (req, res) => {
  res.json(await loadSettings())
}))

router.put('/', wrap(async (req, res) => {
  const merged = { ...(await loadSettings()), ...req.body }
  merged.payDay = Number(merged.payDay) || 28
  merged.payDayShift = !!merged.payDayShift
  await query('UPDATE settings SET payDay=:payDay, payDayShift=:payDayShift, theme=:theme, currency=:currency WHERE id=1', {
    payDay: merged.payDay, payDayShift: merged.payDayShift ? 1 : 0, theme: merged.theme, currency: merged.currency,
  })
  res.json(merged)
}))

export default router
