import { useMemo, useState } from 'react'
import { Plus, Target, Trash2, AlertTriangle, Pencil } from 'lucide-react'
import { Card, CardBody, CardHeader, Button, Progress, Empty, Modal, Select, Badge, FormDeleteButton } from '../components/ui/index.jsx'
import Money from '../components/ui/Money.jsx'
import SwipeRow, { editDeleteActions } from '../components/ui/SwipeRow.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import { useData } from '../context/DataContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { formatRupiah, formatNumber, parseNumber, monthNamesID } from '../lib/format.js'
import { spendingPerCategory } from '../lib/selectors.js'

export default function Budgets() {
  const { budgets, categories, categoryMap, transactions, upsertBudget, deleteBudget } = useData()
  const [modal, setModal] = useState({ open: false, editing: null })
  const confirm = useConfirm()
  const askDelete = (r) => confirm({
    title: 'Hapus anggaran',
    message: <>Hapus anggaran kategori <b>{r.cat.name}</b>?</>,
    detail: 'Transaksi di kategori ini tidak terpengaruh.',
    onConfirm: () => deleteBudget(r.id),
  })

  const now = new Date()
  const spending = useMemo(
    () => spendingPerCategory(transactions, now.getFullYear(), now.getMonth()),
    [transactions]
  )

  const rows = useMemo(() => {
    return budgets
      .map((b) => {
        const cat = categoryMap[b.categoryId]
        const spent = spending[b.categoryId] || 0
        const pct = b.limit ? (spent / b.limit) * 100 : 0
        return { ...b, cat, spent, pct, remaining: b.limit - spent }
      })
      .filter((r) => r.cat)
      .sort((a, b) => b.pct - a.pct)
  }, [budgets, categoryMap, spending])

  const totalLimit = rows.reduce((s, r) => s + r.limit, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const overCount = rows.filter((r) => r.pct >= 100).length

  const openNew = () => setModal({ open: true, editing: null })

  return (
    <div className="space-y-6">
      {/* Ringkasan: "Terpakai" jadi angka raksasa (fokus layar), bar total di bawahnya,
          total anggaran & jumlah yang lewat batas jadi satu baris keterangan. */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted">Terpakai</p>
          <div className="mt-2">
            <Money size="giant" value={totalSpent} className="text-fg" />
          </div>
          <div className="mt-3 max-w-xl">
            <Progress value={totalSpent} max={totalLimit || 1} />
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted mt-3">
            <span>
              Total anggaran ({monthNamesID[now.getMonth()]}){' '}
              <b className="font-semibold text-fg tnum whitespace-nowrap">{formatRupiah(totalLimit)}</b>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Lewat batas{' '}
              <b className={`font-semibold tnum ${overCount ? 'text-negative' : 'text-positive'}`}>{overCount}</b>
            </span>
          </p>
        </div>
        <Button className="shrink-0" onClick={openNew}><Plus size={16} /> Atur</Button>
      </section>

      <Card>
        <CardHeader title="Anggaran per Kategori" subtitle="Batas pengeluaran bulan ini. Bar berubah warna saat mendekati / melewati limit." />
        <CardBody className="divide-y divide-border pt-1">
          {rows.length === 0 ? (
            <Empty
              icon={Target}
              title="Belum ada anggaran"
              description="Tetapkan batas pengeluaran untuk kategori tertentu agar lebih terkontrol."
              action={<Button onClick={openNew}><Plus size={16} /> Atur Anggaran</Button>}
            />
          ) : (
            rows.map((r) => (
              <SwipeRow
                key={r.id}
                onTap={() => setModal({ open: true, editing: r })}
                actions={editDeleteActions(`anggaran ${r.cat.name}`, () => setModal({ open: true, editing: r }), () => askDelete(r))}
              >
                {/* Baris 1: ikon 34px | nama + badge | sisa (penentu keputusan: masih bisa belanja berapa) | aksi desktop.
                    Baris 2 (mulai sejajar nama, selebar sisa baris): bar + terpakai / limit. */}
                <div className="group grid grid-cols-[34px_minmax(0,1fr)_auto] lg:grid-cols-[34px_minmax(0,1fr)_auto_4.5rem] items-center gap-x-3 sm:gap-x-4 py-3.5">
                  <CategoryIcon name={r.cat.icon} color={r.cat.color} size={16} />
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span className="text-[15px] font-medium text-fg truncate max-w-full">{r.cat.name}</span>
                    {r.pct >= 100 ? (
                      <Badge className="text-negative border-negative/30 bg-negative/10"><AlertTriangle size={11} aria-hidden="true" /> Lewat</Badge>
                    ) : r.pct >= 85 ? (
                      <Badge className="text-warning border-warning/30 bg-warning/10">Hampir habis</Badge>
                    ) : null}
                  </p>
                  <p className={`text-right text-base font-semibold tnum whitespace-nowrap ${r.remaining < 0 ? 'text-negative' : 'text-fg'}`}>
                    {r.remaining < 0 ? `Lewat ${formatRupiah(-r.remaining)}` : `Sisa ${formatRupiah(r.remaining)}`}
                  </p>
                  <div className="hidden lg:flex justify-end gap-1 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
                    <button onClick={() => setModal({ open: true, editing: r })} aria-label={`Ubah anggaran ${r.cat.name}`} title="Ubah" className="h-8 w-8 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface-2">
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button onClick={() => askDelete(r)} aria-label={`Hapus anggaran ${r.cat.name}`} title="Hapus" className="h-8 w-8 flex items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10">
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="col-start-2 col-span-2 mt-2">
                    <Progress value={r.spent} max={r.limit} />
                    <p className="flex flex-wrap justify-between gap-x-3 text-[13px] text-muted tnum mt-1.5">
                      <span className="whitespace-nowrap">Terpakai {formatRupiah(r.spent)}</span>
                      <span className="whitespace-nowrap">Limit {formatRupiah(r.limit)}</span>
                    </p>
                  </div>
                </div>
              </SwipeRow>
            ))
          )}
        </CardBody>
      </Card>

      <BudgetModal
        open={modal.open}
        editing={modal.editing}
        onClose={() => setModal({ open: false, editing: null })}
        onDelete={() => { const r = modal.editing; setModal({ open: false, editing: null }); askDelete(r) }}
        categories={categories.filter((c) => c.type === 'expense')}
        existing={budgets}
        onSave={upsertBudget}
      />
    </div>
  )
}

function BudgetModal({ open, onClose, onDelete, editing, categories, existing, onSave }) {
  const [catId, setCatId] = useState('')
  const [limitStr, setLimitStr] = useState('')

  useMemo(() => {
    if (open) {
      setCatId(editing?.categoryId || '')
      setLimitStr(editing ? formatNumber(editing.limit) : '')
    }
  }, [open, editing])

  const usedCatIds = existing.map((b) => b.categoryId)
  const available = categories.filter((c) => editing?.categoryId === c.id || !usedCatIds.includes(c.id))
  const limit = parseNumber(limitStr)
  const canSave = catId && limit > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Anggaran' : 'Atur Anggaran'}
      footer={
        <>
          {editing && onDelete && <FormDeleteButton onClick={onDelete} />}
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button disabled={!canSave} onClick={() => { onSave(catId, limit); onClose() }}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Kategori" value={catId} onChange={(e) => setCatId(e.target.value)} disabled={!!editing}>
          <option value="">Pilih kategori</option>
          {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div>
          <span className="block text-[13px] font-medium text-muted mb-1.5">Batas per bulan</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
            <input
              inputMode="numeric"
              value={limitStr}
              onChange={(e) => { const v = parseNumber(e.target.value); setLimitStr(v ? formatNumber(v) : '') }}
              placeholder="0"
              className="w-full h-9 touch:h-11 pl-9 pr-3 rounded-md bg-surface-2 border border-border hover:border-muted/50 focus:bg-bg text-base sm:text-sm font-medium text-fg tnum focus:border-fg outline-none transition-colors"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
