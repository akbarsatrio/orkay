import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Repeat, Target, FileBarChart, Settings, LogOut,
} from 'lucide-react'
import { clearToken } from '../../lib/api.js'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Rekening', icon: Wallet },
  { to: '/recurring', label: 'Tagihan Rutin', icon: Repeat },
  { to: '/budgets', label: 'Anggaran', icon: Target },
  { to: '/reports', label: 'Laporan', icon: FileBarChart },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
]

function NavItem({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent/10 text-accent'
            : 'text-muted hover:text-fg hover:bg-surface-2',
        ].join(' ')
      }
    >
      <Icon size={18} strokeWidth={2} />
      {item.label}
    </NavLink>
  )
}

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex sticky top-0 z-40 h-screen w-64 shrink-0 bg-surface border-r border-border flex-col">
      <div className="flex items-center h-16 px-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center">
            <img src="/wallet.svg" alt="Orkay" className="h-full w-full" />
          </div>
          <div>
            <p className="text-sm font-bold text-fg leading-none">Orkay</p>
            <p className="text-2xs text-muted mt-0.5">Money Tracker</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={() => { clearToken(); window.location.reload() }}
          className="flex items-center gap-2.5 w-full px-3 h-9 rounded-lg text-sm font-medium text-muted hover:text-negative hover:bg-negative/10 transition-colors"
        >
          <LogOut size={17} />
          Kunci Aplikasi
        </button>
        <p className="text-2xs text-muted leading-relaxed mt-3">
          Data tersimpan di server pribadimu.
        </p>
      </div>
    </aside>
  )
}
