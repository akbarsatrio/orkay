import { useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Repeat, CheckCircle2, Clock, CreditCard, Layers,
} from 'lucide-react'
import { Card, CardBody, CardHeader, Button, Badge, Empty, Progress, Toggle } from '../components/ui/index.jsx'
import Money from '../components/ui/Money.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import BillRow, { BillIcon } from '../components/bills/BillRow.jsx'
import RecurringForm from '../components/recurring/RecurringForm.jsx'
import ConfirmRecurringModal from '../components/recurring/ConfirmRecurringModal.jsx'
import PayBillModal from '../components/paylater/PayBillModal.jsx'
import { useData } from '../context/DataContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { formatRupiah, formatDate, monthNamesID } from '../lib/format.js'
import { getPendingRecurring, periodKey } from '../lib/recurring.js'
import { getUnpaidStatements } from '../lib/paylater.js'
import { getPendingInstallments } from '../lib/installments.js'

const DUE_BADGE = 'text-warning border-warning/30 bg-warning/10'
// Lebar kolom aksi disamakan (8rem) di semua daftar supaya kolom nominal lurus dari atas ke bawah.
const ACTION_WIDTH = 'sm:min-w-[8rem]'
const iconBtn =
  'h-9 w-9 touch:h-11 touch:w-11 flex items-center justify-center rounded-md text-muted transition-colors focus-visible:opacity-100'

export default function Recurring() {
  const { recurring, accounts, transactions, installments, categoryMap, accountMap, updateRecurring, deleteRecurring, deleteInstallment } = useData()
  const [form, setForm] = useState({ open: false, editing: null })
  const [confirmItem, setConfirmItem] = useState(null)
  const [payItem, setPayItem] = useState(null)
  const confirm = useConfirm()

  const now = new Date()
  const pending = useMemo(() => getPendingRecurring(recurring, now), [recurring])
  const unpaidStatements = useMemo(() => getUnpaidStatements(accounts, transactions, now), [accounts, transactions])
  const pendingInstallments = useMemo(() => getPendingInstallments(installments, accounts, now), [installments, accounts])

  const monthlyTotal = recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0)
  const activeCount = recurring.filter((r) => r.active).length
  const thisPeriod = periodKey(now.getFullYear(), now.getMonth())
  const openNew = () => setForm({ open: true, editing: null })

  return (
    <div className="space-y-6">
      {/* Ringkasan: total per bulan jadi angka raksasa (fokus layar) */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted">Total tagihan aktif / bulan</p>
          <div className="mt-2">
            <Money size="giant" value={monthlyTotal} className="text-fg" />
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted mt-3">
            <span>{activeCount} tagihan aktif</span>
            <span aria-hidden="true">·</span>
            <span>
              Menunggu konfirmasi{' '}
              <b className={`tnum ${pending.length ? 'text-warning' : 'text-fg'}`}>{pending.length}</b>, belum dicatat bulan ini
            </span>
          </p>
        </div>
        <Button className="shrink-0" onClick={openNew}>
          <Plus size={16} /> Tambah
        </Button>
      </section>

      {/* Pending confirmation */}
      {pending.length > 0 && (
        <Card>
          <CardHeader
            title="Perlu Konfirmasi"
            subtitle="Tagihan bulan ini yang belum dicatat. Konfirmasi kapan pun kamu bayar, nanti tinggal pilih tanggalnya."
          />
          <CardBody className="divide-y divide-border pt-1 [&>*:last-child]:pb-0">
            {pending.map((p) => {
              const cat = categoryMap[p.recurring.categoryId]
              const acc = accountMap[p.recurring.accountId]
              return (
                <BillRow
                  key={p.recurring.id}
                  icon={<CategoryIcon name={cat?.icon || 'ReceiptText'} color={cat?.color || '#71717a'} size={16} />}
                  title={p.recurring.name}
                  badges={p.isDue
                    ? <Badge className={DUE_BADGE}>jatuh tempo</Badge>
                    : <Badge className="text-muted">belum jatuh tempo</Badge>}
                  meta={`Jatuh tempo ${formatDate(p.dueDate)} · ${acc?.name}`}
                  amount={p.recurring.amount}
                  actionLabel="Konfirmasi"
                  onAction={() => setConfirmItem(p)}
                  actionWidth={ACTION_WIDTH}
                />
              )
            })}
          </CardBody>
        </Card>
      )}

      {/* Pay Later & Cicilan */}
      {(unpaidStatements.length > 0 || pendingInstallments.length > 0) && (
        <Card>
          <CardHeader
            title="Tagihan Pay Later & Cicilan"
            subtitle="Tagihan kartu / pay later yang sudah closing dan cicilan yang jatuh tempo. Bayar dari rekening cash."
          />
          <CardBody className="divide-y divide-border pt-1 [&>*:last-child]:pb-0">
            {unpaidStatements.map((st) => (
              <BillRow
                key={st.account.id + st.period}
                icon={<BillIcon icon={CreditCard} />}
                title={`Tagihan ${st.account.name}`}
                meta={`Statement ${st.period} · jatuh tempo ${formatDate(st.dueDate, { short: true })}`}
                amount={st.unpaid}
                actionLabel="Bayar"
                onAction={() => setPayItem({ kind: 'statement', account: st.account, period: st.period, dueDate: st.dueDate, unpaid: st.unpaid })}
                actionWidth={ACTION_WIDTH}
              />
            ))}
            {pendingInstallments.map((it) => (
              <BillRow
                key={it.installment.id}
                icon={<BillIcon icon={Layers} />}
                title={it.installment.name}
                badges={<>
                  <Badge>cicilan {it.termin}/{it.installment.tenor}</Badge>
                  {it.isDue && <Badge className={DUE_BADGE}>jatuh tempo</Badge>}
                </>}
                meta={`${it.account?.name} · jatuh tempo ${formatDate(it.dueDate, { short: true })}`}
                amount={it.amount}
                actionLabel="Bayar"
                onAction={() => setPayItem({ kind: 'installment', installment: it.installment, account: it.account, termin: it.termin, dueDate: it.dueDate, amount: it.amount })}
                actionWidth={ACTION_WIDTH}
              />
            ))}
          </CardBody>
        </Card>
      )}

      {/* All recurring */}
      <Card>
        <CardHeader title="Semua Tagihan Rutin" subtitle={`Periode ${monthNamesID[now.getMonth()]} ${now.getFullYear()}`} />
        <CardBody className="pt-1">
          {recurring.length === 0 ? (
            <Empty
              icon={Repeat}
              title="Belum ada tagihan rutin"
              description="Tambahkan tagihan tetap seperti kos, internet, atau langganan."
              action={<Button onClick={openNew}><Plus size={16} /> Tambah Tagihan</Button>}
            />
          ) : (
            <div className="divide-y divide-border [&>*:last-child]:pb-0">
              {recurring.map((r) => {
                const cat = categoryMap[r.categoryId]
                const acc = accountMap[r.accountId]
                const confirmed = (r.generatedPeriods || []).includes(thisPeriod)
                return (
                  // HP: baris 1 = ikon | nama | nominal, baris 2 = status + aksi.
                  // Desktop: satu baris ikon | nama | status | nominal | aksi (urutan diatur dengan `order`).
                  <div
                    key={r.id}
                    className="group grid grid-cols-[34px_minmax(0,1fr)_auto] md:grid-cols-[34px_minmax(0,1fr)_11rem_8rem_auto] items-center gap-x-3 md:gap-x-5 gap-y-2 py-3.5"
                  >
                    <span className={r.active ? '' : 'opacity-50'}>
                      <CategoryIcon name={cat?.icon || 'ReceiptText'} color={cat?.color || '#71717a'} size={16} />
                    </span>
                    <div className={`min-w-0 ${r.active ? '' : 'opacity-60'}`}>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                        <span className="text-[15px] font-medium text-fg truncate max-w-full">{r.name}</span>
                        {!r.active && <Badge>nonaktif</Badge>}
                      </p>
                      <p className="text-[13px] text-muted mt-0.5">
                        Tiap tgl {r.dueDay} · {acc?.name} · {cat?.name}
                      </p>
                    </div>

                    <Money
                      value={r.amount}
                      className={`text-base font-semibold text-right md:order-4 ${r.active ? 'text-fg' : 'text-muted'}`}
                    />

                    <div className="col-start-2 col-span-2 flex items-center justify-between gap-3 md:contents">
                      <div className="md:order-3">
                        {r.active && (
                          confirmed ? (
                            <Badge className="text-positive border-positive/30 bg-positive/10">
                              <CheckCircle2 size={12} aria-hidden="true" /> Tercatat bulan ini
                            </Badge>
                          ) : (
                            <Badge className="text-muted">
                              <Clock size={12} aria-hidden="true" /> Belum dicatat
                            </Badge>
                          )
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1 shrink-0 md:order-5 md:w-32">
                        <span className="inline-flex items-center justify-center h-9 w-12 touch:h-11">
                          <Toggle
                            checked={r.active}
                            onChange={(active) => updateRecurring(r.id, { active })}
                            label={r.active ? `Nonaktifkan ${r.name}` : `Aktifkan ${r.name}`}
                          />
                        </span>
                        <button
                          onClick={() => setForm({ open: true, editing: r })}
                          aria-label={`Ubah ${r.name}`}
                          title="Ubah"
                          className={`${iconBtn} hover:text-fg hover:bg-surface-2 lg:opacity-0 lg:group-hover:opacity-100 touch:opacity-100`}
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => confirm({
                            title: 'Hapus tagihan rutin',
                            message: <>Hapus tagihan <b>{r.name}</b>?</>,
                            detail: 'Transaksi yang sudah dikonfirmasi tetap tersimpan.',
                            onConfirm: () => deleteRecurring(r.id),
                          })}
                          aria-label={`Hapus ${r.name}`}
                          title="Hapus"
                          className={`${iconBtn} hover:text-negative hover:bg-negative/10 lg:opacity-0 lg:group-hover:opacity-100 touch:opacity-100`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Cicilan aktif */}
      {installments.filter((i) => i.active).length > 0 && (
        <Card>
          <CardHeader title="Cicilan Aktif" subtitle="Progress pembayaran tiap cicilan pay later." />
          <CardBody className="divide-y divide-border pt-1 [&>*:last-child]:pb-0">
            {installments.filter((i) => i.active).map((inst) => {
              const acc = accountMap[inst.accountId]
              const cat = categoryMap[inst.categoryId]
              const pct = (inst.paidCount / inst.tenor) * 100
              const remaining = Math.max(0, inst.tenor - inst.paidCount)
              return (
                // HP: progres turun ke baris kedua; desktop: progres jadi kolom di kanan nama.
                <div
                  key={inst.id}
                  className="group grid grid-cols-[34px_minmax(0,1fr)_auto] md:grid-cols-[34px_minmax(0,1fr)_minmax(0,18rem)_auto] items-center gap-x-3 md:gap-x-5 gap-y-2 py-3.5"
                >
                  <CategoryIcon name={cat?.icon || 'Layers'} color={cat?.color || '#71717a'} size={16} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-fg truncate">{inst.name}</p>
                    <p className="text-[13px] text-muted mt-0.5">{acc?.name} · {formatRupiah(inst.monthlyAmount)}/bln</p>
                  </div>
                  <div className="col-start-2 col-span-2 order-last md:order-none md:col-auto">
                    <div className="flex justify-between gap-3 text-xs mb-1.5">
                      <span className="tnum font-medium text-fg">{inst.paidCount}/{inst.tenor}x</span>
                      <span className="tnum text-muted">{pct.toFixed(0)}% lunas</span>
                    </div>
                    <Progress value={inst.paidCount} max={inst.tenor} color="rgb(var(--fg))" />
                    <p className="text-xs text-muted tnum mt-1.5">Sisa {remaining}x = {formatRupiah(remaining * inst.monthlyAmount)}</p>
                  </div>
                  <button
                    onClick={() => confirm({
                      title: 'Hapus cicilan',
                      message: <>Hapus cicilan <b>{inst.name}</b>?</>,
                      detail: 'Transaksi terkait ikut terhapus.',
                      onConfirm: () => deleteInstallment(inst.id),
                    })}
                    aria-label={`Hapus cicilan ${inst.name}`}
                    title="Hapus"
                    className={`${iconBtn} shrink-0 hover:text-negative hover:bg-negative/10 lg:opacity-0 lg:group-hover:opacity-100 touch:opacity-100`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </CardBody>
        </Card>
      )}

      <RecurringForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
      <ConfirmRecurringModal open={!!confirmItem} item={confirmItem} onClose={() => setConfirmItem(null)} />
      <PayBillModal open={!!payItem} item={payItem} onClose={() => setPayItem(null)} />
    </div>
  )
}
