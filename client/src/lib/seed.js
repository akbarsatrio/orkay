import { uid } from './storage.js'
import { toISODate } from './format.js'

// Kategori default (bisa diedit user)
export function seedCategories() {
  return [
    { id: 'cat_salary', name: 'Gaji', type: 'income', icon: 'Wallet', color: '#16a34a' },
    { id: 'cat_freelance', name: 'Freelance', type: 'income', icon: 'Laptop', color: '#0ea5e9' },
    { id: 'cat_bonus', name: 'Bonus & Lainnya', type: 'income', icon: 'Gift', color: '#8b5cf6' },
    { id: 'cat_food', name: 'Makan & Minum', type: 'expense', icon: 'UtensilsCrossed', color: '#f97316' },
    { id: 'cat_transport', name: 'Transportasi', type: 'expense', icon: 'Car', color: '#0ea5e9' },
    { id: 'cat_shopping', name: 'Belanja', type: 'expense', icon: 'ShoppingBag', color: '#ec4899' },
    { id: 'cat_bills', name: 'Tagihan', type: 'expense', icon: 'ReceiptText', color: '#ef4444' },
    { id: 'cat_entertainment', name: 'Hiburan', type: 'expense', icon: 'Clapperboard', color: '#a855f7' },
    { id: 'cat_health', name: 'Kesehatan', type: 'expense', icon: 'HeartPulse', color: '#14b8a6' },
    { id: 'cat_home', name: 'Rumah Tangga', type: 'expense', icon: 'Home', color: '#84cc16' },
    { id: 'cat_savings', name: 'Tabungan & Investasi', type: 'expense', icon: 'PiggyBank', color: '#6366f1' },
    { id: 'cat_other', name: 'Lainnya', type: 'expense', icon: 'MoreHorizontal', color: '#71717a' },
  ]
}

export function seedAccounts() {
  return [
    { id: 'acc_bca', name: 'BCA', type: 'bank', openingBalance: 8500000, color: '#1d4ed8', icon: 'Landmark' },
    { id: 'acc_gopay', name: 'GoPay', type: 'ewallet', openingBalance: 350000, color: '#00aa13', icon: 'Smartphone' },
    { id: 'acc_cash', name: 'Dompet (Cash)', type: 'cash', openingBalance: 500000, color: '#71717a', icon: 'Banknote' },
  ]
}

export function seedIncomeSources() {
  return [
    { id: 'inc_main', name: 'Gaji Kantor', color: '#16a34a' },
    { id: 'inc_side', name: 'Proyek Freelance', color: '#0ea5e9' },
  ]
}

export function seedRecurring() {
  return [
    { id: uid('rec'), name: 'Kos / Sewa', categoryId: 'cat_bills', accountId: 'acc_bca', amount: 1800000, dueDay: 5, active: true, generatedPeriods: [] },
    { id: uid('rec'), name: 'Internet Rumah', categoryId: 'cat_bills', accountId: 'acc_bca', amount: 350000, dueDay: 10, active: true, generatedPeriods: [] },
    { id: uid('rec'), name: 'Listrik (Token)', categoryId: 'cat_bills', accountId: 'acc_bca', amount: 300000, dueDay: 15, active: true, generatedPeriods: [] },
    { id: uid('rec'), name: 'Netflix + Spotify', categoryId: 'cat_entertainment', accountId: 'acc_bca', amount: 120000, dueDay: 3, active: true, generatedPeriods: [] },
    { id: uid('rec'), name: 'Setoran Reksadana', categoryId: 'cat_savings', accountId: 'acc_bca', amount: 1000000, dueDay: 1, active: true, generatedPeriods: [] },
  ]
}

export function seedBudgets() {
  return [
    { id: uid('bud'), categoryId: 'cat_food', limit: 2500000 },
    { id: uid('bud'), categoryId: 'cat_transport', limit: 800000 },
    { id: uid('bud'), categoryId: 'cat_shopping', limit: 1500000 },
    { id: uid('bud'), categoryId: 'cat_entertainment', limit: 600000 },
  ]
}

// Generate transaksi dummy 3 bulan terakhir supaya chart & tabel berisi.
export function seedTransactions() {
  const txs = []
  const now = new Date()

  const expenseTemplates = [
    { cat: 'cat_food', acc: 'acc_gopay', min: 25000, max: 120000, notes: ['Sarapan', 'Makan siang', 'Ngopi', 'Delivery makan', 'Dinner'] },
    { cat: 'cat_transport', acc: 'acc_gopay', min: 12000, max: 60000, notes: ['Ojek online', 'Bensin', 'Parkir', 'Tol'] },
    { cat: 'cat_shopping', acc: 'acc_bca', min: 80000, max: 500000, notes: ['Belanja bulanan', 'Baju', 'Skincare', 'Gadget kecil'] },
    { cat: 'cat_food', acc: 'acc_cash', min: 15000, max: 70000, notes: ['Jajan', 'Warung', 'Cemilan'] },
    { cat: 'cat_health', acc: 'acc_bca', min: 50000, max: 250000, notes: ['Vitamin', 'Apotek', 'Klinik'] },
    { cat: 'cat_home', acc: 'acc_bca', min: 30000, max: 200000, notes: ['Kebutuhan rumah', 'Galon + gas', 'Sabun dll'] },
  ]

  function rand(min, max) {
    return Math.round((min + Math.random() * (max - min)) / 1000) * 1000
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  // 3 bulan ke belakang termasuk bulan ini
  for (let mOffset = 2; mOffset >= 0; mOffset--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - mOffset, 1)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const maxDay = mOffset === 0 ? Math.min(now.getDate(), daysInMonth) : daysInMonth

    // Pemasukan gaji tanggal ~28
    txs.push({
      id: uid('tx'),
      date: toISODate(new Date(year, month, Math.min(28, daysInMonth))),
      type: 'income',
      amount: 12000000,
      categoryId: 'cat_salary',
      accountId: 'acc_bca',
      incomeSourceId: 'inc_main',
      note: 'Gaji bulanan',
    })

    // Freelance sesekali
    if (Math.random() > 0.4) {
      txs.push({
        id: uid('tx'),
        date: toISODate(new Date(year, month, Math.min(rand(8, 20) / 1000 | 0 || 12, maxDay))),
        type: 'income',
        amount: rand(1500000, 4000000),
        categoryId: 'cat_freelance',
        accountId: 'acc_bca',
        incomeSourceId: 'inc_side',
        note: 'Proyek sampingan',
      })
    }

    // Pengeluaran harian acak
    const txCount = 22 + Math.floor(Math.random() * 12)
    for (let i = 0; i < txCount; i++) {
      const t = pick(expenseTemplates)
      const day = 1 + Math.floor(Math.random() * maxDay)
      txs.push({
        id: uid('tx'),
        date: toISODate(new Date(year, month, day)),
        type: 'expense',
        amount: rand(t.min, t.max),
        categoryId: t.cat,
        accountId: t.acc,
        note: pick(t.notes),
      })
    }
  }

  return txs.sort((a, b) => b.date.localeCompare(a.date))
}

export function seedSettings() {
  return {
    payDay: 28,
    theme: 'light',
    currency: 'IDR',
  }
}

export function buildSeed() {
  return {
    categories: seedCategories(),
    accounts: seedAccounts(),
    incomeSources: seedIncomeSources(),
    recurring: seedRecurring(),
    budgets: seedBudgets(),
    transactions: seedTransactions(),
    settings: seedSettings(),
  }
}
