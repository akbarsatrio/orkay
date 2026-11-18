import { lazy, Suspense, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Loader2, WifiOff } from 'lucide-react'
import { useData } from './context/DataContext.jsx'
import { Button } from './components/ui/index.jsx'
import Wordmark from './components/Wordmark.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import Topbar from './components/layout/Topbar.jsx'
import BottomNav from './components/layout/BottomNav.jsx'
import NewUiNotice from './components/layout/NewUiNotice.jsx'
import TransactionForm from './components/transactions/TransactionForm.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import Accounts from './pages/Accounts.jsx'
import Investments from './pages/Investments.jsx'
import Recurring from './pages/Recurring.jsx'
import Budgets from './pages/Budgets.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import { SETTINGS_SECTIONS } from './lib/settingsSections.js'
import { useIsMobile } from './components/ui/SwipeRow.jsx'

// Peta dimuat terpisah: mapbox-gl besar dan hanya dibutuhkan di menu ini.
const TransactionMap = lazy(() => import('./pages/TransactionMap.jsx'))

const meta = {
  '/': { title: 'Dashboard', subtitle: 'Ringkasan keuangan kamu' },
  '/transactions': { title: 'Transaksi', subtitle: 'Semua catatan pemasukan & pengeluaran' },
  '/accounts': { title: 'Rekening', subtitle: 'Saldo tiap dompet & rekening' },
  '/investments': { title: 'Investasi', subtitle: 'Portofolio & untung/rugi mark-to-market' },
  '/recurring': { title: 'Tagihan Rutin', subtitle: 'Pengeluaran tetap tiap bulan' },
  '/budgets': { title: 'Anggaran', subtitle: 'Batas pengeluaran per kategori' },
  '/reports': { title: 'Laporan', subtitle: 'Rekap bulanan keuangan' },
  '/peta': { title: 'Peta Transaksi', subtitle: 'Di mana uang kamu keluar' },
  '/settings': { title: 'Pengaturan', subtitle: 'Kategori, sumber dana & payday' },
}

export default function App() {
  const [txOpen, setTxOpen] = useState(false)
  const { pathname } = useLocation()
  const { loading, error, bootstrap } = useData()
  const mobile = useIsMobile()
  // Sub-layar Pengaturan di HP & tablet: judul = nama bagian + tombol kembali ke menu.
  // Desktop menampilkan menu & isi berdampingan, jadi judul tetap "Pengaturan".
  const settingsSection = SETTINGS_SECTIONS[pathname.match(/^\/settings\/([^/]+)/)?.[1]]
  const m = settingsSection
    ? (mobile ? { title: settingsSection.title, subtitle: settingsSection.subtitle, back: '/settings' } : meta['/settings'])
    : meta[pathname] || { title: 'Orkay' }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3">
        <Wordmark className="h-10 w-auto text-fg" />
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
        <WifiOff size={22} className="text-negative" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-fg">Gagal terhubung ke server</p>
          <p className="text-xs text-muted mt-1 max-w-sm">{error}</p>
          <p className="text-xs text-muted mt-2">Pastikan backend berjalan (npm run dev menjalankan server + client).</p>
        </div>
        <Button onClick={bootstrap}>Coba Lagi</Button>
      </div>
    )
  }

  const routes = (
    <Routes>
      <Route path="/" element={<Dashboard onAddTransaction={() => setTxOpen(true)} />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/investments" element={<Investments />} />
      <Route path="/recurring" element={<Recurring />} />
      <Route path="/budgets" element={<Budgets />} />
      <Route path="/reports" element={<Reports />} />
      <Route
        path="/peta"
        element={(
          <Suspense fallback={<p className="h-full flex items-center justify-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Memuat peta…</p>}>
            <TransactionMap />
          </Suspense>
        )}
      />
      <Route path="/settings/:section?" element={<Settings />} />
    </Routes>
  )

  // Peta Transaksi memenuhi area konten (dari sidebar sampai tepi kanan, setinggi layar) dan membawa judul sendiri
  // di panel mengambang, jadi tanpa Topbar & padding halaman.
  const fullBleed = pathname === '/peta'

  return (
    <div className="min-h-screen flex bg-bg theme-transition">
      <Sidebar onQuickAdd={() => setTxOpen(true)} />

      {fullBleed ? (
        <main className="flex-1 min-w-0 h-[100dvh]">{routes}</main>
      ) : (
        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-12">
          <div className="max-w-[1280px] w-full mx-auto">
            <Topbar title={m.title} subtitle={m.subtitle} back={m.back} />
            <NewUiNotice />
            <main>{routes}</main>
          </div>
        </div>
      )}

      <BottomNav onQuickAdd={() => setTxOpen(true)} />
      <TransactionForm open={txOpen} onClose={() => setTxOpen(false)} />
    </div>
  )
}
