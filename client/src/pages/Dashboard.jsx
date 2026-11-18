import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CalendarClock, Repeat, ChevronRight, Scale, CreditCard, Layers,
} from 'lucide-react'
import { Card, CardHeader, Button, Badge, Empty } from '../components/ui/index.jsx'
import Money from '../components/ui/Money.jsx'
import SummaryPanel from '../components/dashboard/SummaryPanel.jsx'
import CategoryDonut from '../components/charts/CategoryDonut.jsx'
import SpendingTrend from '../components/charts/SpendingTrend.jsx'
import CashflowBar from '../components/charts/CashflowBar.jsx'
import NetWorthTrend from '../components/charts/NetWorthTrend.jsx'
import CashflowForecast from '../components/dashboard/CashflowForecast.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import BillRow, { BillIcon } from '../components/bills/BillRow.jsx'
import ConfirmRecurringModal from '../components/recurring/ConfirmRecurringModal.jsx'
import PayBillModal from '../components/paylater/PayBillModal.jsx'
import { useData } from '../context/DataContext.jsx'
import { useBalanceVisibility } from '../context/BalanceVisibilityContext.jsx'
import { formatDate, monthNamesID } from '../lib/format.js'
import {
  monthlySummary, categoryBreakdown, dailySpendingTrend, cashflowByMonth,
  netWorthTrend,
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
  const netWorth = useMemo(() => netWorthTrend(accounts, transactions, installments, 6, now), [accounts, transactions, installments])

  const nextPay = useMemo(
    () => getNextPayday(now, settings.payDay, holidaySet, settings.payDayShift),
    [settings.payDay, settings.payDayShift, holidaySet]
  )
  const daysToPay = daysUntil(nextPay.effective, now)

  const upcoming = useMemo(() => getUpcomingRecurring(recurring, 14, now), [recurring])
  const upcomingUnconfirmed = upcoming.filter((u) => !u.confirmed)

  const unpaidStatements = useMemo(() => getUnpaidStatements(accounts, transactions, now), [accounts, transactions])
  const pendingInstallments = useMemo(() => getPendingInstallments(installments, accounts, now), [installments, accounts])
  const hasPaylaterBills = unpaidStatements.length > 0 || pendingInstallments.length > 0

  // Semua kewajiban terjadwal yang jatuh tempo sebelum gajian berikutnya (buat forecast).
  const forecastBills = useMemo(() => {
    const window = Math.max(daysToPay, 0)
    const recurringBills = getUpcomingRecurring(recurring, window, now)
      .filter((u) => !u.confirmed)
      .map((u) => ({ name: u.recurring.name, dueDate: u.dueDate, amount: u.recurring.amount }))
    const statementBills = unpaidStatements.map((st) => ({
      name: `Tagihan ${st.account.name}`, dueDate: st.dueDate, amount: st.unpaid,
    }))
    const installmentBills = pendingInstallments.map((it) => ({
      name: `${it.installment.name} (cicilan ${it.termin})`, dueDate: it.dueDate, amount: it.amount,
    }))
    return [...recurringBills, ...statementBills, ...installmentBills]
  }, [recurring, unpaidStatements, pendingInstallments, daysToPay])

  const recentTx = transactions.slice(0, 6)

  return (
    <div className="space-y-6">
      <SummaryPanel
        items={[
          { label: 'Total Saldo', value: totalBalance, icon: Wallet, hidden },
          { label: `Pemasukan ${monthNamesID[now.getMonth()]}`, value: thisMonth.income, icon: ArrowDownLeft, tone: 'positive', delta: incomeDelta },
          { label: `Pengeluaran ${monthNamesID[now.getMonth()]}`, value: thisMonth.expense, icon: ArrowUpRight, tone: 'negative', delta: expenseDelta, deltaInverse: true },
          { label: 'Selisih (Net)', value: thisMonth.net, icon: Scale, tone: thisMonth.net >= 0 ? 'positive' : 'negative' },
        ]}
      />

      {/* Gajian + proyeksi (fokus layar) + tagihan akan datang */}
      <div className="grid lg:grid-cols-3 gap-x-10 gap-y-6">
        <div className="lg:col-span-1 min-w-0 space-y-6">
          <section aria-label="Gajian Berikutnya" className="border-t border-rule pt-5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
              <CalendarClock size={14} aria-hidden="true" />
              Gajian Berikutnya
            </p>
            <p className="text-2xl font-bold text-fg mt-1.5 leading-tight">
              {daysToPay === 0 ? 'Hari ini!' : daysToPay === 1 ? 'Besok' : `${daysToPay} hari lagi`}
            </p>
            <p className="text-sm text-muted mt-1">{formatDate(nextPay.effective, { withDay: true })}</p>
            {nextPay.shifted && (
              <div className="mt-3">
                <Badge className="text-warning border-warning/30 bg-warning/10">
                  Dimajukan dari tgl {settings.payDay} ({nextPay.reason})
                </Badge>
              </div>
            )}
          </section>

          <div className="border-t border-border pt-5">
            <CashflowForecast
              totalBalance={totalBalance}
              bills={forecastBills}
              transactions={transactions}
              paydayISO={nextPay.effective}
              daysToPay={daysToPay}
              now={now}
              hidden={hidden}
            />
          </div>
        </div>

        <Card className="lg:col-span-2 min-w-0 self-start">
          <CardHeader
            title="Tagihan Akan Datang"
            subtitle="14 hari ke depan"
            action={<SeeAll to="/recurring">Lihat semua</SeeAll>}
          />
          <div className="pt-2 pb-1">
            {upcomingUnconfirmed.length === 0 && !hasPaylaterBills ? (
              <Empty icon={Repeat} title="Tidak ada tagihan dalam waktu dekat" description="Semua aman untuk 2 minggu ke depan." />
            ) : (
              <div className="divide-y divide-border [&>*:last-child]:pb-0">
                {upcomingUnconfirmed.slice(0, 3).map((u, i) => {
                  const cat = categoryMap[u.recurring.categoryId]
                  const dueD = new Date(u.dueDate + 'T00:00:00')
                  const period = periodKey(dueD.getFullYear(), dueD.getMonth())
                  return (
                    <BillRow
                      key={i}
                      icon={<CategoryIcon name={cat?.icon || 'ReceiptText'} color={cat?.color || '#71717a'} size={16} />}
                      title={u.recurring.name}
                      due={u.daysAway === 0 ? 'Jatuh tempo hari ini' : `${u.daysAway} hari lagi`}
                      urgent={u.daysAway === 0}
                      meta={formatDate(u.dueDate, { short: true })}
                      amount={u.recurring.amount}
                      actionLabel="Bayar"
                      onAction={() => setConfirmItem({ recurring: u.recurring, dueDate: u.dueDate, period, isDue: u.daysAway === 0 })}
                    />
                  )
                })}
                {unpaidStatements.slice(0, 2).map((st) => (
                  <BillRow
                    key={st.account.id + st.period}
                    icon={<BillIcon icon={CreditCard} />}
                    title={`Tagihan ${st.account.name}`}
                    meta={`Statement ${st.period} · jatuh tempo ${formatDate(st.dueDate, { short: true })}`}
                    amount={st.unpaid}
                    actionLabel="Bayar"
                    onAction={() => setPayItem({ kind: 'statement', account: st.account, period: st.period, dueDate: st.dueDate, unpaid: st.unpaid })}
                  />
                ))}
                {pendingInstallments.slice(0, 2).map((it) => (
                  <BillRow
                    key={it.installment.id}
                    icon={<BillIcon icon={Layers} />}
                    title={it.installment.name}
                    badges={<Badge className="shrink-0">cicilan {it.termin}/{it.installment.tenor}</Badge>}
                    meta={`${it.account?.name} · jatuh tempo ${formatDate(it.dueDate, { short: true })}`}
                    amount={it.amount}
                    actionLabel="Bayar"
                    onAction={() => setPayItem({ kind: 'installment', installment: it.installment, account: it.account, termin: it.termin, dueDate: it.dueDate, amount: it.amount })}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Grafik */}
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
        <ChartSection title="Pengeluaran per Kategori" subtitle={`${monthNamesID[now.getMonth()]} ${now.getFullYear()}`}>
          <CategoryDonut data={breakdown} />
        </ChartSection>
        <ChartSection title="Tren Pengeluaran Harian" subtitle={trendRange}>
          <SpendingTrend data={trend} />
        </ChartSection>
      </div>

      <ChartSection title="Kekayaan Bersih" subtitle="6 bulan terakhir">
        <NetWorthTrend data={netWorth} />
      </ChartSection>

      <ChartSection title="Arus Kas 6 Bulan Terakhir" subtitle="Pemasukan vs pengeluaran">
        <CashflowBar data={cashflow} />
      </ChartSection>

      {/* Transaksi terbaru */}
      <section className="border-t border-rule pt-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-fg leading-snug">Transaksi Terbaru</h2>
          <SeeAll to="/transactions">Semua transaksi</SeeAll>
        </div>
        {recentTx.length === 0 ? (
          <Empty
            icon={Wallet}
            title="Belum ada transaksi"
            description="Mulai catat pengeluaran pertamamu."
            action={<Button variant="accent" onClick={onAddTransaction}>Tambah Transaksi</Button>}
          />
        ) : (
          <div className="divide-y divide-border mt-2 [&>*:last-child]:pb-0">
            {recentTx.map((t) => {
              if (t.type === 'transfer') {
                const fromAcc = accountMap[t.fromAccountId]
                const toAcc = accountMap[t.toAccountId]
                return (
                  <TxRow
                    key={t.id}
                    icon={<BillIcon icon={ArrowLeftRight} />}
                    title={t.note || 'Transfer'}
                    meta={`${formatDate(t.date, { short: true })} · ${fromAcc?.name || '-'} → ${toAcc?.name || '-'}`}
                    amount={
                      <span className="inline-flex items-center gap-1 text-muted">
                        <ArrowLeftRight size={12} aria-hidden="true" />
                        <Money value={t.amount} />
                      </span>
                    }
                  />
                )
              }
              const cat = categoryMap[t.categoryId]
              const acc = accountMap[t.accountId]
              const isIncome = t.type === 'income'
              return (
                <TxRow
                  key={t.id}
                  icon={<CategoryIcon name={cat?.icon || 'Circle'} color={cat?.color || '#71717a'} size={16} />}
                  title={t.note || cat?.name}
                  meta={`${formatDate(t.date, { short: true })} · ${acc?.name}`}
                  amount={<Money value={t.amount} sign={isIncome ? '+' : '-'} className={isIncome ? 'text-positive' : 'text-fg'} />}
                />
              )
            })}
          </div>
        )}
      </section>

      <ConfirmRecurringModal open={!!confirmItem} item={confirmItem} onClose={() => setConfirmItem(null)} />
      <PayBillModal open={!!payItem} item={payItem} onClose={() => setPayItem(null)} />
    </div>
  )
}

function SeeAll({ to, children }) {
  return (
    <Link
      to={to}
      className="shrink-0 inline-flex items-center gap-0.5 min-h-9 touch:min-h-11 -my-2 text-[13px] font-medium text-fg hover:underline underline-offset-2"
    >
      {children} <ChevronRight size={14} aria-hidden="true" />
    </Link>
  )
}

function TxRow({ icon, title, meta, amount }) {
  return (
    <div className="flex items-center gap-3 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg truncate">{title}</p>
        <p className="text-xs text-muted">{meta}</p>
      </div>
      <span className="text-[15px] font-semibold shrink-0">{amount}</span>
    </div>
  )
}

function ChartSection({ title, subtitle, children }) {
  return (
    <section className="border-t border-rule pt-5 min-w-0">
      <h2 className="text-lg font-semibold text-fg leading-snug">{title}</h2>
      {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  )
}
