import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Repeat, Target, FileBarChart, Settings, LogOut, X } from 'lucide-react'
import { clearToken } from '../../lib/api.js'

const moreNav = [
  { to: '/recurring', label: 'Tagihan Rutin', icon: Repeat },
  { to: '/budgets', label: 'Anggaran', icon: Target },
  { to: '/reports', label: 'Laporan', icon: FileBarChart },
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
      <div className="absolute inset-x-0 bottom-0 bg-surface border-t border-border rounded-t-2xl shadow-pop animate-[slideUp_.2s_ease] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">Menu Lainnya</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-fg h-7 w-7 flex items-center justify-center rounded-md hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="grid grid-cols-2 gap-2 p-4">
          {moreNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-4 h-14 rounded-xl text-sm font-medium border transition-colors',
                    isActive
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'text-fg border-border hover:bg-surface-2',
                  ].join(' ')
                }
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="px-4 pb-5">
          <button
            onClick={() => { clearToken(); window.location.reload() }}
            className="flex items-center justify-center gap-2.5 w-full px-3 h-11 rounded-xl text-sm font-medium text-negative bg-negative/10 hover:bg-negative/15 transition-colors"
          >
            <LogOut size={17} />
            Kunci Aplikasi
          </button>
        </div>
      </div>
    </div>
  )
}
