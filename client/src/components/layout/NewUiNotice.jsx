import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { load, save } from '../../lib/storage.js'

// Muncul sekali per perangkat saat tampilan baru pertama kali dibuka (DESIGN.md > Transisi).
export default function NewUiNotice() {
  const [seen, setSeen] = useState(() => load('uiNoticeSeen', false))
  if (seen) return null

  const dismiss = () => {
    save('uiNoticeSeen', true)
    setSeen(true)
  }

  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-md bg-surface-2 pl-4 pr-2 py-2">
      <p className="flex-1 text-sm text-fg py-1.5">
        Ini tampilan baru Orkay. Kalau lebih nyaman yang lama, kamu bisa balik kapan aja lewat{' '}
        <Link to="/settings/tampilan" onClick={dismiss} className="font-medium underline underline-offset-2">
          Pengaturan
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup pemberitahuan"
        className="h-9 w-9 touch:h-11 touch:w-11 shrink-0 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-border transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  )
}
