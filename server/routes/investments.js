import { Router } from 'express'
import { query, queryOne, withTransaction } from '../db.js'
import { uid, wrap } from './helpers.js'
import { computeFee, computeTax } from '../lib/investment.js'
import { normalizeTx } from '../seed.js'
import { TX_INSERT_SQL } from './transactions.js'

const router = Router()

const INSERT_SQL = `INSERT INTO investment_snapshots
  (id,accountId,date,contribution,withdrawal,fee,tax,marketValue,cashAccountId,linkedTxId,note)
  VALUES (:id,:accountId,:date,:contribution,:withdrawal,:fee,:tax,:marketValue,:cashAccountId,:linkedTxId,:note)`

const UPDATE_SQL = `UPDATE investment_snapshots SET
  accountId=:accountId, date=:date, contribution=:contribution, withdrawal=:withdrawal,
  fee=:fee, tax=:tax, marketValue=:marketValue, cashAccountId=:cashAccountId, linkedTxId=:linkedTxId, note=:note
  WHERE id=:id`

const TX_UPDATE_SQL = `UPDATE transactions SET
  type=:type, date=:date, amount=:amount, categoryId=:categoryId, accountId=:accountId,
  incomeSourceId=:incomeSourceId, fromAccountId=:fromAccountId, toAccountId=:toAccountId,
  fee=:fee, feeCategoryId=:feeCategoryId, recurringId=:recurringId,
  installmentId=:installmentId, statementPeriod=:statementPeriod, note=:note
  WHERE id=:id`

// Hitung angka snapshot final dari input mentah (fee/tax config atau angka jadi).
function normalizeSnapshot(s) {
  const withdrawal = Math.max(0, Number(s.withdrawal) || 0)

  let fee = Math.max(0, Number(s.fee) || 0)
  let tax = Math.max(0, Number(s.tax) || 0)

  if (s.feeInput) fee = computeFee(s.feeInput, withdrawal)
  if (s.taxInput) tax = computeTax(s.taxInput, withdrawal, fee)

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
    cashAccountId: s.cashAccountId || null,
    linkedTxId: s.linkedTxId || null,
    note: s.note ?? null,
  }
}

// Bangun objek transaksi transfer cash <-> investasi dari snapshot.
// Return null kalau tidak ada uang bergerak / tidak ada rekening cash.
async function buildLinkedTx(snap, txId) {
  if (!snap.cashAccountId) return null
  const hasMove = snap.contribution > 0 || snap.withdrawal > 0
  if (!hasMove) return null

  const invAcc = await queryOne('SELECT name FROM accounts WHERE id = :id', { id: snap.accountId })
  const invName = invAcc?.name || 'Investasi'

  if (snap.contribution > 0) {
    // Setor: cash -> investasi, sejumlah setoran.
    return normalizeTx({
      id: txId,
      type: 'transfer',
      date: snap.date,
      amount: snap.contribution,
      fromAccountId: snap.cashAccountId,
      toAccountId: snap.accountId,
      note: `Setor ${invName}`,
    })
  }

  // Tarik: investasi -> cash, sejumlah yang diterima bersih; fee+tax jadi biaya transfer.
  const received = Math.max(0, snap.withdrawal - snap.fee - snap.tax)
  return normalizeTx({
    id: txId,
    type: 'transfer',
    date: snap.date,
    amount: received,
    fromAccountId: snap.accountId,
    toAccountId: snap.cashAccountId,
    fee: snap.fee + snap.tax,
    note: `Tarik ${invName}`,
  })
}

router.get('/', wrap(async (req, res) => {
  const rows = await query('SELECT * FROM investment_snapshots ORDER BY date ASC, id ASC')
  res.json(rows)
}))

router.post('/', wrap(async (req, res) => {
  const item = normalizeSnapshot({ ...req.body, id: uid('snap') })
  if (!item.accountId) return res.status(400).json({ error: 'accountId wajib' })
  if (!item.date) return res.status(400).json({ error: 'date wajib' })
  if (item.contribution <= 0 && item.withdrawal <= 0 && item.marketValue <= 0) {
    return res.status(400).json({ error: 'isi minimal setoran, tarikan, atau nilai portfolio' })
  }
  // Rekening cash wajib kalau ada setoran/tarikan (uang bergerak).
  if ((item.contribution > 0 || item.withdrawal > 0) && !item.cashAccountId) {
    return res.status(400).json({ error: 'pilih rekening cash untuk setoran/tarikan' })
  }

  const txId = uid('tx')
  const tx = await buildLinkedTx(item, txId)
  item.linkedTxId = tx ? txId : null

  await withTransaction(async ({ run }) => {
    if (tx) await run(TX_INSERT_SQL, tx)
    await run(INSERT_SQL, item)
  })

  res.status(201).json({ snapshot: item, transaction: tx })
}))

router.put('/:id', wrap(async (req, res) => {
  const existing = await queryOne('SELECT * FROM investment_snapshots WHERE id = :id', { id: req.params.id })
  if (!existing) return res.status(404).json({ error: 'not found' })

  const item = normalizeSnapshot({ ...existing, ...req.body, id: existing.id })
  if ((item.contribution > 0 || item.withdrawal > 0) && !item.cashAccountId) {
    return res.status(400).json({ error: 'pilih rekening cash untuk setoran/tarikan' })
  }

  const oldTxId = existing.linkedTxId
  // Tentukan transaksi baru yang seharusnya.
  const newTxId = oldTxId || uid('tx')
  const newTx = await buildLinkedTx(item, newTxId)
  item.linkedTxId = newTx ? newTxId : null

  await withTransaction(async ({ run }) => {
    if (oldTxId && !newTx) {
      // dulu ada transaksi, sekarang tidak perlu -> hapus.
      await run('DELETE FROM transactions WHERE id = :id', { id: oldTxId })
    } else if (oldTxId && newTx) {
      // update transaksi lama.
      await run(TX_UPDATE_SQL, newTx)
    } else if (!oldTxId && newTx) {
      // dulu tidak ada, sekarang perlu -> buat baru.
      await run(TX_INSERT_SQL, newTx)
    }
    await run(UPDATE_SQL, item)
  })

  res.json({ snapshot: item, transaction: newTx, removedTxId: oldTxId && !newTx ? oldTxId : null })
}))

router.delete('/:id', wrap(async (req, res) => {
  const existing = await queryOne('SELECT * FROM investment_snapshots WHERE id = :id', { id: req.params.id })
  if (!existing) return res.json({ ok: true })

  await withTransaction(async ({ run }) => {
    if (existing.linkedTxId) {
      await run('DELETE FROM transactions WHERE id = :id', { id: existing.linkedTxId })
    }
    await run('DELETE FROM investment_snapshots WHERE id = :id', { id: req.params.id })
  })

  res.json({ ok: true, removedTxId: existing.linkedTxId || null })
}))

export default router
