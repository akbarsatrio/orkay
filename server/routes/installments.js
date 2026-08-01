import { Router } from 'express'
import { query, queryOne, withTransaction } from '../db.js'
import { uid, wrap } from './helpers.js'
import { normalizeTx } from '../seed.js'
import { TX_INSERT_SQL } from './transactions.js'

const router = Router()

const INSERT_SQL = `INSERT INTO installments
  (id,accountId,categoryId,name,purchaseDate,principalTotal,tenor,monthlyAmount,interestPerMonth,paidCount,active)
  VALUES (:id,:accountId,:categoryId,:name,:purchaseDate,:principalTotal,:tenor,:monthlyAmount,:interestPerMonth,:paidCount,:active)`

function normalizeInst(i) {
  const tenor = Math.max(1, Number(i.tenor) || 1)
  const principalTotal = Number(i.principalTotal) || 0
  const interestPerMonth = Number(i.interestPerMonth) || 0
  // monthlyAmount: kalau user isi manual pakai itu, kalau tidak hitung pokok/tenor + bunga
  let monthlyAmount = Number(i.monthlyAmount) || 0
  if (!monthlyAmount) {
    monthlyAmount = Math.round(principalTotal / tenor) + interestPerMonth
  }
  return {
    id: i.id,
    accountId: i.accountId,
    categoryId: i.categoryId ?? null,
    name: i.name,
    purchaseDate: i.purchaseDate,
    principalTotal,
    tenor,
    monthlyAmount,
    interestPerMonth,
    paidCount: Math.max(0, Number(i.paidCount) || 0),
    active: i.active === undefined ? 1 : (i.active ? 1 : 0),
  }
}

function toClient(row) {
  return { ...row, active: !!row.active }
}

router.get('/', wrap(async (req, res) => {
  const rows = await query('SELECT * FROM installments')
  res.json(rows.map(toClient))
}))

// Buat cicilan baru + catat transaksi "pembelian" (type=installment, TIDAK dihitung sebagai expense)
router.post('/', wrap(async (req, res) => {
  const item = normalizeInst({ ...req.body, id: uid('inst'), paidCount: 0, active: true })
  if (!item.accountId || !item.name || !(item.principalTotal > 0)) {
    return res.status(400).json({ error: 'accountId, name, principalTotal wajib' })
  }

  const purchaseTx = normalizeTx({
    id: uid('tx'),
    type: 'installment', // penanda pembelian cicilan — diabaikan di laporan expense
    date: item.purchaseDate,
    amount: item.principalTotal,
    categoryId: item.categoryId,
    accountId: item.accountId,
    note: item.name + ` (cicilan ${item.tenor}x)`,
    installmentId: item.id,
  })

  await withTransaction(async ({ run }) => {
    await run(INSERT_SQL, item)
    await run(TX_INSERT_SQL, purchaseTx)
  })

  res.status(201).json({ installment: toClient(item), transaction: purchaseTx })
}))

router.put('/:id', wrap(async (req, res) => {
  const existing = await queryOne('SELECT * FROM installments WHERE id = :id', { id: req.params.id })
  if (!existing) return res.status(404).json({ error: 'not found' })
  const item = normalizeInst({ ...existing, ...req.body, id: existing.id })
  await query(`UPDATE installments SET
    accountId=:accountId, categoryId=:categoryId, name=:name, purchaseDate=:purchaseDate,
    principalTotal=:principalTotal, tenor=:tenor, monthlyAmount=:monthlyAmount,
    interestPerMonth=:interestPerMonth, paidCount=:paidCount, active=:active
    WHERE id=:id`, item)
  res.json(toClient(item))
}))

router.delete('/:id', wrap(async (req, res) => {
  await query('DELETE FROM installments WHERE id = :id', { id: req.params.id })
  res.json({ ok: true })
}))

// Bayar 1 termin cicilan.
// - Uang keluar dari rekening cash (fromAccountId) -> tercatat type=expense (masuk laporan bulan bayar).
// - paidCount naik 1 -> utang cicilan berkurang & sisa limit paylater pulih 1 termin.
router.post('/:id/pay', wrap(async (req, res) => {
  const { date, fromAccountId } = req.body
  const inst = await queryOne('SELECT * FROM installments WHERE id = :id', { id: req.params.id })
  if (!inst) return res.status(404).json({ error: 'not found' })
  if (inst.paidCount >= inst.tenor) {
    return res.status(409).json({ error: 'cicilan sudah lunas' })
  }
  if (!fromAccountId) return res.status(400).json({ error: 'fromAccountId (rekening pembayar) wajib' })
  if (!date) return res.status(400).json({ error: 'date wajib' })

  const termin = inst.paidCount + 1
  const tx = normalizeTx({
    id: uid('tx'),
    type: 'expense', // pembayaran cicilan = pengeluaran bulan ini, dari rekening cash
    date,
    amount: inst.monthlyAmount,
    categoryId: inst.categoryId,
    accountId: fromAccountId,
    note: `${inst.name} — cicilan ${termin}/${inst.tenor}`,
    installmentId: inst.id,
  })

  await withTransaction(async ({ run }) => {
    await run(TX_INSERT_SQL, tx)
    await run('UPDATE installments SET paidCount = paidCount + 1 WHERE id = :id', { id: inst.id })
  })

  res.json({ transaction: tx, paidCount: termin })
}))

export default router
