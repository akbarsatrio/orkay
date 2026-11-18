import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Wallet, MoreHorizontal, Plus } from 'lucide-react'
import MoreSheet from './MoreSheet.jsx'

const navItemClass = ({ isActive }) =>
  [
    'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
    isActive ? 'text-accent' : 'text-muted hover:text-fg',
  ].join(' ')

export default function BottomNav({ onQuickAdd }) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="relative flex items-stretch h-16">
          <NavLink to="/" end className={navItemClass}>
            <LayoutDashboard size={20} strokeWidth={2} />
            <span className="text-2xs font-medium">Dashboard</span>
          </NavLink>
          <NavLink to="/transactions" className={navItemClass}>
            <ArrowLeftRight size={20} strokeWidth={2} />
            <span className="text-2xs font-medium">Transaksi</span>
          </NavLink>

          {/* Slot tengah untuk FAB */}
          <div className="w-16 shrink-0" aria-hidden="true" />

          <NavLink to="/accounts" className={navItemClass}>
            <Wallet size={20} strokeWidth={2} />
            <span className="text-2xs font-medium">Rekening</span>
          </NavLink>
          <button type="button" onClick={() => setMoreOpen(true)} className={navItemClass({ isActive: false })}>
            <MoreHorizontal size={20} strokeWidth={2} />
            <span className="text-2xs font-medium">Lainnya</span>
          </button>

          {/* FAB Tambah Transaksi */}
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Tambah transaksi"
            className="absolute left-1/2 -translate-x-1/2 -top-5 h-14 w-14 rounded-full bg-accent text-accent-fg shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
