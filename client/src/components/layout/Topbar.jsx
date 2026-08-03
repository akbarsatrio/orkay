import { Plus } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'
import BalanceToggle from './BalanceToggle.jsx'
import { Button } from '../ui/index.jsx'

export default function Topbar({ title, subtitle, onQuickAdd }) {
  return (
    <header className="sticky top-0 z-20 h-16 bg-bg/80 backdrop-blur-md border-b border-border">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-fg truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onQuickAdd && (
            <Button size="md" onClick={onQuickAdd} className="hidden lg:inline-flex">
              <Plus size={16} />
              Tambah Transaksi
            </Button>
          )}
          <BalanceToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
