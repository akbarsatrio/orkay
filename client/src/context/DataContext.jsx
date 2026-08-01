import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../lib/api.js'
import { periodKey } from '../lib/recurring.js'
import { toISODate } from '../lib/format.js'
import { payLaterInfoFor } from '../lib/paylater.js'

const DataContext = createContext(null)

const sortByDateDesc = (a, b) => b.date.localeCompare(a.date)

export function DataProvider({ children }) {
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [incomeSources, setIncomeSources] = useState([])
  const [recurring, setRecurring] = useState([])
  const [budgets, setBudgets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [installments, setInstallments] = useState([])
  const [settings, setSettings] = useState({ payDay: 28, theme: 'light', currency: 'IDR' })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ---- Bootstrap: muat semua data dari server sekali ----
  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/bootstrap')
      setCategories(data.categories || [])
      setAccounts(data.accounts || [])
      setIncomeSources(data.incomeSources || [])
      setRecurring(data.recurring || [])
      setBudgets(data.budgets || [])
      setTransactions((data.transactions || []).slice().sort(sortByDateDesc))
      setInstallments(data.installments || [])
      setSettings(data.settings || { payDay: 28, theme: 'light', currency: 'IDR' })
    } catch (e) {
      setError(e.message || 'Gagal memuat data dari server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  // ---- Lookups ----
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts])
  const incomeSourceMap = useMemo(() => Object.fromEntries(incomeSources.map((s) => [s.id, s])), [incomeSources])

  // ---- Transactions CRUD ----
  const addTransaction = useCallback(async (tx) => {
    const saved = await api.post('/transactions', tx)
    setTransactions((prev) => [saved, ...prev].sort(sortByDateDesc))
    return saved
  }, [])

  const updateTransaction = useCallback(async (id, patch) => {
    const saved = await api.put(`/transactions/${id}`, patch)
    setTransactions((prev) => prev.map((t) => (t.id === id ? saved : t)).sort(sortByDateDesc))
    return saved
  }, [])

  const deleteTransaction = useCallback(async (id) => {
    await api.del(`/transactions/${id}`)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ---- Categories CRUD ----
  const addCategory = useCallback(async (c) => {
    const saved = await api.post('/categories', c)
    setCategories((prev) => [...prev, saved])
    return saved
  }, [])
  const updateCategory = useCallback(async (id, patch) => {
    const saved = await api.put(`/categories/${id}`, patch)
    setCategories((prev) => prev.map((c) => (c.id === id ? saved : c)))
  }, [])
  const deleteCategory = useCallback(async (id) => {
    await api.del(`/categories/${id}`)
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // ---- Accounts CRUD ----
  const addAccount = useCallback(async (a) => {
    const saved = await api.post('/accounts', a)
    setAccounts((prev) => [...prev, saved])
    return saved
  }, [])
  const updateAccount = useCallback(async (id, patch) => {
    const saved = await api.put(`/accounts/${id}`, patch)
    setAccounts((prev) => prev.map((a) => (a.id === id ? saved : a)))
  }, [])
  const deleteAccount = useCallback(async (id) => {
    await api.del(`/accounts/${id}`)
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // ---- Income sources CRUD ----
  const addIncomeSource = useCallback(async (s) => {
    const saved = await api.post('/income-sources', s)
    setIncomeSources((prev) => [...prev, saved])
    return saved
  }, [])
  const updateIncomeSource = useCallback(async (id, patch) => {
    const saved = await api.put(`/income-sources/${id}`, patch)
    setIncomeSources((prev) => prev.map((s) => (s.id === id ? saved : s)))
  }, [])
  const deleteIncomeSource = useCallback(async (id) => {
    await api.del(`/income-sources/${id}`)
    setIncomeSources((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // ---- Recurring CRUD ----
  const addRecurring = useCallback(async (r) => {
    const saved = await api.post('/recurring', r)
    setRecurring((prev) => [...prev, saved])
    return saved
  }, [])
  const updateRecurring = useCallback(async (id, patch) => {
    const saved = await api.put(`/recurring/${id}`, patch)
    setRecurring((prev) => prev.map((r) => (r.id === id ? saved : r)))
  }, [])
  const deleteRecurring = useCallback(async (id) => {
    await api.del(`/recurring/${id}`)
    setRecurring((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // Konfirmasi recurring -> server buat transaksi + update generatedPeriods
  const confirmRecurring = useCallback(async (rec, dueDate, period) => {
    const { transaction, recurring: updated } = await api.post(`/recurring/${rec.id}/confirm`, { dueDate, period })
    setTransactions((prev) => [transaction, ...prev].sort(sortByDateDesc))
    setRecurring((prev) => prev.map((r) => (r.id === rec.id ? updated : r)))
  }, [])

  // ---- Budgets CRUD ----
  const upsertBudget = useCallback(async (categoryId, limit) => {
    const saved = await api.post('/budgets', { categoryId, limit })
    setBudgets((prev) => {
      const exists = prev.find((b) => b.categoryId === categoryId)
      if (exists) return prev.map((b) => (b.categoryId === categoryId ? saved : b))
      return [...prev, saved]
    })
  }, [])
  const deleteBudget = useCallback(async (id) => {
    await api.del(`/budgets/${id}`)
    setBudgets((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const updateSettings = useCallback(async (patch) => {
    // optimistic biar UI responsif (mis. ganti payDay)
    setSettings((prev) => ({ ...prev, ...patch }))
    try {
      const saved = await api.put('/settings', patch)
      setSettings(saved)
    } catch {
      // kalau gagal, biarkan nilai optimistic; bootstrap ulang bisa memperbaiki
    }
  }, [])

  // ---- Installments (cicilan) ----
  const addInstallment = useCallback(async (inst) => {
    const { installment, transaction } = await api.post('/installments', inst)
    setInstallments((prev) => [...prev, installment])
    if (transaction) setTransactions((prev) => [transaction, ...prev].sort(sortByDateDesc))
    return installment
  }, [])

  const updateInstallment = useCallback(async (id, patch) => {
    const saved = await api.put(`/installments/${id}`, patch)
    setInstallments((prev) => prev.map((i) => (i.id === id ? saved : i)))
  }, [])

  const deleteInstallment = useCallback(async (id) => {
    await api.del(`/installments/${id}`)
    setInstallments((prev) => prev.filter((i) => i.id !== id))
    setTransactions((prev) => prev.filter((t) => t.installmentId !== id))
  }, [])

  // Bayar 1 termin cicilan (dari rekening cash) -> expense + paidCount naik
  const payInstallment = useCallback(async (inst, date, fromAccountId) => {
    const { transaction, paidCount } = await api.post(`/installments/${inst.id}/pay`, { date, fromAccountId })
    setTransactions((prev) => [transaction, ...prev].sort(sortByDateDesc))
    setInstallments((prev) => prev.map((i) => (i.id === inst.id ? { ...i, paidCount } : i)))
  }, [])

  // Bayar tagihan statement paylater (charge langsung) -> transfer cash ke paylater
  const payStatement = useCallback(async (paylaterAccountId, fromAccountId, amount, date, statementPeriod) => {
    const { transaction } = await api.post('/paylater/pay-statement', {
      paylaterAccountId, fromAccountId, amount, date, statementPeriod,
    })
    setTransactions((prev) => [transaction, ...prev].sort(sortByDateDesc))
  }, [])

  // Set id akun paylater (tidak dihitung sebagai saldo cash)
  const paylaterIds = useMemo(
    () => new Set(accounts.filter((a) => a.kind === 'paylater').map((a) => a.id)),
    [accounts]
  )

  // ---- Derived: saldo per akun CASH (paham transfer) ----
  // Akun paylater tidak punya "saldo" — hanya utang/limit (lihat payLaterInfo).
  const accountBalances = useMemo(() => {
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
        if (!(t.accountId in map)) continue // skip paylater & installment purchase
        map[t.accountId] += t.type === 'income' ? t.amount : -t.amount
      }
      // type 'installment' (pembelian cicilan) tidak menyentuh saldo cash
    }
    return map
  }, [accounts, transactions])

  // ---- Derived: info limit/utang tiap akun paylater ----
  const payLaterInfo = useMemo(() => {
    const map = {}
    for (const a of accounts) {
      if (a.kind !== 'paylater') continue
      map[a.id] = payLaterInfoFor(a, transactions, installments)
    }
    return map
  }, [accounts, transactions, installments])

  const totalDebt = useMemo(
    () => Object.values(payLaterInfo).reduce((s, v) => s + v.used, 0),
    [payLaterInfo]
  )

  // Total kekayaan bersih = saldo cash − total utang paylater
  const totalBalance = useMemo(
    () => Object.values(accountBalances).reduce((s, v) => s + v, 0) - totalDebt,
    [accountBalances, totalDebt]
  )

  // ---- Admin ----
  const destroyData = useCallback(async () => {
    await api.post('/admin/destroy')
    await bootstrap()
  }, [bootstrap])

  const value = {
    loading, error, bootstrap,
    categories, accounts, incomeSources, recurring, budgets, transactions, installments, settings,
    categoryMap, accountMap, incomeSourceMap,
    accountBalances, totalBalance,
    paylaterIds, payLaterInfo, totalDebt,
    addTransaction, updateTransaction, deleteTransaction,
    addCategory, updateCategory, deleteCategory,
    addAccount, updateAccount, deleteAccount,
    addIncomeSource, updateIncomeSource, deleteIncomeSource,
    addRecurring, updateRecurring, deleteRecurring, confirmRecurring,
    upsertBudget, deleteBudget,
    addInstallment, updateInstallment, deleteInstallment, payInstallment, payStatement,
    updateSettings,
    destroyData,
    periodKey, toISODate,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
