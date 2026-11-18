import { useMemo, useState } from 'react'
import { TrendingDown, ShieldCheck, AlertTriangle, XCircle, Info } from 'lucide-react'
import { Badge, Segmented, Toggle } from '../ui/index.jsx'
import Money from '../ui/Money.jsx'
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

  // Komposisi hari kerja vs weekend dari besok s/d gajian (buat rincian mode Wd/We).
  const dayParts = useMemo(() => {
    let weekday = 0
    let weekend = 0
    const cur = new Date(toISODate(ref) + 'T00:00:00')
    const end = new Date(paydayISO + 'T00:00:00')
    cur.setDate(cur.getDate() + 1) // mulai besok
    while (cur <= end) {
      const dow = cur.getDay()
      if (dow === 0 || dow === 6) weekend++
      else weekday++
      cur.setDate(cur.getDate() + 1)
    }
    return { weekday, weekend }
  }, [paydayISO, ref])

  return (
    <section aria-label="Proyeksi Sampai Gajian" className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <TrendingDown size={14} aria-hidden="true" />
          Proyeksi Sampai Gajian
        </p>
        <Badge className={meta.tone}>
          <Icon size={12} aria-hidden="true" /> {meta.label}
        </Badge>
      </div>

      <div className="mt-3">
        <Money value={forecast.proyeksi} hidden={hidden} size="giant" className={meta.accent} />
      </div>
      <p className="text-base text-fg mt-2">{narrative(forecast, includeBurn)}</p>

      {includeBurn && (
        <div className="mt-4 space-y-2">
          <Segmented options={METHODS} value={method} onChange={setMethod} fill />
          <div className="flex items-start gap-2 px-1">
            <Info size={13} className="text-muted mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted leading-relaxed">
              {METHODS.find((m) => m.value === method)?.desc}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <span className="text-muted">Saldo sekarang</span>
          <Money value={forecast.saldoSekarang} hidden={hidden} className="text-fg" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <span className="text-muted">
            Tagihan{typeof daysToPay === 'number' ? ` (${daysToPay} hari)` : ''}
          </span>
          <Money value={forecast.tagihanTotal} hidden={hidden} sign="-" className="text-negative" />
        </div>
        {includeBurn && (
          <div className="flex flex-wrap items-start justify-between gap-x-3">
            <div className="min-w-0">
              <span className="text-muted">Perkiraan belanja</span>
              {method === 'weekpart' && (
                <p className="text-xs text-muted mt-0.5">
                  {dayParts.weekday} hari kerja · {dayParts.weekend} weekend
                </p>
              )}
            </div>
            <Money value={forecast.belanjaEstimasi} hidden={hidden} sign="-" className="text-negative" />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-1.5 font-semibold">
          <span className="text-fg">Proyeksi saldo</span>
          <Money value={forecast.proyeksi} hidden={hidden} className={meta.accent} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Sertakan perkiraan belanja</p>
          {includeBurn && method === 'weekpart' && (
            <p className="text-xs text-muted mt-0.5">
              Hari kerja ≈ {maskRupiah(estimate.weekday, hidden)}/hari · Weekend ≈ {maskRupiah(estimate.weekend, hidden)}/hari
            </p>
          )}
          {includeBurn && method !== 'weekpart' && estimate.perDay > 0 && (
            <p className="text-xs text-muted mt-0.5">≈ {maskRupiah(estimate.perDay, hidden)}/hari</p>
          )}
        </div>
        <Toggle checked={includeBurn} onChange={setIncludeBurn} />
      </div>
    </section>
  )
}
