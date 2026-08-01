import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      title={isDark ? 'Mode terang' : 'Mode gelap'}
      className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-fg hover:bg-surface-2 transition-colors"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
