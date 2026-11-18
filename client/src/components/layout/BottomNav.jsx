import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Wallet, MoreHorizontal, Plus } from 'lucide-react'
import MoreSheet from './MoreSheet.jsx'

const navItemClass = ({ isActive }) =>
  [
    'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs transition-colors',
    isActive ? 'text-accent font-semibold' : 'text-muted hover:text-fg',
  ].join(' ')

export default function BottomNav({ onQuickAdd }) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      <nav
        aria-label="Menu utama"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-bg border-t border-border pb-[env(safe-area-inset-bottom)]"
      >
        <div className="relative flex items-center h-16 px-2">
          <NavLink to="/" end className={navItemClass}>
            <LayoutDashboard size={20} strokeWidth={2} aria-hidden="true" />
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className={navItemClass}>
            <ArrowLeftRight size={20} strokeWidth={2} aria-hidden="true" />
            Transaksi
          </NavLink>

          {/* Slot tengah untuk tombol tambah yang melayang: penegasan bahwa mencatat transaksi adalah aksi inti. */}
          <div className="flex-1" aria-hidden="true" />
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Tambah transaksi"
            className="absolute left-1/2 -translate-x-1/2 -top-5 h-14 w-14 rounded-full bg-accent text-accent-fg shadow-pop ring-4 ring-bg flex items-center justify-center hover:opacity-90 active:scale-95 transition"
          >
            <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
          </button>

          <NavLink to="/accounts" className={navItemClass}>
            <Wallet size={20} strokeWidth={2} aria-hidden="true" />
            Rekening
          </NavLink>
          <button type="button" onClick={() => setMoreOpen(true)} className={navItemClass({ isActive: false })}>
            <MoreHorizontal size={20} strokeWidth={2} aria-hidden="true" />
            Lainnya
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
