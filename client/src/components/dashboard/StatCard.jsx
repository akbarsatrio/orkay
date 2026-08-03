import { Card, CardBody } from '../ui/index.jsx'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { maskRupiah } from '../../lib/format.js'

export default function StatCard({ label, value, icon: Icon, tone = 'default', delta, deltaInverse = false, hidden = false }) {
  const tones = {
    default: 'text-fg',
    positive: 'text-positive',
    negative: 'text-negative',
  }
  // Arah panah ikut arah angka; warna ikut "bagus/jelek".
  // deltaInverse=true (mis. pengeluaran): naik = jelek (merah), turun = bagus (hijau).
  const isGood = deltaInverse ? delta < 0 : delta >= 0
  return (
    <Card className="min-w-0">
      <CardBody>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted truncate min-w-0">{label}</p>
          {Icon && (
            <span className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
              <Icon size={14} className="text-muted" />
            </span>
          )}
        </div>
        <p className={`text-2xl font-bold tnum mt-2 truncate ${tones[tone]}`}>{maskRupiah(value, hidden)}</p>
        {delta != null && Number.isFinite(delta) && (
          <div className={`flex items-center gap-1 mt-1.5 text-xs ${isGood ? 'text-positive' : 'text-negative'}`}>
            {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            <span className="tnum">{Math.abs(delta).toFixed(0)}%</span>
            <span className="text-muted">vs bulan lalu</span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
