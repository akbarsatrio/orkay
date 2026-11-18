import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { TrendingUp, Repeat, Target, FileBarChart, MapPinned, Settings, LogOut, X } from 'lucide-react'
import { clearToken } from '../../lib/api.js'

const moreNav = [
  { to: '/investments', label: 'Investasi', icon: TrendingUp },
  { to: '/recurring', label: 'Tagihan Rutin', icon: Repeat },
  { to: '/budgets', label: 'Anggaran', icon: Target },
  { to: '/reports', label: 'Laporan', icon: FileBarChart },
  { to: '/peta', label: 'Peta Transaksi', icon: MapPinned },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
]

export default function MoreSheet({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_.15s_ease]"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 bg-bg rounded-t-2xl shadow-pop animate-[slideUp_.2s_ease] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-xl font-bold text-fg">Menu Lainnya</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="text-muted hover:text-fg h-9 w-9 touch:h-11 touch:w-11 -mr-2 flex items-center justify-center rounded-md hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="px-5" aria-label="Menu lainnya">
          {moreNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 h-14 text-base border-b border-border transition-colors',
                    isActive ? 'text-accent font-semibold' : 'text-fg',
                  ].join(' ')
                }
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
          <button
            onClick={() => { clearToken(); window.location.reload() }}
            className="flex items-center gap-3 w-full h-14 text-base font-medium text-negative"
          >
            <LogOut size={18} aria-hidden="true" />
            Kunci Aplikasi
          </button>
        </nav>
        <div className="h-3" />
      </div>
    </div>
  )
}
