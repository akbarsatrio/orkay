import { useMemo, useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Pencil, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Card, CardBody, Button, Empty } from '../components/ui/index.jsx'
import Money from '../components/ui/Money.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import AccountForm from '../components/accounts/AccountForm.jsx'
import SnapshotForm from '../components/investments/SnapshotForm.jsx'
import { useData } from '../context/DataContext.jsx'
import { useBalanceVisibility } from '../context/BalanceVisibilityContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { formatRupiah, maskRupiah, formatDate } from '../lib/format.js'
import { computeSnapshotSeries } from '../lib/investment.js'

export default function Investments() {
  const {
    accounts, investmentSnapshots, investmentSummary, totalInvestmentValue,
    deleteInvestmentSnapshot,
  } = useData()
  const { hidden } = useBalanceVisibility()

  const investAccounts = useMemo(() => accounts.filter((a) => a.kind === 'investment'), [accounts])
  const [accForm, setAccForm] = useState({ open: false, editing: null })
  const [snapForm, setSnapForm] = useState({ open: false, accountId: null, editing: null })
  const confirm = useConfirm()

  // total gabungan
  const totals = useMemo(() => {
    let netInvested = 0, cumulativeReturn = 0, totalFee = 0, totalTax = 0
    for (const s of Object.values(investmentSummary)) {
      netInvested += s.netInvested || 0
      cumulativeReturn += s.cumulativeReturn || 0
      totalFee += s.totalFee || 0
      totalTax += s.totalTax || 0
    }
    const returnPct = netInvested > 0 ? (cumulativeReturn / netInvested) * 100 : 0
    return { netInvested, cumulativeReturn, totalFee, totalTax, returnPct }
  }, [investmentSummary])

  const snapshotsByAccount = useMemo(() => {
    const map = {}
    for (const s of investmentSnapshots) (map[s.accountId] ||= []).push(s)
    return map
  }, [investmentSnapshots])

  const handleDeleteSnap = (snap) => {
    confirm({
      title: 'Hapus catatan investasi',
      message: <>Hapus catatan periode <b>{formatDate(snap.date)}</b>?</>,
      detail: snap.linkedTxId
        ? 'Transfer terkait dari/ke rekening cash ikut terhapus. Perhitungan periode setelahnya akan menyesuaikan.'
        : 'Perhitungan periode setelahnya akan menyesuaikan.',
      onConfirm: () => deleteInvestmentSnapshot(snap.id),
    })
  }

  const gain = totals.cumulativeReturn
  const gainColor = gain > 0 ? 'text-positive' : gain < 0 ? 'text-negative' : 'text-fg'

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted">Total nilai portfolio</p>
          <div className="mt-2">
            <Money size="giant" value={hidden ? 0 : totalInvestmentValue} hidden={hidden} className="text-fg" />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[13px]">
            <span className="text-muted">Modal bersih <span className="tnum whitespace-nowrap">{maskRupiah(totals.netInvested, hidden)}</span></span>
            <span className={`tnum whitespace-nowrap font-medium ${gainColor}`}>
              {gain >= 0 ? '▲' : '▼'} {maskRupiah(Math.abs(gain), hidden)}
              {totals.netInvested > 0 && ` (${totals.returnPct >= 0 ? '+' : ''}${totals.returnPct.toFixed(1)}%)`}
            </span>
            {(totals.totalFee + totals.totalTax) > 0 && (
              <span className="text-muted">Biaya <span className="tnum whitespace-nowrap">{maskRupiah(totals.totalFee + totals.totalTax, hidden)}</span></span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setAccForm({ open: true, editing: null })}>
            <Plus size={16} /> Rekening
          </Button>
          <Button onClick={() => setSnapForm({ open: true, accountId: null, editing: null })} disabled={investAccounts.length === 0}>
            <Plus size={16} /> Catat Periode
          </Button>
        </div>
      </section>

      {investAccounts.length === 0 ? (
        <Card>
          <Empty
            icon={TrendingUp}
            title="Belum ada rekening investasi"
            description="Buat rekening tipe Investasi untuk mulai melacak nilai portfolio & untung/rugi mark-to-market."
            action={<Button onClick={() => setAccForm({ open: true, editing: null })}><Plus size={16} /> Tambah Rekening Investasi</Button>}
          />
        </Card>
      ) : (
        investAccounts.map((acc) => {
          const sum = investmentSummary[acc.id] || {}
          const series = computeSnapshotSeries(snapshotsByAccount[acc.id] || []).reverse() // terbaru dulu
          const ret = sum.cumulativeReturn || 0
          const retColor = ret > 0 ? 'text-positive' : ret < 0 ? 'text-negative' : 'text-fg'
          const RetIcon = ret >= 0 ? TrendingUp : TrendingDown

          return (
            <Card key={acc.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon name={acc.icon || 'TrendingUp'} color={acc.color} size={18} />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-fg truncate">{acc.name}</p>
                      <p className="text-[13px] text-muted">Investasi · {sum.count || 0} catatan</p>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setSnapForm({ open: true, accountId: acc.id, editing: null })}>
                    <Plus size={14} /> Catat
                  </Button>
                </div>

                {/* metrik */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4 mt-5">
                  <Metric label="Nilai sekarang" value={maskRupiah(sum.marketValue || 0, hidden)} />
                  <Metric label="Modal bersih" value={maskRupiah(sum.netInvested || 0, hidden)} />
                  <Metric
                    label="Untung/rugi"
                    value={(ret >= 0 ? '+' : '−') + formatRupiah(Math.abs(ret)).replace('Rp', 'Rp')}
                    valueClass={retColor}
                    icon={RetIcon}
                  />
                  <Metric
                    label="Return %"
                    value={`${(sum.returnPct || 0) >= 0 ? '+' : ''}${(sum.returnPct || 0).toFixed(1)}%`}
                    valueClass={retColor}
                  />
                </div>

                {(sum.totalFee > 0 || sum.totalTax > 0) && (
                  <p className="text-[13px] text-muted mt-3">
                    Total biaya: fee {formatRupiah(sum.totalFee || 0)} · tax {formatRupiah(sum.totalTax || 0)}
                  </p>
                )}

                {/* riwayat periode */}
                {series.length > 0 && (
                  <div className="mt-5 border-t border-border pt-2 divide-y divide-border [&>*:last-child]:pb-0">
                    {series.map((s) => {
                      const isW = s.withdrawal > 0
                      const rn = s.returnNet || 0
                      return (
                        <div key={s.id} className="group flex items-center gap-2 sm:gap-3 py-2.5 text-[13px] sm:text-sm">
                          <div className={`h-8 w-8 shrink-0 flex items-center justify-center ${isW ? 'text-negative' : 'text-positive'}`}>
                            {isW ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-fg font-medium break-words">
                              <span className="tnum whitespace-nowrap">{isW ? `Tarik ${formatRupiah(s.withdrawal)}` : s.contribution > 0 ? `Setor ${formatRupiah(s.contribution)}` : 'Update nilai'}</span>
                              {s.note ? <span className="text-muted font-normal"> · {s.note}</span> : null}
                            </p>
                            <p className="text-xs text-muted">{formatDate(s.date, { short: true })} · nilai <span className="tnum whitespace-nowrap">{formatRupiah(s.marketValue)}</span></p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`tnum whitespace-nowrap font-semibold ${rn > 0 ? 'text-positive' : rn < 0 ? 'text-negative' : 'text-muted'}`}>
                              {rn === 0 ? '-' : (rn > 0 ? '+' : '−') + formatRupiah(Math.abs(rn))}
                            </p>
                            {(s.fee > 0 || s.tax > 0) && (
                              <p className="text-xs text-muted tnum whitespace-nowrap">biaya {formatRupiah((s.fee || 0) + (s.tax || 0))}</p>
                            )}
                          </div>
                          <div className="flex gap-0.5 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 touch:opacity-100 transition-opacity">
                            <button onClick={() => setSnapForm({ open: true, accountId: acc.id, editing: s })} className="h-8 w-8 touch:h-11 touch:w-11 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface-2 active:bg-surface-2">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteSnap(s)} className="h-8 w-8 touch:h-11 touch:w-11 flex items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 active:bg-negative/10">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {series.length === 0 && (
                  <p className="text-[13px] text-muted mt-5 border-t border-border pt-3">
                    Belum ada catatan. Klik “Catat” untuk input setoran + nilai portfolio periode pertama.
                  </p>
                )}
              </CardBody>
            </Card>
          )
        })
      )}

      <AccountForm open={accForm.open} editing={accForm.editing} onClose={() => setAccForm({ open: false, editing: null })} />
      <SnapshotForm
        open={snapForm.open}
        accountId={snapForm.accountId}
        editing={snapForm.editing}
        onClose={() => setSnapForm({ open: false, accountId: null, editing: null })}
      />
    </div>
  )
}

function Metric({ label, value, valueClass = 'text-fg', icon: Icon }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`text-[15px] font-semibold tnum mt-1 flex flex-wrap items-center gap-1 [overflow-wrap:anywhere] ${valueClass}`}>
        {Icon && <Icon size={14} className="shrink-0" />}{value}
      </p>
    </div>
  )
}
