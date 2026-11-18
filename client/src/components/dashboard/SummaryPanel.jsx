import { TrendingUp, TrendingDown } from 'lucide-react'
import Money from '../ui/Money.jsx'
import { cx } from '../ui/index.jsx'

const TONES = { default: 'text-fg', positive: 'text-positive', negative: 'text-negative' }

// Arah panah ikut arah angka; warna ikut "bagus/jelek".
// deltaInverse=true (mis. pengeluaran): naik = jelek (merah), turun = bagus (hijau).
function Delta({ delta, inverse, className }) {
  if (delta == null || !Number.isFinite(delta)) return null
  const good = inverse ? delta < 0 : delta >= 0
  return (
    <p className={cx('flex items-center gap-1 text-xs mt-1', good ? 'text-positive' : 'text-negative', className)}>
      {delta >= 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
      <span className="tnum">{Math.abs(delta).toFixed(0)}%</span>
      <span className="text-muted">vs bulan lalu</span>
    </p>
  )
}

function Label({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-muted">
      {Icon && <Icon size={14} aria-hidden="true" />}
      {children}
    </p>
  )
}

/**
 * Empat angka ringkasan dalam satu panel (pengganti 4 StatCard).
 * items[0] = Total Saldo (angka besar), items[1..3] = baris.
 */
export default function SummaryPanel({ items }) {
  const [main, ...rows] = items
  return (
    <section aria-label="Ringkasan" className="grid gap-x-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:items-end">
      <div className="pb-4 lg:pb-0 min-w-0">
        <Label icon={main.icon}>{main.label}</Label>
        <div className="mt-2">
          <Money value={main.value} hidden={main.hidden} size="large" className={TONES[main.tone || 'default']} />
        </div>
        <Delta delta={main.delta} inverse={main.deltaInverse} />
      </div>

      {rows.map((r) => (
        <div
          key={r.label}
          className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 last:pb-0 border-t border-border lg:block lg:py-0 lg:border-t-0 lg:border-l lg:pl-6 min-w-0"
        >
          <Label icon={r.icon}>{r.label}</Label>
          <div className="text-right lg:text-left lg:mt-2">
            <Money value={r.value} hidden={r.hidden} className={cx('text-lg lg:text-xl font-semibold', TONES[r.tone || 'default'])} />
            <Delta delta={r.delta} inverse={r.deltaInverse} className="justify-end lg:justify-start" />
          </div>
        </div>
      ))}
    </section>
  )
}
