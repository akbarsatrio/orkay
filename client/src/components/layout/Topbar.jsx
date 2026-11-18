import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import BalanceToggle from './BalanceToggle.jsx'

// Judul halaman ikut ter-scroll (tidak sticky) supaya tidak memakan layar HP. Ukurannya sengaja di bawah
// angka raksasa: judul memberi konteks, angka raksasa jadi fokus. Tema diatur di Pengaturan.
// `back`: path tujuan tombol kembali (sub-layar Pengaturan di HP & tablet).
export default function Topbar({ title, subtitle, back }) {
  return (
    <header className="flex items-start justify-between gap-3 pt-6 lg:pt-10 pb-6">
      <div className="min-w-0 flex items-start gap-1">
        {back && (
          <Link
            to={back}
            aria-label="Kembali"
            className="shrink-0 -ml-2.5 h-11 w-11 flex items-center justify-center rounded-md text-fg hover:bg-surface-2"
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className={`text-2xl font-bold text-fg leading-tight ${back ? 'pt-1.5' : ''}`}>{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <BalanceToggle />
    </header>
  )
}
