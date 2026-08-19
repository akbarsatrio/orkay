import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { uid, wrap } from './helpers.js'
import { computeFee, computeTax } from '../lib/investment.js'

const router = Router()

const INSERT_SQL = `INSERT INTO investment_snapshots
  (id,accountId,date,contribution,withdrawal,fee,tax,marketValue,note)
  VALUES (:id,:accountId,:date,:contribution,:withdrawal,:fee,:tax,:marketValue,:note)`

const UPDATE_SQL = `UPDATE investment_snapshots SET
  accountId=:accountId, date=:date, contribution=:contribution, withdrawal=:withdrawal,
  fee=:fee, tax=:tax, marketValue=:marketValue, note=:note
  WHERE id=:id`

// Terima input mentah dari client. Fee & tax bisa dikirim:
//  - sudah jadi angka (fee/tax), ATAU
//  - sebagai config { feeInput:{enabled,mode,value}, taxInput:{enabled,mode,value,basis} }
// Server yang hitung angka finalnya biar konsisten dengan rumus.
function normalizeSnapshot(s) {
  const withdrawal = Math.max(0, Number(s.withdrawal) || 0)

  let fee = Math.max(0, Number(s.fee) || 0)
  let tax = Math.max(0, Number(s.tax) || 0)

  if (s.feeInput) fee = computeFee(s.feeInput, withdrawal)
  if (s.taxInput) tax = computeTax(s.taxInput, withdrawal, fee)

  // Fee/tax hanya relevan saat ada tarikan.
  if (withdrawal <= 0) {
    fee = 0
    tax = 0
  }

  return {
    id: s.id,
    accountId: s.accountId,
    date: s.date,
    contribution: Math.max(0, Number(s.contribution) || 0),
    withdrawal,
    fee,
    tax,
    marketValue: Math.max(0, Number(s.marketValue) || 0),
    note: s.note ?? null,
  }
}

router.get('/', wrap(async (req, res) => {
  const rows = await query('SELECT * FROM investment_snapshots ORDER BY date ASC, id ASC')
  res.json(rows)
}))

router.post('/', wrap(async (req, res) => {
  const item = normalizeSnapshot({ ...req.body, id: uid('snap') })
  if (!item.accountId) return res.status(400).json({ error: 'accountId wajib' })
  if (!item.date) return res.status(400).json({ error: 'date wajib' })
  // Minimal salah satu harus terisi biar snapshot bermakna.
  if (item.contribution <= 0 && item.withdrawal <= 0 && item.marketValue <= 0) {
    return res.status(400).json({ error: 'isi minimal setoran, tarikan, atau nilai portfolio' })
  }
  await query(INSERT_SQL, item)
  res.status(201).json(item)
}))

router.put('/:id', wrap(async (req, res) => {
  const existing = await queryOne('SELECT * FROM investment_snapshots WHERE id = :id', { id: req.params.id })
  if (!existing) return res.status(404).json({ error: 'not found' })
  const item = normalizeSnapshot({ ...existing, ...req.body, id: existing.id })
  await query(UPDATE_SQL, item)
  res.json(item)
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM investment_snapshots WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

export default router
