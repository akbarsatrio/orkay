import { query, queryOne } from './db.js'

// Lengkapi field opsional transaksi agar named params tidak error.
// Dipakai oleh routes/transactions.js & routes/recurring.js.
export function normalizeTx(t) {
  return {
    id: t.id,
    type: t.type,
    date: t.date,
    amount: t.amount,
    categoryId: t.categoryId ?? null,
    accountId: t.accountId ?? null,
    incomeSourceId: t.incomeSourceId ?? null,
    fromAccountId: t.fromAccountId ?? null,
    toAccountId: t.toAccountId ?? null,
    fee: t.fee ?? 0,
    feeCategoryId: t.feeCategoryId ?? null,
    recurringId: t.recurringId ?? null,
    installmentId: t.installmentId ?? null,
    statementPeriod: t.statementPeriod ?? null,
    note: t.note ?? null,
  }
}

// Pastikan ada satu baris settings default (id=1) supaya app punya payDay/theme.
// TIDAK mengisi data dummy apa pun — database mulai kosong dan diisi sendiri lewat UI.
export async function ensureSettings() {
  const row = await queryOne('SELECT id FROM settings WHERE id = 1')
  if (!row) {
    await query(
      'INSERT INTO settings (id, payDay, theme, currency) VALUES (1, :payDay, :theme, :currency)',
      { payDay: 28, theme: 'light', currency: 'IDR' }
    )
  }
}
