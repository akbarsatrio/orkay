import { TrendingDown, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react'
import { Card, CardBody, Badge } from '../ui/index.jsx'
import { maskRupiah } from '../../lib/format.js'

const STATUS = {
  aman: {
    icon: ShieldCheck,
    label: 'Aman',
    tone: 'text-positive border-positive/30 bg-positive/10',
    accent: 'text-positive',
  },
  mepet: {
    icon: AlertTriangle,
    label: 'Mepet',
    tone: 'text-warning border-warning/30 bg-warning/10',
    accent: 'text-warning',
  },
  minus: {
    icon: XCircle,
    label: 'Kurang',
    tone: 'text-negative border-negative/30 bg-negative/10',
    accent: 'text-negative',
  },
}

function narrative(forecast) {
  const { status, proyeksi, tagihanTotal } = forecast
  if (tagihanTotal === 0) return 'Belum ada tagihan sampai gajian berikutnya.'
  if (status === 'minus') return 'Saldo tidak cukup menutup tagihan sampai gajian.'
  if (status === 'mepet') return 'Sisa tipis setelah semua tagihan. Hati-hati pengeluaran.'
  return 'Aman menutup semua tagihan sampai gajian berikutnya.'
}

export default function CashflowForecast({ forecast, daysToPay, hidden }) {
  const meta = STATUS[forecast.status] || STATUS.aman
  const Icon = meta.icon

  return (
    <Card className="min-w-0">
      <CardBody>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-accent">
            <TrendingDown size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Proyeksi Sampai Gajian</span>
          </div>
          <Badge className={meta.tone}>
            <Icon size={12} /> {meta.label}
          </Badge>
        </div>

        <p className={`text-2xl font-bold mt-3 ${meta.accent}`}>
          {maskRupiah(forecast.proyeksi, hidden)}
        </p>
        <p className="text-sm text-muted mt-1">{narrative(forecast)}</p>

        <div className="mt-4 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Saldo sekarang</span>
            <span className="text-fg tnum">{maskRupiah(forecast.saldoSekarang, hidden)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">
              Tagihan{typeof daysToPay === 'number' ? ` (${daysToPay} hari)` : ''}
            </span>
            <span className="text-negative tnum">− {maskRupiah(forecast.tagihanTotal, hidden)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
            <span className="text-fg">Proyeksi saldo</span>
            <span className={`tnum ${meta.accent}`}>{maskRupiah(forecast.proyeksi, hidden)}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
