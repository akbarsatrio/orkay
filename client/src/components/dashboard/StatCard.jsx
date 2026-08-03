import { Card, CardBody } from '../ui/index.jsx'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { maskRupiah } from '../../lib/format.js'

export default function StatCard({ label, value, icon: Icon, tone = 'default', delta, hidden = false }) {
  const tones = {
    default: 'text-fg',
    positive: 'text-positive',
    negative: 'text-negative',
  }
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">{label}</p>
          {Icon && (
            <span className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center">
              <Icon size={14} className="text-muted" />
            </span>
          )}
        </div>
        <p className={`text-2xl font-bold tnum mt-2 ${tones[tone]}`}>{maskRupiah(value, hidden)}</p>
        {delta != null && Number.isFinite(delta) && (
          <div className={`flex items-center gap-1 mt-1.5 text-xs ${delta >= 0 ? 'text-positive' : 'text-negative'}`}>
            {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            <span className="tnum">{Math.abs(delta).toFixed(0)}%</span>
            <span className="text-muted">vs bulan lalu</span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
