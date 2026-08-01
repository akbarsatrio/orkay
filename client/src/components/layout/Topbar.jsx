import { Menu, Plus } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'
import { Button } from '../ui/index.jsx'

export default function Topbar({ title, subtitle, onMenu, onQuickAdd }) {
  return (
    <header className="sticky top-0 z-20 h-16 bg-bg/80 backdrop-blur-md border-b border-border">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenu}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted hover:text-fg"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-fg truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onQuickAdd && (
            <Button size="md" onClick={onQuickAdd} className="hidden sm:inline-flex">
              <Plus size={16} />
              Tambah Transaksi
            </Button>
          )}
          {onQuickAdd && (
            <Button size="icon" onClick={onQuickAdd} className="sm:hidden">
              <Plus size={18} />
            </Button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
