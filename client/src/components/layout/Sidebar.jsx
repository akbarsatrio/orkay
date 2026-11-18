import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, TrendingUp, Repeat, Target, FileBarChart, MapPinned, Settings, LogOut, Plus,
} from 'lucide-react'
import { clearToken } from '../../lib/api.js'
import Wordmark from '../Wordmark.jsx'

// Menu dikelompokkan: harian (catat & cek uang) dan perencanaan/laporan. Urutan menu tetap sama.
const groups = [
  [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
    { to: '/accounts', label: 'Rekening', icon: Wallet },
    { to: '/investments', label: 'Investasi', icon: TrendingUp },
  ],
  [
    { to: '/recurring', label: 'Tagihan Rutin', icon: Repeat },
    { to: '/budgets', label: 'Anggaran', icon: Target },
    { to: '/reports', label: 'Laporan', icon: FileBarChart },
    { to: '/peta', label: 'Peta Transaksi', icon: MapPinned },
    { to: '/settings', label: 'Pengaturan', icon: Settings },
  ],
]

function NavItem({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 h-11 px-3 rounded-md text-[15px] transition-colors',
          isActive ? 'bg-rail-line text-rail-fg font-semibold' : 'text-rail-muted hover:text-rail-fg hover:bg-rail-line/50',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} strokeWidth={2} aria-hidden="true" className={isActive ? 'text-rail-accent' : ''} />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

// Satu kolom 16px dari tepi: tombol, sorot menu, dan garis pemisah selebar kolom itu; teks/ikon diberi px-3 di dalamnya
// supaya logo, ikon menu, dan ikon Kunci Aplikasi sejajar di satu garis.
export default function Sidebar({ onQuickAdd }) {
  return (
    <aside className="hidden lg:flex sticky top-0 z-20 h-screen w-64 shrink-0 bg-rail text-rail-fg flex-col px-4 pt-8 pb-6">
      <div className="px-3">
        <Wordmark className="h-9 w-auto text-rail-fg" rpClassName="text-rail-accent" />
        <p className="text-xs text-rail-muted mt-2">Money Tracker</p>
      </div>

      <button
        type="button"
        onClick={onQuickAdd}
        className="mt-8 h-11 w-full inline-flex items-center justify-center gap-2 rounded-md bg-rail-accent text-rail font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition"
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
        Tambah Transaksi
      </button>

      <nav className="flex-1 mt-8 overflow-y-auto" aria-label="Menu utama">
        {groups.map((items, i) => (
          <div key={i}>
            {i > 0 && <div className="my-4 border-t border-rail-line" aria-hidden="true" />}
            <div className="space-y-1">
              {items.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="pt-4 border-t border-rail-line">
        <button
          onClick={() => { clearToken(); window.location.reload() }}
          className="flex items-center gap-3 w-full h-11 px-3 rounded-md text-sm font-medium text-rail-muted hover:text-rail-fg hover:bg-rail-line/50 transition-colors"
        >
          <LogOut size={18} aria-hidden="true" />
          Kunci Aplikasi
        </button>
        <p className="text-xs text-rail-muted leading-relaxed mt-1 px-3">Data tersimpan di server pribadimu.</p>
      </div>
    </aside>
  )
}
