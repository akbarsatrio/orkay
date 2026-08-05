import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CalendarClock, Repeat, ChevronRight, Sparkles, Check, CreditCard, Layers,
} from 'lucide-react'
import { Card, CardHeader, CardBody, Button, Badge, Empty } from '../components/ui/index.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import CategoryDonut from '../components/charts/CategoryDonut.jsx'
import SpendingTrend from '../components/charts/SpendingTrend.jsx'
import CashflowBar from '../components/charts/CashflowBar.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import ConfirmRecurringModal from '../components/recurring/ConfirmRecurringModal.jsx'
import PayBillModal from '../components/paylater/PayBillModal.jsx'
import { useData } from '../context/DataContext.jsx'
import { useBalanceVisibility } from '../context/BalanceVisibilityContext.jsx'
import { formatRupiah, formatDate, monthNamesID } from '../lib/format.js'
import {
  monthlySummary, categoryBreakdown, dailySpendingTrend, cashflowByMonth,
} from '../lib/selectors.js'
import { getNextPayday, daysUntil } from '../lib/payday.js'
import { getUpcomingRecurring, periodKey } from '../lib/recurring.js'
import { getUnpaidStatements } from '../lib/paylater.js'
import { getPendingInstallments } from '../lib/installments.js'
import { buildHolidaySet } from '../lib/holidays.js'

export default function Dashboard({ onAddTransaction }) {
  const {
    transactions, recurring, accounts, installments, categoryMap, accountMap, totalBalance, totalDebt, settings,
  } = useData()
  const { hidden } = useBalanceVisibility()

  const now = new Date()
  const [holidaySet, setHolidaySet] = useState(new Set())
  const [confirmItem, setConfirmItem] = useState(null)
  const [payItem, setPayItem] = useState(null)

  useEffect(() => {
    let alive = true
    buildHolidaySet([now.getFullYear(), now.getFullYear() + 1]).then(({ set }) => {
      if (alive) setHolidaySet(set)
    })
    return () => { alive = false }
  }, [])

  const thisMonth = useMemo(() => monthlySummary(transactions, now.getFullYear(), now.getMonth()), [transactions])
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = useMemo(
    () => monthlySummary(transactions, lastMonthDate.getFullYear(), lastMonthDate.getMonth()),
    [transactions]
  )

  const expenseDelta = lastMonth.expense ? ((thisMonth.expense - lastMonth.expense) / lastMonth.expense) * 100 : null
  const incomeDelta = lastMonth.income ? ((thisMonth.income - lastMonth.income) / lastMonth.income) * 100 : null

  const breakdown = useMemo(() => categoryBreakdown(transactions, categoryMap, now.getFullYear(), now.getMonth()), [transactions, categoryMap])
  const trend = useMemo(() => dailySpendingTrend(transactions, now, 30), [transactions])
  const trendRange = trend.length ? `${trend[0].label} – ${trend[trend.length - 1].label} ${now.getFullYear()}` : ''
  const cashflow = useMemo(() => cashflowByMonth(transactions, 6, now), [transactions])

  const nextPay = useMemo(() => getNextPayday(now, settings.payDay, holidaySet), [settings.payDay, holidaySet])
  const daysToPay = daysUntil(nextPay.effective, now)

  const upcoming = useMemo(() => getUpcomingRecurring(recurring, 14, now), [recurring])
  const upcomingUnconfirmed = upcoming.filter((u) => !u.confirmed)

  const unpaidStatements = useMemo(() => getUnpaidStatements(accounts, transactions, now), [accounts, transactions])
  const pendingInstallments = useMemo(() => getPendingInstallments(installments, accounts, now), [installments, accounts])
  const hasPaylaterBills = unpaidStatements.length > 0 || pendingInstallments.length > 0

  const recentTx = transactions.slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Saldo" value={totalBalance} icon={Wallet} hidden={hidden} />
        <StatCard label={`Pemasukan ${monthNamesID[now.getMonth()]}`} value={thisMonth.income} icon={ArrowDownLeft} tone="positive" delta={incomeDelta} />
        <StatCard label={`Pengeluaran ${monthNamesID[now.getMonth()]}`} value={thisMonth.expense} icon={ArrowUpRight} tone="negative" delta={expenseDelta} deltaInverse />
        <StatCard label="Selisih (Net)" value={thisMonth.net} icon={Sparkles} tone={thisMonth.net >= 0 ? 'positive' : 'negative'} />
      </div>

      {/* Payday + Upcoming recurring */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 bg-gradient-to-br from-accent/[0.08] to-transparent">
          <CardBody>
            <div className="flex items-center gap-2 text-accent">
              <CalendarClock size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Gajian Berikutnya</span>
            </div>
            <p className="text-2xl font-bold text-fg mt-3">
              {daysToPay === 0 ? 'Hari ini! 🎉' : daysToPay === 1 ? 'Besok' : `${daysToPay} hari lagi`}
            </p>
            <p className="text-sm text-muted mt-1">{formatDate(nextPay.effective, { withDay: true })}</p>
            {nextPay.shifted && (
              <div className="mt-3">
                <Badge className="text-warning border-warning/30 bg-warning/10">
                  Dimajukan dari tgl {settings.payDay} ({nextPay.reason})
                </Badge>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 min-w-0">
          <CardHeader
            title="Tagihan Akan Datang"
            subtitle="14 hari ke depan"
            action={<Link to="/recurring" className="text-xs text-accent font-medium inline-flex items-center gap-0.5">Lihat semua <ChevronRight size={13} /></Link>}
          />
          <CardBody className="p-0">
            {upcomingUnconfirmed.length === 0 && !hasPaylaterBills ? (
              <Empty icon={Repeat} title="Tidak ada tagihan dalam waktu dekat" description="Semua aman untuk 2 minggu ke depan." />
            ) : (
              <div className="divide-y divide-border">
                {upcomingUnconfirmed.slice(0, 3).map((u, i) => {
                  const cat = categoryMap[u.recurring.categoryId]
                  const dueD = new Date(u.dueDate + 'T00:00:00')
                  const period = periodKey(dueD.getFullYear(), dueD.getMonth())
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <CategoryIcon name={cat?.icon || 'ReceiptText'} color={cat?.color || '#71717a'} size={16} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg truncate">{u.recurring.name}</p>
                        <p className="text-2xs text-muted">
                          {u.daysAway === 0 ? 'Jatuh tempo hari ini' : `${u.daysAway} hari lagi`} · {formatDate(u.dueDate, { short: true })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm font-semibold text-fg tnum whitespace-nowrap">{formatRupiah(u.recurring.amount)}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmItem({ recurring: u.recurring, dueDate: u.dueDate, period, isDue: u.daysAway === 0 })}
                        >
                          <Check size={13} /> Bayar
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {unpaidStatements.slice(0, 2).map((st) => (
                  <div key={st.account.id + st.period} className="flex items-center gap-3 px-5 py-3">
                    <span className="inline-flex items-center justify-center rounded-lg shrink-0 h-8 w-8 bg-accent/10 text-accent">
                      <CreditCard size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg truncate">Tagihan {st.account.name}</p>
                      <p className="text-2xs text-muted">Statement {st.period} · jatuh tempo {formatDate(st.dueDate, { short: true })}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-sm font-semibold text-fg tnum whitespace-nowrap">{formatRupiah(st.unpaid)}</span>
                      <Button size="sm" variant="secondary" onClick={() => setPayItem({ kind: 'statement', account: st.account, period: st.period, dueDate: st.dueDate, unpaid: st.unpaid })}>
                        <Check size={13} /> Bayar
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingInstallments.slice(0, 2).map((it) => (
                  <div key={it.installment.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="inline-flex items-center justify-center rounded-lg shrink-0 h-8 w-8 bg-accent/10 text-accent">
                      <Layers size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg truncate">{it.installment.name} · cicilan {it.termin}/{it.installment.tenor}</p>
                      <p className="text-2xs text-muted">{it.account?.name} · jatuh tempo {formatDate(it.dueDate, { short: true })}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-sm font-semibold text-fg tnum whitespace-nowrap">{formatRupiah(it.amount)}</span>
                      <Button size="sm" variant="secondary" onClick={() => setPayItem({ kind: 'installment', installment: it.installment, account: it.account, termin: it.termin, dueDate: it.dueDate, amount: it.amount })}>
                        <Check size={13} /> Bayar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="min-w-0">
          <CardHeader title="Pengeluaran per Kategori" subtitle={`${monthNamesID[now.getMonth()]} ${now.getFullYear()}`} />
          <CardBody className="min-w-0"><CategoryDonut data={breakdown} /></CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Tren Pengeluaran Harian" subtitle={trendRange} />
          <CardBody className="min-w-0"><SpendingTrend data={trend} /></CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Arus Kas 6 Bulan Terakhir" subtitle="Pemasukan vs pengeluaran" />
        <CardBody><CashflowBar data={cashflow} /></CardBody>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader
          title="Transaksi Terbaru"
          action={<Link to="/transactions" className="text-xs text-accent font-medium inline-flex items-center gap-0.5">Semua transaksi <ChevronRight size={13} /></Link>}
        />
        <CardBody className="p-0">
          {recentTx.length === 0 ? (
            <Empty
              icon={Wallet}
              title="Belum ada transaksi"
              description="Mulai catat pengeluaran pertamamu."
              action={<Button onClick={onAddTransaction}>Tambah Transaksi</Button>}
            />
          ) : (
            <div className="divide-y divide-border">
              {recentTx.map((t) => {
                if (t.type === 'transfer') {
                  const fromAcc = accountMap[t.fromAccountId]
                  const toAcc = accountMap[t.toAccountId]
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="inline-flex items-center justify-center rounded-lg shrink-0 h-8 w-8 bg-accent/10 text-accent">
                        <ArrowLeftRight size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg truncate">{t.note || 'Transfer'}</p>
                        <p className="text-2xs text-muted">
                          {formatDate(t.date, { short: true })} · {fromAcc?.name || '—'} → {toAcc?.name || '—'}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tnum text-muted inline-flex items-center gap-1">
                        <ArrowLeftRight size={12} />{formatRupiah(t.amount)}
                      </span>
                    </div>
                  )
                }
                const cat = categoryMap[t.categoryId]
                const acc = accountMap[t.accountId]
                const isIncome = t.type === 'income'
                return (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <CategoryIcon name={cat?.icon || 'Circle'} color={cat?.color || '#71717a'} size={16} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg truncate">{t.note || cat?.name}</p>
                      <p className="text-2xs text-muted">{formatDate(t.date, { short: true })} · {acc?.name}</p>
                    </div>
                    <span className={`text-sm font-semibold tnum ${isIncome ? 'text-positive' : 'text-fg'}`}>
                      {isIncome ? '+' : '−'}{formatRupiah(t.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmRecurringModal open={!!confirmItem} item={confirmItem} onClose={() => setConfirmItem(null)} />
      <PayBillModal open={!!payItem} item={payItem} onClose={() => setPayItem(null)} />
    </div>
  )
}
