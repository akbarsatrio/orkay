import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardBody, CardHeader, Button, Progress, Empty } from '../components/ui/index.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import { useData } from '../context/DataContext.jsx'
import { formatRupiah, monthNamesID } from '../lib/format.js'
import { monthlySummary, categoryBreakdown, filterMonth } from '../lib/selectors.js'
import { computeSnapshotSeries } from '../lib/investment.js'
import { FileBarChart } from 'lucide-react'

export default function Reports() {
  const { transactions, categoryMap, incomeSourceMap, accounts, investmentSnapshots, investmentSummary, totalInvestmentValue } = useData()
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const prevDate = new Date(cursor.y, cursor.m - 1, 1)

  const summary = useMemo(() => monthlySummary(transactions, cursor.y, cursor.m), [transactions, cursor])
  const prevSummary = useMemo(() => monthlySummary(transactions, prevDate.getFullYear(), prevDate.getMonth()), [transactions, cursor])
  const breakdown = useMemo(() => categoryBreakdown(transactions, categoryMap, cursor.y, cursor.m), [transactions, categoryMap, cursor])
  const incomeBreakdown = useMemo(() => {
    const txs = filterMonth(transactions, cursor.y, cursor.m).filter((t) => t.type === 'income')
    const map = {}
    for (const t of txs) {
      const key = t.incomeSourceId || 'lainnya'
      map[key] = (map[key] || 0) + t.amount
    }
    return Object.entries(map).map(([id, value]) => ({
      name: incomeSourceMap[id]?.name || 'Tanpa sumber',
      color: incomeSourceMap[id]?.color || '#71717a',
      value,
    })).sort((a, b) => b.value - a.value)
  }, [transactions, incomeSourceMap, cursor])

  // Aktivitas investasi pada bulan terpilih: setoran, tarikan, untung/rugi periode itu, biaya.
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`
  const investAccounts = useMemo(() => accounts.filter((a) => a.kind === 'investment'), [accounts])
  const investMonth = useMemo(() => {
    const byAcc = {}
    for (const s of investmentSnapshots) (byAcc[s.accountId] ||= []).push(s)
    let contribution = 0, withdrawal = 0, returnNet = 0, fee = 0, tax = 0
    const perAccount = []
    for (const a of investAccounts) {
      const series = computeSnapshotSeries(byAcc[a.id] || [])
      const inMonth = series.filter((s) => s.date.startsWith(monthPrefix))
      if (!inMonth.length) continue
      let aC = 0, aW = 0, aR = 0
      for (const s of inMonth) {
        contribution += s.contribution || 0; withdrawal += s.withdrawal || 0
        returnNet += s.returnNet || 0; fee += s.fee || 0; tax += s.tax || 0
        aC += s.contribution || 0; aW += s.withdrawal || 0; aR += s.returnNet || 0
      }
      perAccount.push({ name: a.name, color: a.color, contribution: aC, withdrawal: aW, returnNet: aR })
    }
    return { contribution, withdrawal, returnNet, fee, tax, perAccount, hasActivity: perAccount.length > 0 }
  }, [investmentSnapshots, investAccounts, monthPrefix])

  const move = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }
  const isCurrentOrFuture = cursor.y > now.getFullYear() || (cursor.y === now.getFullYear() && cursor.m >= now.getMonth())

  const totalExpense = summary.expense || 1
  const netDelta = prevSummary.net !== 0 ? ((summary.net - prevSummary.net) / Math.abs(prevSummary.net)) * 100 : null

  const compareRow = (label, cur, prev, inverse = false) => {
    const diff = cur - prev
    const pct = prev ? (diff / prev) * 100 : null
    return { label, cur, prev, diff, pct, inverse }
  }
  const comparisons = [
    compareRow('Pemasukan', summary.income, prevSummary.income),
    compareRow('Pengeluaran', summary.expense, prevSummary.expense, true),
    compareRow('Selisih (Net)', summary.net, prevSummary.net),
  ]

  return (
    <div className="space-y-6">
      {/* Month picker */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button size="icon" variant="secondary" onClick={() => move(-1)}><ChevronLeft size={16} /></Button>
          <div className="text-center">
            <p className="text-lg font-bold text-fg">{monthNamesID[cursor.m]} {cursor.y}</p>
            <p className="text-2xs text-muted">{summary.count} transaksi</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" onClick={() => move(1)} disabled={isCurrentOrFuture}><ChevronRight size={16} /></Button>
            <Button size="icon" variant="secondary" onClick={() => window.print()} title="Cetak / simpan PDF"><Printer size={16} /></Button>
          </div>
        </div>
      </Card>

      {summary.count === 0 ? (
        <Card><Empty icon={FileBarChart} title="Tidak ada data di bulan ini" description="Pilih bulan lain atau tambahkan transaksi." /></Card>
      ) : (
        <>
          {/* Big summary */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardBody>
              <div className="flex items-center gap-2 text-positive"><ArrowDownLeft size={15} /><span className="text-xs font-medium">Total Pemasukan</span></div>
              <p className="text-2xl font-bold text-fg tnum mt-2">{formatRupiah(summary.income)}</p>
            </CardBody></Card>
            <Card><CardBody>
              <div className="flex items-center gap-2 text-negative"><ArrowUpRight size={15} /><span className="text-xs font-medium">Total Pengeluaran</span></div>
              <p className="text-2xl font-bold text-fg tnum mt-2">{formatRupiah(summary.expense)}</p>
            </CardBody></Card>
            <Card className={summary.net >= 0 ? 'bg-positive/[0.05]' : 'bg-negative/[0.05]'}><CardBody>
              <div className="flex items-center gap-2 text-muted"><Minus size={15} /><span className="text-xs font-medium">Selisih Bersih</span></div>
              <p className={`text-2xl font-bold tnum mt-2 ${summary.net >= 0 ? 'text-positive' : 'text-negative'}`}>{formatRupiah(summary.net)}</p>
              {netDelta != null && Number.isFinite(netDelta) && (
                <p className="text-2xs text-muted mt-1">{netDelta >= 0 ? '▲' : '▼'} {Math.abs(netDelta).toFixed(0)}% vs bulan lalu</p>
              )}
            </CardBody></Card>
          </div>

          {/* Comparison table */}
          <Card>
            <CardHeader title="Perbandingan dengan Bulan Lalu" subtitle={`${monthNamesID[prevDate.getMonth()]} ${prevDate.getFullYear()} → ${monthNamesID[cursor.m]} ${cursor.y}`} />
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="text-2xs text-muted uppercase tracking-wide border-b border-border">
                    <th className="text-left font-medium px-5 py-2.5">Metrik</th>
                    <th className="text-right font-medium px-5 py-2.5">Bulan Lalu</th>
                    <th className="text-right font-medium px-5 py-2.5">Bulan Ini</th>
                    <th className="text-right font-medium px-5 py-2.5">Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisons.map((c) => {
                    const good = c.inverse ? c.diff < 0 : c.diff > 0
                    const colorClass = c.diff === 0 ? 'text-muted' : good ? 'text-positive' : 'text-negative'
                    return (
                      <tr key={c.label}>
                        <td className="px-5 py-3 text-fg font-medium">{c.label}</td>
                        <td className="px-5 py-3 text-right text-muted tnum">{formatRupiah(c.prev)}</td>
                        <td className="px-5 py-3 text-right text-fg font-medium tnum">{formatRupiah(c.cur)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 tnum ${colorClass}`}>
                            {c.diff > 0 ? <TrendingUp size={13} /> : c.diff < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                            {c.pct != null ? `${Math.abs(c.pct).toFixed(0)}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardBody>
          </Card>

          {/* Breakdowns */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Rincian Pengeluaran" subtitle="Per kategori" />
              <CardBody className="space-y-3">
                {breakdown.length === 0 ? <p className="text-xs text-muted">Tidak ada pengeluaran.</p> : breakdown.map((b) => (
                  <div key={b.name}>
                    <div className="flex items-center gap-2.5 text-sm mb-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />
                      <span className="text-fg flex-1">{b.name}</span>
                      <span className="text-muted text-xs tnum">{((b.value / totalExpense) * 100).toFixed(0)}%</span>
                      <span className="font-medium text-fg tnum">{formatRupiah(b.value)}</span>
                    </div>
                    <Progress value={b.value} max={totalExpense} color={b.color} />
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Rincian Pemasukan" subtitle="Per sumber" />
              <CardBody className="space-y-3">
                {incomeBreakdown.length === 0 ? <p className="text-xs text-muted">Tidak ada pemasukan.</p> : incomeBreakdown.map((b) => (
                  <div key={b.name}>
                    <div className="flex items-center gap-2.5 text-sm mb-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />
                      <span className="text-fg flex-1">{b.name}</span>
                      <span className="text-muted text-xs tnum">{summary.income ? ((b.value / summary.income) * 100).toFixed(0) : 0}%</span>
                      <span className="font-medium text-fg tnum">{formatRupiah(b.value)}</span>
                    </div>
                    <Progress value={b.value} max={summary.income || 1} color={b.color} />
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {/* Investasi — portfolio & aktivitas bulan ini */}
      {investAccounts.length > 0 && (
        <Card>
          <CardHeader
            title="Investasi"
            subtitle={`Portfolio ${formatRupiah(totalInvestmentValue)} · aktivitas ${monthNamesID[cursor.m]} ${cursor.y}`}
          />
          <CardBody className="space-y-4">
            {/* Ringkasan aktivitas bulan ini */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-surface-2/40 p-3">
                <p className="text-2xs text-muted">Setoran bulan ini</p>
                <p className="text-lg font-bold text-fg tnum mt-0.5">{formatRupiah(investMonth.contribution)}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/40 p-3">
                <p className="text-2xs text-muted">Tarikan bulan ini</p>
                <p className="text-lg font-bold text-fg tnum mt-0.5">{formatRupiah(investMonth.withdrawal)}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/40 p-3">
                <p className="text-2xs text-muted">Untung/rugi bulan ini</p>
                <p className={`text-lg font-bold tnum mt-0.5 ${investMonth.returnNet > 0 ? 'text-positive' : investMonth.returnNet < 0 ? 'text-negative' : 'text-fg'}`}>
                  {investMonth.returnNet >= 0 ? '+' : '−'}{formatRupiah(Math.abs(investMonth.returnNet))}
                </p>
              </div>
            </div>

            {(investMonth.fee + investMonth.tax) > 0 && (
              <p className="text-2xs text-muted -mt-1">Biaya bulan ini: fee {formatRupiah(investMonth.fee)} · tax {formatRupiah(investMonth.tax)}</p>
            )}

            {!investMonth.hasActivity && (
              <p className="text-xs text-muted">Tidak ada aktivitas investasi di bulan ini.</p>
            )}

            {/* Per akun: nilai sekarang + untung/rugi total */}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Nilai portfolio per rekening</p>
              {investAccounts.map((a) => {
                const sum = investmentSummary[a.id] || { marketValue: 0, cumulativeReturn: 0, returnPct: 0 }
                const ret = sum.cumulativeReturn || 0
                const retColor = ret > 0 ? 'text-positive' : ret < 0 ? 'text-negative' : 'text-muted'
                return (
                  <div key={a.id} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                    <span className="text-fg flex-1">{a.name}</span>
                    <span className={`text-xs tnum ${retColor}`}>
                      {ret >= 0 ? '+' : '−'}{formatRupiah(Math.abs(ret))} ({(sum.returnPct || 0) >= 0 ? '+' : ''}{(sum.returnPct || 0).toFixed(1)}%)
                    </span>
                    <span className="font-medium text-fg tnum w-28 text-right">{formatRupiah(sum.marketValue || 0)}</span>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
