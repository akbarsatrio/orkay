import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './index.jsx'
import { monthNamesID } from '../../lib/format.js'

// Panah mengapit nama bulan (lebar tetap supaya panah tidak bergeser). Dipakai Laporan & Peta Transaksi.
// cursor: { y, m }; onChange(cursor). Bulan setelah bulan berjalan tidak bisa dipilih.
export default function MonthPicker({ cursor, onChange, caption }) {
  const now = new Date()
  const atCurrent = cursor.y > now.getFullYear() || (cursor.y === now.getFullYear() && cursor.m >= now.getMonth())
  const move = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    onChange({ y: d.getFullYear(), m: d.getMonth() })
  }
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="secondary" onClick={() => move(-1)} aria-label="Bulan sebelumnya">
        <ChevronLeft size={16} aria-hidden="true" />
      </Button>
      <div className="w-[9.5rem] text-center" aria-live="polite">
        <p className="text-lg font-bold text-fg leading-tight">{monthNamesID[cursor.m]} {cursor.y}</p>
        {caption && <p className="text-[13px] text-muted">{caption}</p>}
      </div>
      <Button size="icon" variant="secondary" onClick={() => move(1)} disabled={atCurrent} aria-label="Bulan berikutnya">
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </div>
  )
}
