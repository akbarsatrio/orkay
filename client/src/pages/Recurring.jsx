import { useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Repeat, Check, CheckCircle2, Clock, Power, CreditCard, Layers,
} from 'lucide-react'
import { Card, CardBody, CardHeader, Button, Badge, Empty, Progress } from '../components/ui/index.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import RecurringForm from '../components/recurring/RecurringForm.jsx'
import ConfirmRecurringModal from '../components/recurring/ConfirmRecurringModal.jsx'
import PayBillModal from '../components/paylater/PayBillModal.jsx'
import { useData } from '../context/DataContext.jsx'
import { formatRupiah, formatDate, monthNamesID } from '../lib/format.js'
import { getPendingRecurring, dueDateFor, periodKey } from '../lib/recurring.js'
import { getUnpaidStatements } from '../lib/paylater.js'
import { getPendingInstallments } from '../lib/installments.js'

export default function Recurring() {
  const { recurring, accounts, transactions, installments, categoryMap, accountMap, updateRecurring, deleteRecurring, deleteInstallment } = useData()
  const [form, setForm] = useState({ open: false, editing: null })
  const [confirmItem, setConfirmItem] = useState(null)
  const [payItem, setPayItem] = useState(null)

  const now = new Date()
  const pending = useMemo(() => getPendingRecurring(recurring, now), [recurring])
  const unpaidStatements = useMemo(() => getUnpaidStatements(accounts, transactions, now), [accounts, transactions])
  const pendingInstallments = useMemo(() => getPendingInstallments(installments, accounts, now), [installments, accounts])

  const monthlyTotal = recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0)
  const thisPeriod = periodKey(now.getFullYear(), now.getMonth())

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <p className="text-xs text-muted">Total tagihan aktif / bulan</p>
            <p className="text-2xl font-bold text-fg tnum mt-1">{formatRupiah(monthlyTotal)}</p>
            <p className="text-2xs text-muted mt-1">{recurring.filter((r) => r.active).length} tagihan aktif</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-muted">Menunggu konfirmasi</p>
            <p className="text-2xl font-bold tnum mt-1 text-warning">{pending.length}</p>
            <p className="text-2xs text-muted mt-1">belum dicatat bulan ini</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted">Kelola</p>
              <p className="text-sm font-medium text-fg mt-1">Tagihan rutin kamu</p>
            </div>
            <Button onClick={() => setForm({ open: true, editing: null })}>
              <Plus size={16} /> Tambah
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Pending confirmation */}
      {pending.length > 0 && (
        <Card className="border-warning/30 bg-warning/[0.04]">
          <CardHeader
            title="Perlu Konfirmasi"
            subtitle="Tagihan bulan ini yang belum dicatat. Konfirmasi kapan pun kamu bayar — nanti tinggal pilih tanggalnya."
          />
          <CardBody className="space-y-2">
            {pending.map((p) => {
              const cat = categoryMap[p.recurring.categoryId]
              const acc = accountMap[p.recurring.accountId]
              return (
                <div key={p.recurring.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
                  <CategoryIcon name={cat?.icon || 'ReceiptText'} color={cat?.color || '#71717a'} size={18} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg truncate flex items-center gap-2">
                      {p.recurring.name}
                      {p.isDue ? (
                        <Badge className="text-warning border-warning/30 bg-warning/10">jatuh tempo</Badge>
                      ) : (
                        <Badge className="text-muted">belum jatuh tempo</Badge>
                      )}
                    </p>
                    <p className="text-2xs text-muted">Jatuh tempo {formatDate(p.dueDate)} · {acc?.name}</p>
                  </div>
                  <span className="text-sm font-semibold text-fg tnum">{formatRupiah(p.recurring.amount)}</span>
                  <Button size="sm" onClick={() => setConfirmItem(p)}>
                    <Check size={14} /> Konfirmasi
                  </Button>
                </div>
              )
            })}
          </CardBody>
        </Card>
      )}

      {/* Pay Later & Cicilan */}
      {(unpaidStatements.length > 0 || pendingInstallments.length > 0) && (
        <Card className="border-accent/30 bg-accent/[0.03]">
          <CardHeader
            title="Tagihan Pay Later & Cicilan"
            subtitle="Tagihan kartu / pay later yang sudah closing dan cicilan yang jatuh tempo. Bayar dari rekening cash."
          />
          <CardBody className="space-y-2">
            {unpaidStatements.map((st) => (
              <div key={st.account.id + st.period} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
                <span className="inline-flex items-center justify-center rounded-lg shrink-0 h-9 w-9 bg-accent/10 text-accent">
                  <CreditCard size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg truncate">Tagihan {st.account.name}</p>
                  <p className="text-2xs text-muted">Statement {st.period} · jatuh tempo {formatDate(st.dueDate, { short: true })}</p>
                </div>
                <span className="text-sm font-semibold text-fg tnum">{formatRupiah(st.unpaid)}</span>
                <Button size="sm" onClick={() => setPayItem({ kind: 'statement', account: st.account, period: st.period, dueDate: st.dueDate, unpaid: st.unpaid })}>
                  <Check size={14} /> Bayar
                </Button>
              </div>
            ))}
            {pendingInstallments.map((it) => (
              <div key={it.installment.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
                <span className="inline-flex items-center justify-center rounded-lg shrink-0 h-9 w-9 bg-accent/10 text-accent">
                  <Layers size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg truncate flex items-center gap-2">
                    {it.installment.name}
                    <Badge>cicilan {it.termin}/{it.installment.tenor}</Badge>
                    {it.isDue && <Badge className="text-warning border-warning/30 bg-warning/10">jatuh tempo</Badge>}
                  </p>
                  <p className="text-2xs text-muted">{it.account?.name} · jatuh tempo {formatDate(it.dueDate, { short: true })}</p>
                </div>
                <span className="text-sm font-semibold text-fg tnum">{formatRupiah(it.amount)}</span>
                <Button size="sm" onClick={() => setPayItem({ kind: 'installment', installment: it.installment, account: it.account, termin: it.termin, dueDate: it.dueDate, amount: it.amount })}>
                  <Check size={14} /> Bayar
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* All recurring */}
      <Card>
        <CardHeader title="Semua Tagihan Rutin" subtitle={`Periode ${monthNamesID[now.getMonth()]} ${now.getFullYear()}`} />
        <CardBody className="p-0">
          {recurring.length === 0 ? (
            <Empty
              icon={Repeat}
              title="Belum ada tagihan rutin"
              description="Tambahkan tagihan tetap seperti kos, internet, atau langganan."
              action={<Button onClick={() => setForm({ open: true, editing: null })}><Plus size={16} /> Tambah Tagihan</Button>}
            />
          ) : (
            <div className="divide-y divide-border">
              {recurring.map((r) => {
                const cat = categoryMap[r.categoryId]
                const acc = accountMap[r.accountId]
                const due = dueDateFor(r, now.getFullYear(), now.getMonth())
                const confirmed = (r.generatedPeriods || []).includes(thisPeriod)
                return (
                  <div key={r.id} className={`group flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2/50 transition-colors ${!r.active ? 'opacity-55' : ''}`}>
                    <CategoryIcon name={cat?.icon || 'ReceiptText'} color={cat?.color || '#71717a'} size={18} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg truncate flex items-center gap-2">
                        {r.name}
                        {!r.active && <Badge>nonaktif</Badge>}
                      </p>
                      <p className="text-2xs text-muted">
                        Tiap tgl {r.dueDay} · {acc?.name} · {cat?.name}
                      </p>
                    </div>

                    {r.active && (
                      confirmed ? (
                        <Badge className="text-positive border-positive/30 bg-positive/10">
                          <CheckCircle2 size={12} /> Tercatat bulan ini
                        </Badge>
                      ) : (
                        <Badge className="text-muted">
                          <Clock size={12} /> Belum dicatat
                        </Badge>
                      )
                    )}

                    <span className="text-sm font-semibold text-fg tnum w-28 text-right">{formatRupiah(r.amount)}</span>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => updateRecurring(r.id, { active: !r.active })}
                        title={r.active ? 'Nonaktifkan' : 'Aktifkan'}
                        className={`h-7 w-7 flex items-center justify-center rounded-md hover:bg-surface-2 ${r.active ? 'text-positive' : 'text-muted'}`}
                      >
                        <Power size={13} />
                      </button>
                      <button onClick={() => setForm({ open: true, editing: r })} className="h-7 w-7 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => confirm(`Hapus tagihan "${r.name}"?`) && deleteRecurring(r.id)} className="h-7 w-7 flex items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={13} />
                      </button>
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
          <CardBody className="space-y-4">
            {installments.filter((i) => i.active).map((inst) => {
              const acc = accountMap[inst.accountId]
              const cat = categoryMap[inst.categoryId]
              const pct = (inst.paidCount / inst.tenor) * 100
              const remaining = Math.max(0, inst.tenor - inst.paidCount)
              return (
                <div key={inst.id} className="group">
                  <div className="flex items-center gap-3 mb-2">
                    <CategoryIcon name={cat?.icon || 'Layers'} color={cat?.color || '#6366f1'} size={16} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg truncate">{inst.name}</p>
                      <p className="text-2xs text-muted">{acc?.name} · {formatRupiah(inst.monthlyAmount)}/bln</p>
                    </div>
                    <span className="text-xs tnum text-muted">{inst.paidCount}/{inst.tenor}x</span>
                    <button onClick={() => confirm(`Hapus cicilan "${inst.name}"? Transaksi terkait ikut terhapus.`) && deleteInstallment(inst.id)} className="h-6 w-6 flex items-center justify-center rounded-md text-muted hover:text-negative opacity-0 group-hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <Progress value={inst.paidCount} max={inst.tenor} color="rgb(var(--accent))" />
                  <div className="flex justify-between mt-1.5 text-2xs text-muted">
                    <span className="tnum">Sisa {remaining}x = {formatRupiah(remaining * inst.monthlyAmount)}</span>
                    <span className="tnum">{pct.toFixed(0)}% lunas</span>
                  </div>
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
