import { useMemo, useState } from 'react'
import { Plus, Target, Trash2, AlertTriangle, Pencil } from 'lucide-react'
import { Card, CardBody, CardHeader, Button, Progress, Empty, Modal, Select, Badge, FormDeleteButton } from '../components/ui/index.jsx'
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

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-x-8 gap-y-6">
        <Card><CardBody>
          <p className="text-[13px] font-medium text-muted">Total anggaran ({monthNamesID[now.getMonth()]})</p>
          <p className="text-2xl font-bold text-fg tnum whitespace-nowrap mt-1">{formatRupiah(totalLimit)}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-[13px] font-medium text-muted">Terpakai</p>
          <p className="text-2xl font-bold tnum whitespace-nowrap mt-1 text-fg">{formatRupiah(totalSpent)}</p>
          <div className="mt-2"><Progress value={totalSpent} max={totalLimit || 1} /></div>
        </CardBody></Card>
        <Card><CardBody className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-muted">Lewat batas</p>
            <p className={`text-2xl font-bold tnum mt-1 ${overCount ? 'text-negative' : 'text-positive'}`}>{overCount}</p>
          </div>
          <Button onClick={() => setModal({ open: true, editing: null })}><Plus size={16} /> Atur</Button>
        </CardBody></Card>
      </div>

      <Card>
        <CardHeader title="Anggaran per Kategori" subtitle="Batas pengeluaran bulan ini. Bar berubah warna saat mendekati / melewati limit." />
        <CardBody className="divide-y divide-border pt-0">
          {rows.length === 0 ? (
            <Empty
              icon={Target}
              title="Belum ada anggaran"
              description="Tetapkan batas pengeluaran untuk kategori tertentu agar lebih terkontrol."
              action={<Button onClick={() => setModal({ open: true, editing: null })}><Plus size={16} /> Atur Anggaran</Button>}
            />
          ) : (
            rows.map((r) => (
              <SwipeRow
                key={r.id}
                onTap={() => setModal({ open: true, editing: r })}
                actions={editDeleteActions(`anggaran ${r.cat.name}`, () => setModal({ open: true, editing: r }), () => askDelete(r))}
              >
              <div className="group py-4">
                <div className="flex items-center gap-3 mb-2">
                  <CategoryIcon name={r.cat.icon} color={r.cat.color} size={16} />
                  <span className="text-sm font-medium text-fg flex-1 min-w-0 truncate">{r.cat.name}</span>
                  {r.pct >= 100 ? (
                    <Badge className="text-negative border-negative/30 bg-negative/10"><AlertTriangle size={11} /> Lewat</Badge>
                  ) : r.pct >= 85 ? (
                    <Badge className="text-warning border-warning/30 bg-warning/10">Hampir habis</Badge>
                  ) : null}
                  <button onClick={() => setModal({ open: true, editing: r })} aria-label={`Ubah anggaran ${r.cat.name}`} className="hidden lg:flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface-2 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 touch:opacity-100 touch:h-11 touch:w-11">
                    <Pencil size={12} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => askDelete(r)}
                    aria-label={`Hapus anggaran ${r.cat.name}`}
                    className="hidden lg:flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 touch:opacity-100 touch:h-11 touch:w-11"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
                <Progress value={r.spent} max={r.limit} />
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 mt-1.5 text-xs">
                  <span className="text-muted tnum whitespace-nowrap">{formatRupiah(r.spent)} <span className="text-muted/60">/ {formatRupiah(r.limit)}</span></span>
                  <span className={`tnum whitespace-nowrap font-medium ${r.remaining < 0 ? 'text-negative' : 'text-muted'}`}>
                    {r.remaining < 0 ? `Lewat ${formatRupiah(-r.remaining)}` : `Sisa ${formatRupiah(r.remaining)}`}
                  </span>
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
