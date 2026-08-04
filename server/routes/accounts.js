import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { uid, wrap } from './helpers.js'

const router = Router()

const INSERT_SQL = `INSERT INTO accounts
  (id,name,type,openingBalance,color,icon,kind,creditLimit,closingDay,dueDay,dueMonthOffset,billingModel)
  VALUES (:id,:name,:type,:openingBalance,:color,:icon,:kind,:creditLimit,:closingDay,:dueDay,:dueMonthOffset,:billingModel)`

const UPDATE_SQL = `UPDATE accounts SET
  name=:name, type=:type, openingBalance=:openingBalance, color=:color, icon=:icon,
  kind=:kind, creditLimit=:creditLimit, closingDay=:closingDay, dueDay=:dueDay, dueMonthOffset=:dueMonthOffset,
  billingModel=:billingModel
  WHERE id=:id`

function normalizeAccount(a) {
  const kind = a.kind === 'paylater' ? 'paylater' : 'cash'
  // billingModel: 'anniversary' (jatuh tempo = tgl beli + N bulan) atau 'statement' (default).
  const billingModel = a.billingModel === 'anniversary' ? 'anniversary' : 'statement'
  return {
    id: a.id,
    name: a.name,
    type: a.type ?? null,
    openingBalance: Number(a.openingBalance) || 0,
    color: a.color ?? null,
    icon: a.icon ?? null,
    kind,
    creditLimit: Number(a.creditLimit) || 0,
    closingDay: Math.min(31, Math.max(1, Number(a.closingDay) || 1)),
    dueDay: Math.min(31, Math.max(1, Number(a.dueDay) || 1)),
    dueMonthOffset: Math.max(0, Number(a.dueMonthOffset ?? 1)),
    billingModel,
  }
}

router.get('/', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM accounts'))
}))

router.post('/', wrap(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) return res.status(400).json({ error: 'name wajib' })
  const item = normalizeAccount({ ...req.body, id: uid('acc') })
  await query(INSERT_SQL, item)
  res.status(201).json(item)
}))

router.put('/:id', wrap(async (req, res) => {
  const existing = await queryOne('SELECT * FROM accounts WHERE id = :id', { id: req.params.id })
  if (!existing) return res.status(404).json({ error: 'not found' })
  const item = normalizeAccount({ ...existing, ...req.body, id: existing.id })
  await query(UPDATE_SQL, item)
  res.json(item)
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM accounts WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

export default router
