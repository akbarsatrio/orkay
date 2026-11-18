import { useMemo, useState } from 'react'
import {
  Search, Plus, Pencil, Trash2, ArrowLeftRight, ArrowRight, X, SlidersHorizontal,
} from 'lucide-react'
import { Button, Input, Select, Empty, Segmented, cx } from '../components/ui/index.jsx'
import Money from '../components/ui/Money.jsx'
import RowMenu from '../components/ui/RowMenu.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import { BillIcon } from '../components/bills/BillRow.jsx'
import TransactionForm from '../components/transactions/TransactionForm.jsx'
import { useData } from '../context/DataContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { formatRupiah, formatDate, dayName } from '../lib/format.js'

const TYPE_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'income', label: 'Masuk' },
  { value: 'expense', label: 'Keluar' },
  { value: 'transfer', label: 'Transfer' },
]

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
  const confirm = useConfirm()

  const askDelete = (t) => {
    const label = t.note || (t.type === 'transfer' ? 'Transfer' : categoryMap[t.categoryId]?.name || 'Transaksi')
    confirm({
      title: 'Hapus transaksi',
      message: <>Hapus <b>{label}</b> sebesar {formatRupiah(t.amount)} ({formatDate(t.date)})?</>,
      detail: 'Saldo rekening dihitung ulang tanpa transaksi ini. Tindakan ini tidak bisa dibatalkan.',
      onConfirm: () => deleteTransaction(t.id),
    })
  }

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
    <div className="space-y-6">
      {/* Toolbar: cari + jenis selalu terlihat di desktop; filter lain di panel (HP: dibuka lewat tombol Filter) */}
      <div>
        <div className="flex gap-3">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari catatan, kategori, rekening…"
              aria-label="Cari transaksi"
              className="w-full h-9 touch:h-11 pl-9 pr-3 rounded-md bg-surface-2 border border-border hover:border-muted/50 focus:bg-bg text-base sm:text-sm text-fg placeholder:text-muted focus:border-fg outline-none transition-colors"
            />
          </div>
          <Segmented className="hidden lg:inline-flex" options={TYPE_OPTIONS} value={type} onChange={setType} />
          <Button
            variant="secondary"
            className="lg:hidden shrink-0 relative"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={16} aria-hidden="true" /> Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </Button>
        </div>

        <div className={cx('mt-4', showFilters ? 'block' : 'hidden lg:block')}>
          <Segmented className="lg:hidden w-full mb-3" fill options={TYPE_OPTIONS} value={type} onChange={setType} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3">
            <Select label="Kategori" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">Semua kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Rekening" value={accFilter} onChange={(e) => setAccFilter(e.target.value)}>
              <option value="all">Semua rekening</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Input type="date" label="Dari tanggal" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Sampai tanggal" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {hasActiveFilter && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[13px]">
            <span className="text-fg font-medium">{filtered.length} transaksi</span>
            <span className="text-positive tnum whitespace-nowrap">+{formatRupiah(totals.inc)}</span>
            <span className="text-negative tnum whitespace-nowrap">−{formatRupiah(totals.exp)}</span>
            <button onClick={clearFilters} className="ml-auto touch:min-h-11 text-muted hover:text-fg inline-flex items-center gap-1">
              <X size={13} aria-hidden="true" /> Reset filter
            </button>
          </div>
        )}
      </div>

      {/* Daftar per hari */}
      <section className="border-t border-rule min-w-0">
        {groups.length === 0 ? (
          <div className="pt-5">
            <Empty
              icon={ArrowLeftRight}
              title="Tidak ada transaksi"
              description={hasActiveFilter ? 'Coba ubah atau reset filter.' : 'Mulai catat pemasukan & pengeluaran kamu.'}
              action={!hasActiveFilter && <Button variant="accent" onClick={() => setForm({ open: true, editing: null })}><Plus size={16} /> Tambah Transaksi</Button>}
            />
          </div>
        ) : (
          groups.map(([date, items]) => {
            const dayTotal = items.reduce((s, t) => {
              if (t.type === 'income') return s + t.amount
              if (t.type === 'expense') return s - t.amount
              return s - (t.fee || 0) // transfer: hanya biaya admin yg mengurangi net
            }, 0)
            return (
              <section key={date} aria-label={`${dayName(date)}, ${formatDate(date)}`}>
                {/* Kepala hari menempel di atas saat di-scroll; isinya tanggal + total bersih hari itu */}
                <div className="sticky top-0 z-10 bg-bg flex items-baseline justify-between gap-3 pt-5 pb-2 border-b border-border">
                  <h2 className="text-[13px] font-semibold text-fg">
                    {dayName(date)}, <span className="font-normal text-muted">{formatDate(date)}</span>
                  </h2>
                  <span className={`text-[13px] font-medium tnum whitespace-nowrap ${dayTotal >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {dayTotal >= 0 ? '+' : '−'}{formatRupiah(Math.abs(dayTotal))}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {items.map((t) => (
                    <TxRow
                      key={t.id}
                      tx={t}
                      cat={categoryMap[t.categoryId]}
                      acc={accountMap[t.accountId]}
                      accountMap={accountMap}
                      onEdit={() => setForm({ open: true, editing: t })}
                      onDelete={() => askDelete(t)}
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </section>

      <TransactionForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
    </div>
  )
}

function AccountDot({ acc }) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: acc?.color || '#71717a' }} aria-hidden="true" />
      <span className="truncate">{acc?.name || '-'}</span>
    </span>
  )
}

const actionBtn =
  'h-9 w-9 touch:h-11 touch:w-11 flex items-center justify-center rounded-md text-muted transition-colors'

// Kolom: ikon 34px | judul + keterangan (satu baris, terpotong rapi) | nominal rata kanan | aksi.
// Desktop: ubah/hapus muncul saat kursor di atas baris, ruangnya tetap dipesan supaya nominal selalu lurus.
// HP: ubah/hapus digabung di menu "⋯" supaya judul & keterangan tidak terpotong terlalu pendek.
function TxRow({ tx, cat, acc, accountMap, onEdit, onDelete }) {
  const isTransfer = tx.type === 'transfer'
  const isIncome = tx.type === 'income'
  const fromAcc = isTransfer ? accountMap[tx.fromAccountId] : null
  const toAcc = isTransfer ? accountMap[tx.toAccountId] : null

  return (
    <div className="group grid grid-cols-[34px_minmax(0,1fr)_auto_auto] items-center gap-x-3 sm:gap-x-4 py-3">
      {isTransfer
        ? <BillIcon icon={ArrowLeftRight} />
        : <CategoryIcon name={cat?.icon || 'Circle'} color={cat?.color || '#71717a'} size={16} />}

      <div className="min-w-0">
        <p className="text-[15px] font-medium text-fg truncate">
          {isTransfer ? tx.note || 'Transfer' : tx.note || cat?.name || 'Transaksi'}
        </p>
        <div className="flex items-center gap-x-1.5 mt-0.5 text-[13px] text-muted min-w-0 overflow-hidden whitespace-nowrap">
          {isTransfer ? (
            <>
              <AccountDot acc={fromAcc} />
              <ArrowRight size={12} className="shrink-0" aria-label="ke" />
              <AccountDot acc={toAcc} />
              {tx.fee > 0 && <span className="tnum shrink-0">· biaya {formatRupiah(tx.fee)}</span>}
            </>
          ) : (
            <>
              <span className="truncate">{cat?.name}</span>
              {acc && (
                <>
                  <span aria-hidden="true">·</span>
                  <AccountDot acc={acc} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {isTransfer ? (
        <span className="inline-flex items-center gap-1 text-[15px] font-semibold text-muted">
          <ArrowLeftRight size={13} aria-label="Transfer" />
          <Money value={tx.amount} />
        </span>
      ) : (
        <Money
          value={tx.amount}
          sign={isIncome ? '+' : '-'}
          className={`text-[15px] font-semibold ${isIncome ? 'text-positive' : 'text-fg'}`}
        />
      )}

      <div className="hidden sm:flex gap-1 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 touch:opacity-100 transition-opacity">
        <button onClick={onEdit} aria-label="Ubah transaksi" title="Ubah" className={`${actionBtn} hover:text-fg hover:bg-surface-2`}>
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button onClick={onDelete} aria-label="Hapus transaksi" title="Hapus" className={`${actionBtn} hover:text-negative hover:bg-negative/10`}>
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
      <RowMenu
        className="sm:hidden -mr-2"
        label="Aksi transaksi"
        items={[
          { label: 'Ubah', icon: Pencil, onSelect: onEdit },
          { label: 'Hapus', icon: Trash2, onSelect: onDelete, danger: true },
        ]}
      />
    </div>
  )
}
