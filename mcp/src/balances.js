// Kalkulasi saldo & kekayaan bersih — di-port dari client/src/context/DataContext.jsx.
// Sumber kebenaran tetap sama dengan web app.
import { payLaterInfoFor } from './paylater.js'

// Saldo per akun CASH (paham transfer + fee). Akun paylater TIDAK punya saldo cash.
// Return { [accountId]: saldo }
export function computeBalances(accounts, transactions) {
  const map = {}
  for (const a of accounts) {
    if (a.kind === 'paylater') continue
    map[a.id] = a.openingBalance || 0
  }
  for (const t of transactions) {
    if (t.type === 'transfer') {
      if (t.fromAccountId in map) map[t.fromAccountId] -= t.amount + (t.fee || 0)
      if (t.toAccountId in map) map[t.toAccountId] += t.amount
    } else if (t.type === 'expense' || t.type === 'income') {
      if (!(t.accountId in map)) continue // skip paylater & pembelian cicilan
      map[t.accountId] += t.type === 'income' ? t.amount : -t.amount
    }
    // type 'installment' (pembelian cicilan) tidak menyentuh saldo cash
  }
  return map
}

// Info paylater tiap akun: { [accountId]: { limit, used, available } }
export function computePayLaterInfo(accounts, transactions, installments) {
  const map = {}
  for (const a of accounts) {
    if (a.kind !== 'paylater') continue
    map[a.id] = payLaterInfoFor(a, transactions, installments)
  }
  return map
}

// Total utang paylater = jumlah "used" semua akun paylater.
export function computeTotalDebt(payLaterInfo) {
  return Object.values(payLaterInfo).reduce((s, v) => s + v.used, 0)
}

// Kekayaan bersih = total saldo cash − total utang paylater.
export function computeNetWorth(accountBalances, totalDebt) {
  const cash = Object.values(accountBalances).reduce((s, v) => s + v, 0)
  return { cash, debt: totalDebt, net: cash - totalDebt }
}
