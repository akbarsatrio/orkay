import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { uid, wrap } from './helpers.js'
import { normalizeTx } from '../seed.js'

const router = Router()

const INSERT_SQL = `INSERT INTO transactions
  (id,type,date,amount,categoryId,accountId,incomeSourceId,fromAccountId,toAccountId,fee,feeCategoryId,recurringId,installmentId,statementPeriod,note)
  VALUES (:id,:type,:date,:amount,:categoryId,:accountId,:incomeSourceId,:fromAccountId,:toAccountId,:fee,:feeCategoryId,:recurringId,:installmentId,:statementPeriod,:note)`

const UPDATE_SQL = `UPDATE transactions SET
  type=:type, date=:date, amount=:amount, categoryId=:categoryId, accountId=:accountId,
  incomeSourceId=:incomeSourceId, fromAccountId=:fromAccountId, toAccountId=:toAccountId,
  fee=:fee, feeCategoryId=:feeCategoryId, recurringId=:recurringId,
  installmentId=:installmentId, statementPeriod=:statementPeriod, note=:note
  WHERE id=:id`

// Ambil kind beberapa akun sekaligus -> { id: kind }
async function kindMap(ids) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return {}
  const placeholders = uniq.map((_, i) => `:id${i}`).join(',')
  const params = Object.fromEntries(uniq.map((id, i) => [`id${i}`, id]))
  const rows = await query(`SELECT id, kind FROM accounts WHERE id IN (${placeholders})`, params)
  return Object.fromEntries(rows.map((r) => [r.id, r.kind]))
}

// Validasi dasar + aturan kind rekening.
// - Investasi tidak boleh dipakai di transaksi biasa (uang masuk/keluar lewat menu Investasi).
// - Income & transfer hanya untuk rekening cash. Paylater cuma boleh jadi rekening expense (charge).
//   Bayar tagihan paylater lewat endpoint /paylater/pay-statement, bukan sini.
async function validate(tx) {
  if (!tx.type || !tx.date || !(Number(tx.amount) > 0)) return 'type, date, dan amount wajib'

  if (tx.type === 'transfer') {
    if (!tx.fromAccountId || !tx.toAccountId) return 'transfer butuh fromAccountId & toAccountId'
    if (tx.fromAccountId === tx.toAccountId) return 'rekening asal dan tujuan tidak boleh sama'
    const km = await kindMap([tx.fromAccountId, tx.toAccountId])
    const fromKind = km[tx.fromAccountId]
    const toKind = km[tx.toAccountId]
    if (fromKind === 'investment' || toKind === 'investment') return 'rekening investasi tidak bisa dipakai di transfer (gunakan menu Investasi)'
    if (fromKind === 'paylater') return 'tidak bisa transfer dari rekening pay later'
    if (toKind === 'paylater') return 'tidak bisa transfer ke rekening pay later (bayar tagihan lewat menu Pay Later)'
    return null
  }

  if (!tx.accountId) return 'accountId wajib'
  const km = await kindMap([tx.accountId])
  const kind = km[tx.accountId]
  if (kind === 'investment') return 'rekening investasi tidak bisa dipakai di transaksi (gunakan menu Investasi)'
  if (tx.type === 'income' && kind === 'paylater') return 'pemasukan tidak bisa masuk ke rekening pay later'
  return null
}

router.get('/', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM transactions ORDER BY date DESC'))
}))

router.post('/', wrap(async (req, res) => {
  const err = await validate(req.body)
  if (err) return res.status(400).json({ error: err })
  const item = normalizeTx({ ...req.body, id: uid('tx') })
  await query(INSERT_SQL, item)
  res.status(201).json(item)
}))

router.put('/:id', wrap(async (req, res) => {
  const existing = await queryOne('SELECT * FROM transactions WHERE id = :id', { id: req.params.id })
  if (!existing) return res.status(404).json({ error: 'not found' })
  const merged = normalizeTx({ ...existing, ...req.body, id: existing.id })
  const err = await validate(merged)
  if (err) return res.status(400).json({ error: err })
  await query(UPDATE_SQL, merged)
  res.json(merged)
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM transactions WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

export default router
export { INSERT_SQL as TX_INSERT_SQL }
