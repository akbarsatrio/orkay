import { useMemo, useState } from 'react'
import { TrendingDown, ShieldCheck, AlertTriangle, XCircle, Info } from 'lucide-react'
import { Card, CardBody, Badge, Segmented, Toggle } from '../ui/index.jsx'
import { maskRupiah, toISODate } from '../../lib/format.js'
import { estimateDailyBurn, projectDiscretionary, forecastToPayday } from '../../lib/selectors.js'

const STATUS = {
  aman: { icon: ShieldCheck, label: 'Aman', tone: 'text-positive border-positive/30 bg-positive/10', accent: 'text-positive' },
  mepet: { icon: AlertTriangle, label: 'Mepet', tone: 'text-warning border-warning/30 bg-warning/10', accent: 'text-warning' },
  minus: { icon: XCircle, label: 'Kurang', tone: 'text-negative border-negative/30 bg-negative/10', accent: 'text-negative' },
}

const METHODS = [
  { value: 'mean', label: 'Rata2', desc: 'Total belanja dibagi jumlah hari. Simpel, tapi gampang naik kalau ada sekali belanja gede.' },
  { value: 'median', label: 'Median', desc: 'Nilai belanja hari tengah. Tahan terhadap hari boros, cerminkan hari biasa.' },
  { value: 'weekpart', label: 'Wd/We', desc: 'Rata-rata hari kerja & weekend dipisah. Paling pas kalau pola jajanmu beda saat weekend.' },
  { value: 'trim', label: 'Trim', desc: 'Rata-rata setelah membuang 10% hari paling boros. Kompromi antara rata-rata & median.' },
]

function narrative(forecast, includeBurn) {
  const { status, tagihanTotal, belanjaEstimasi } = forecast
  if (tagihanTotal === 0 && (!includeBurn || belanjaEstimasi === 0)) {
    return 'Belum ada tagihan sampai gajian berikutnya.'
  }
  if (status === 'minus') return 'Saldo diperkirakan tidak cukup sampai gajian.'
  if (status === 'mepet') return 'Sisa tipis. Hati-hati pengeluaran sampai gajian.'
  return includeBurn
    ? 'Aman, sudah termasuk perkiraan belanja harian.'
    : 'Aman menutup semua tagihan sampai gajian.'
}

export default function CashflowForecast({ totalBalance, bills, transactions, paydayISO, daysToPay, now, hidden }) {
  const [method, setMethod] = useState('weekpart')
  const [includeBurn, setIncludeBurn] = useState(true)

  const ref = now || new Date()
  const estimate = useMemo(
    () => estimateDailyBurn(transactions, ref, 60, method),
    [transactions, method, paydayISO]
  )
  const discretionary = useMemo(
    () => (includeBurn ? projectDiscretionary(estimate, toISODate(ref), paydayISO) : 0),
    [estimate, includeBurn, paydayISO]
  )
  const forecast = useMemo(
    () => forecastToPayday({ totalBalance, bills, paydayISO, discretionary, bufferRatio: 0.1 }),
    [totalBalance, bills, paydayISO, discretionary]
  )

  const meta = STATUS[forecast.status] || STATUS.aman
  const Icon = meta.icon
  const rate = method === 'weekpart'
    ? (estimate.weekday + estimate.weekend) / 2
    : estimate.perDay

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
        <p className="text-sm text-muted mt-1">{narrative(forecast, includeBurn)}</p>

        {includeBurn && (
          <div className="mt-3 space-y-2">
            <Segmented options={METHODS} value={method} onChange={setMethod} fill />
            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
              <Info size={13} className="text-accent mt-0.5 shrink-0" />
              <p className="text-2xs text-muted leading-relaxed">
                {METHODS.find((m) => m.value === method)?.desc}
              </p>
            </div>
          </div>
        )}

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
          {includeBurn && (
            <div className="flex items-center justify-between">
              <span className="text-muted">Perkiraan belanja</span>
              <span className="text-negative tnum">− {maskRupiah(forecast.belanjaEstimasi, hidden)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
            <span className="text-fg">Proyeksi saldo</span>
            <span className={`tnum ${meta.accent}`}>{maskRupiah(forecast.proyeksi, hidden)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-fg">Sertakan perkiraan belanja</p>
            {includeBurn && rate > 0 && (
              <p className="text-2xs text-muted mt-0.5">≈ {maskRupiah(rate, hidden)}/hari</p>
            )}
          </div>
          <Toggle checked={includeBurn} onChange={setIncludeBurn} />
        </div>
      </CardBody>
    </Card>
  )
}
