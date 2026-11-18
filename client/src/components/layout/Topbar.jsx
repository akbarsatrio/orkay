import BalanceToggle from './BalanceToggle.jsx'

// Judul halaman ikut ter-scroll (tidak sticky) supaya tidak memakan layar HP. Ukurannya sengaja di bawah
// angka raksasa: judul memberi konteks, angka raksasa jadi fokus. Tema diatur di Pengaturan.
export default function Topbar({ title, subtitle }) {
  return (
    <header className="flex items-start justify-between gap-3 pt-6 lg:pt-10 pb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-fg leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      <BalanceToggle />
    </header>
  )
}
