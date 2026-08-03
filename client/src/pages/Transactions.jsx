import { useMemo, useState } from 'react'
import {
  Search, Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowRight, X, SlidersHorizontal,
} from 'lucide-react'
import { Card, Button, Input, Select, Badge, Empty, Segmented, cx } from '../components/ui/index.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import TransactionForm from '../components/transactions/TransactionForm.jsx'
import { useData } from '../context/DataContext.jsx'
import { formatRupiah, formatDate, dayName } from '../lib/format.js'

export default function Transactions() {
  const { transactions, categories, accounts, categoryMap, accountMap, deleteTransaction } = useData()
  const [form, setForm] = useState({ open: false, editing: null })
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [accFilter, setAccFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (type !== 'all' && t.type !== type) return false
      if (catFilter !== 'all' && t.categoryId !== catFilter && t.feeCategoryId !== catFilter) return false
      if (accFilter !== 'all') {
        const involves = t.type === 'transfer'
          ? (t.fromAccountId === accFilter || t.toAccountId === accFilter)
          : t.accountId === accFilter
        if (!involves) return false
      }
      if (from && t.date < from) return false
      if (to && t.date > to) return false
      if (q) {
        const accStr = t.type === 'transfer'
          ? `${accountMap[t.fromAccountId]?.name || ''} ${accountMap[t.toAccountId]?.name || ''}`
          : accountMap[t.accountId]?.name || ''
        const hay = `${t.note} ${categoryMap[t.categoryId]?.name || ''} ${accStr}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [transactions, type, catFilter, accFilter, from, to, q, categoryMap, accountMap])

  const totals = useMemo(() => {
    let inc = 0, exp = 0
    for (const t of filtered) {
      if (t.type === 'income') inc += t.amount
      else if (t.type === 'expense') exp += t.amount
      else if (t.type === 'transfer') exp += t.fee || 0
    }
    return { inc, exp, net: inc - exp }
  }, [filtered])

  // group by date
  const groups = useMemo(() => {
    const g = {}
    for (const t of filtered) {
      ;(g[t.date] = g[t.date] || []).push(t)
    }
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const hasActiveFilter = q || type !== 'all' || catFilter !== 'all' || accFilter !== 'all' || from || to
  const activeFilterCount = [type !== 'all', catFilter !== 'all', accFilter !== 'all', !!from, !!to].filter(Boolean).length
  const clearFilters = () => { setQ(''); setType('all'); setCatFilter('all'); setAccFilter('all'); setFrom(''); setTo('') }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari catatan, kategori, rekening…"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-2 border border-border text-sm text-fg placeholder:text-muted/70 focus:border-accent outline-none"
            />
          </div>
          <Segmented
            className="hidden lg:inline-flex"
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'income', label: 'Masuk' },
              { value: 'expense', label: 'Keluar' },
              { value: 'transfer', label: 'Transfer' },
            ]}
            value={type}
            onChange={setType}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="lg:hidden flex-1 relative"
              onClick={() => setShowFilters((s) => !s)}
            >
              <SlidersHorizontal size={16} /> Filter
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-fg text-2xs font-bold flex items-center justify-center">{activeFilterCount}</span>
              )}
            </Button>
            <Button className="flex-1 lg:flex-none" onClick={() => setForm({ open: true, editing: null })}>
              <Plus size={16} /> Tambah
            </Button>
          </div>
        </div>

        <div className={cx('mt-3', showFilters ? 'block' : 'hidden lg:block')}>
          <Segmented
            className="lg:hidden w-full mb-2"
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'income', label: 'Masuk' },
              { value: 'expense', label: 'Keluar' },
              { value: 'transfer', label: 'Transfer' },
            ]}
            value={type}
            onChange={setType}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">Semua kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={accFilter} onChange={(e) => setAccFilter(e.target.value)}>
              <option value="all">Semua rekening</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {hasActiveFilter && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
            <span className="text-xs text-muted">{filtered.length} transaksi</span>
            <span className="text-xs text-positive tnum">+{formatRupiah(totals.inc)}</span>
            <span className="text-xs text-negative tnum">−{formatRupiah(totals.exp)}</span>
            <button onClick={clearFilters} className="ml-auto text-xs text-muted hover:text-fg inline-flex items-center gap-1">
              <X size={12} /> Reset filter
            </button>
          </div>
        )}
      </Card>

      {/* List */}
      <Card>
        {groups.length === 0 ? (
          <Empty
            icon={ArrowLeftRight}
            title="Tidak ada transaksi"
            description={hasActiveFilter ? 'Coba ubah atau reset filter.' : 'Mulai catat pemasukan & pengeluaran kamu.'}
            action={!hasActiveFilter && <Button onClick={() => setForm({ open: true, editing: null })}><Plus size={16} /> Tambah Transaksi</Button>}
          />
        ) : (
          <div className="divide-y divide-border">
            {groups.map(([date, items]) => {
              const dayTotal = items.reduce((s, t) => {
                if (t.type === 'income') return s + t.amount
                if (t.type === 'expense') return s - t.amount
                return s - (t.fee || 0) // transfer: hanya biaya admin yg mengurangi net
              }, 0)
              return (
                <div key={date}>
                  <div className="flex items-center justify-between px-4 sm:px-5 py-2 bg-surface-2 sticky top-16 z-10">
                    <span className="text-xs font-medium text-muted">
                      {dayName(date)}, {formatDate(date)}
                    </span>
                    <span className={`text-xs font-medium tnum ${dayTotal >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {dayTotal >= 0 ? '+' : '−'}{formatRupiah(Math.abs(dayTotal))}
                    </span>
                  </div>
                  {items.map((t) => (
                    <TxRow
                      key={t.id}
                      tx={t}
                      cat={categoryMap[t.categoryId]}
                      acc={accountMap[t.accountId]}
                      accountMap={accountMap}
                      onEdit={() => setForm({ open: true, editing: t })}
                      onDelete={() => deleteTransaction(t.id)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <TransactionForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
    </div>
  )
}

function TxRow({ tx, cat, acc, accountMap, onEdit, onDelete }) {
  const isTransfer = tx.type === 'transfer'
  const isIncome = tx.type === 'income'

  if (isTransfer) {
    const fromAcc = accountMap[tx.fromAccountId]
    const toAcc = accountMap[tx.toAccountId]
    return (
      <div className="group flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50 transition-colors">
        <span className="inline-flex items-center justify-center rounded-lg shrink-0 h-9 w-9 bg-accent/10 text-accent">
          <ArrowLeftRight size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg truncate">{tx.note || 'Transfer'}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-2xs text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: fromAcc?.color || '#71717a' }} />
              {fromAcc?.name || '—'}
            </span>
            <ArrowRight size={11} className="text-muted/60" />
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: toAcc?.color || '#71717a' }} />
              {toAcc?.name || '—'}
            </span>
            {tx.fee > 0 && <span className="text-muted/70">· biaya {formatRupiah(tx.fee)}</span>}
          </div>
        </div>
        <div className="text-sm font-semibold tnum shrink-0 text-fg">
          <span className="inline-flex items-center gap-1 text-muted">
            <ArrowLeftRight size={12} />
            {formatRupiah(tx.amount)}
          </span>
        </div>
        <div className="flex gap-1 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="h-9 w-9 lg:h-7 lg:w-7 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-border/50 active:bg-border/50">
            <Pencil size={15} className="lg:hidden" /><Pencil size={13} className="hidden lg:block" />
          </button>
          <button onClick={onDelete} className="h-9 w-9 lg:h-7 lg:w-7 flex items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 active:bg-negative/10">
            <Trash2 size={15} className="lg:hidden" /><Trash2 size={13} className="hidden lg:block" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50 transition-colors">
      <CategoryIcon name={cat?.icon || 'Circle'} color={cat?.color || '#71717a'} size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg truncate">{tx.note || cat?.name || 'Transaksi'}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-2xs text-muted">{cat?.name}</span>
          {acc && (
            <>
              <span className="text-muted/40">·</span>
              <span className="inline-flex items-center gap-1 text-2xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: acc.color }} />
                {acc.name}
              </span>
            </>
          )}
        </div>
      </div>
      <div className={`text-sm font-semibold tnum shrink-0 ${isIncome ? 'text-positive' : 'text-fg'}`}>
        <span className="inline-flex items-center gap-1">
          {isIncome ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} className="text-negative" />}
          {isIncome ? '+' : '−'}{formatRupiah(tx.amount)}
        </span>
      </div>
      <div className="flex gap-1 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="h-9 w-9 lg:h-7 lg:w-7 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-border/50 active:bg-border/50">
          <Pencil size={15} className="lg:hidden" /><Pencil size={13} className="hidden lg:block" />
        </button>
        <button onClick={onDelete} className="h-9 w-9 lg:h-7 lg:w-7 flex items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 active:bg-negative/10">
          <Trash2 size={15} className="lg:hidden" /><Trash2 size={13} className="hidden lg:block" />
        </button>
      </div>
    </div>
  )
}
