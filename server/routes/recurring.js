import { Router } from 'express'
import { query, queryOne, withTransaction, parseRecurring, serializeRecurring } from '../db.js'
import { uid, wrap } from './helpers.js'
import { normalizeTx } from '../seed.js'
import { TX_INSERT_SQL } from './transactions.js'

const router = Router()

const INSERT_SQL = 'INSERT INTO recurring (id,name,categoryId,accountId,amount,dueDay,active,generatedPeriods) VALUES (:id,:name,:categoryId,:accountId,:amount,:dueDay,:active,:generatedPeriods)'
const UPDATE_SQL = 'UPDATE recurring SET name=:name, categoryId=:categoryId, accountId=:accountId, amount=:amount, dueDay=:dueDay, active=:active, generatedPeriods=:generatedPeriods WHERE id=:id'

router.get('/', wrap(async (req, res) => {
  const rows = await query('SELECT * FROM recurring')
  res.json(rows.map(parseRecurring))
}))

router.post('/', wrap(async (req, res) => {
  const { name, categoryId, accountId, amount, dueDay, active } = req.body
  const item = {
    id: uid('rec'), name, categoryId: categoryId ?? null, accountId: accountId ?? null,
    amount: Number(amount) || 0, dueDay: Number(dueDay) || 1,
    active: active === undefined ? true : !!active, generatedPeriods: [],
  }
  await query(INSERT_SQL, serializeRecurring(item))
  res.status(201).json(item)
}))

router.put('/:id', wrap(async (req, res) => {
  const existing = parseRecurring(await queryOne('SELECT * FROM recurring WHERE id = :id', { id: req.params.id }))
  if (!existing) return res.status(404).json({ error: 'not found' })
  const merged = { ...existing, ...req.body, id: existing.id }
  merged.amount = Number(merged.amount) || 0
  merged.dueDay = Number(merged.dueDay) || 1
  await query(UPDATE_SQL, serializeRecurring(merged))
  res.json(merged)
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM recurring WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

// Konfirmasi: buat transaksi + tandai periode sudah digenerate (1 DB transaction)
router.post('/:id/confirm', wrap(async (req, res) => {
  const { dueDate, period } = req.body
  const rec = parseRecurring(await queryOne('SELECT * FROM recurring WHERE id = :id', { id: req.params.id }))
  if (!rec) return res.status(404).json({ error: 'not found' })
  if ((rec.generatedPeriods || []).includes(period)) {
    return res.status(409).json({ error: 'periode ini sudah dikonfirmasi' })
  }

  const tx = normalizeTx({
    id: uid('tx'), type: 'expense', date: dueDate, amount: rec.amount,
    categoryId: rec.categoryId, accountId: rec.accountId,
    note: rec.name + ' (recurring)', recurringId: rec.id,
  })
  const updated = { ...rec, generatedPeriods: [...(rec.generatedPeriods || []), period] }

  await withTransaction(async ({ run }) => {
    await run(TX_INSERT_SQL, tx)
    await run('UPDATE recurring SET generatedPeriods=:generatedPeriods WHERE id=:id', {
      generatedPeriods: JSON.stringify(updated.generatedPeriods), id: rec.id,
    })
  })

  res.json({ transaction: tx, recurring: updated })
}))

export default router
