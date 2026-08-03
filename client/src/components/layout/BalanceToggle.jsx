import { Eye, EyeOff } from 'lucide-react'
import { useBalanceVisibility } from '../../context/BalanceVisibilityContext.jsx'

export default function BalanceToggle() {
  const { hidden, toggle } = useBalanceVisibility()
  return (
    <button
      onClick={toggle}
      title={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
      aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
      className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-fg hover:bg-surface-2 transition-colors"
    >
      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )
}
