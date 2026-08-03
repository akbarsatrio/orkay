import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Loader2, WifiOff, Wallet } from 'lucide-react'
import { useData } from './context/DataContext.jsx'
import { Button } from './components/ui/index.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import Topbar from './components/layout/Topbar.jsx'
import BottomNav from './components/layout/BottomNav.jsx'
import TransactionForm from './components/transactions/TransactionForm.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import Accounts from './pages/Accounts.jsx'
import Recurring from './pages/Recurring.jsx'
import Budgets from './pages/Budgets.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'

const meta = {
  '/': { title: 'Dashboard', subtitle: 'Ringkasan keuangan kamu' },
  '/transactions': { title: 'Transaksi', subtitle: 'Semua catatan pemasukan & pengeluaran' },
  '/accounts': { title: 'Rekening', subtitle: 'Saldo tiap dompet & rekening' },
  '/recurring': { title: 'Tagihan Rutin', subtitle: 'Pengeluaran tetap tiap bulan' },
  '/budgets': { title: 'Anggaran', subtitle: 'Batas pengeluaran per kategori' },
  '/reports': { title: 'Laporan', subtitle: 'Rekap bulanan keuangan' },
  '/settings': { title: 'Pengaturan', subtitle: 'Kategori, sumber dana & payday' },
}

export default function App() {
  const [txOpen, setTxOpen] = useState(false)
  const { pathname } = useLocation()
  const { loading, error, bootstrap } = useData()
  const m = meta[pathname] || { title: 'Orkay' }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center">
          <img src="/wallet.svg" alt="Orkay" className="h-full w-full" />
        </div>
        <div className="flex items-center gap-2 text-muted text-sm">
          <Loader2 size={16} className="animate-spin" />
          Memuat data…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-4 px-6 text-center">
        <div className="h-11 w-11 rounded-full bg-negative/10 flex items-center justify-center">
          <WifiOff size={20} className="text-negative" />
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">Gagal terhubung ke server</p>
          <p className="text-xs text-muted mt-1 max-w-sm">{error}</p>
          <p className="text-2xs text-muted mt-2">Pastikan backend berjalan (npm run dev menjalankan server + client).</p>
        </div>
        <Button onClick={bootstrap}>Coba Lagi</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-bg theme-transition">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title={m.title}
          subtitle={m.subtitle}
          onQuickAdd={() => setTxOpen(true)}
        />
        <main className="flex-1 px-4 sm:px-6 py-6 pb-24 lg:pb-6 max-w-[1400px] w-full mx-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Dashboard onAddTransaction={() => setTxOpen(true)} />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>

      <BottomNav onQuickAdd={() => setTxOpen(true)} />
      <TransactionForm open={txOpen} onClose={() => setTxOpen(false)} />
    </div>
  )
}
