import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, Button, Empty, Progress } from '../components/ui/index.jsx'
import Money from '../components/ui/Money.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import AccountForm from '../components/accounts/AccountForm.jsx'
import { useData } from '../context/DataContext.jsx'
import { useBalanceVisibility } from '../context/BalanceVisibilityContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { formatRupiah, maskRupiah } from '../lib/format.js'
import { computeStatements } from '../lib/paylater.js'

const typeLabels = { bank: 'Bank', ewallet: 'E-Wallet', cash: 'Tunai', paylater: 'Pay Later', investment: 'Investasi', other: 'Lainnya' }

export default function Accounts() {
  const { accounts, accountBalances, totalBalance, totalDebt, payLaterInfo, investmentSummary, transactions, deleteAccount } = useData()
  const { hidden } = useBalanceVisibility()
  const navigate = useNavigate()
  const [form, setForm] = useState({ open: false, editing: null })
  const confirm = useConfirm()

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const flowFor = (accId) => {
    let inc = 0, exp = 0
    for (const t of transactions) {
      if (!t.date.startsWith(monthPrefix)) continue
      if (t.type === 'transfer') {
        if (t.fromAccountId === accId) exp += t.amount + (t.fee || 0) // keluar dari rekening ini
        if (t.toAccountId === accId) inc += t.amount                  // masuk ke rekening ini
        continue
      }
      if (t.accountId !== accId) continue
      if (t.type === 'income') inc += t.amount
      else exp += t.amount
    }
    return { inc, exp }
  }

  const handleDelete = (acc) => {
    const hasTx = transactions.some((t) => t.accountId === acc.id || t.fromAccountId === acc.id || t.toAccountId === acc.id)
    confirm({
      title: 'Hapus rekening',
      message: <>Hapus rekening <b>{acc.name}</b>?</>,
      detail: hasTx
        ? 'Transaksi terkait tidak ikut terhapus, tapi saldonya jadi tidak terhitung.'
        : 'Tindakan ini tidak bisa dibatalkan.',
      onConfirm: () => deleteAccount(acc.id),
    })
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted">Kekayaan bersih (saldo + investasi − utang pay later)</p>
          <div className="mt-2">
            <Money size="giant" value={hidden ? 0 : totalBalance} hidden={hidden} className="text-fg" />
          </div>
          <p className="text-[13px] text-muted mt-3">
            {accounts.length} rekening
            {totalDebt > 0 && <span className="text-negative"> · utang pay later <span className="tnum whitespace-nowrap">{maskRupiah(totalDebt, hidden)}</span></span>}
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setForm({ open: true, editing: null })}>
          <Plus size={16} /> Tambah Rekening
        </Button>
      </section>

      {accounts.length === 0 ? (
        <Card>
          <Empty
            icon={Wallet}
            title="Belum ada rekening"
            description="Tambahkan bank, e-wallet, atau dompet tunai untuk mulai melacak saldo."
            action={<Button onClick={() => setForm({ open: true, editing: null })}><Plus size={16} /> Tambah Rekening</Button>}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">
          {accounts.map((acc) => {
            const editBtns = (
              <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 touch:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); setForm({ open: true, editing: acc }) }} className="h-9 w-9 lg:h-7 lg:w-7 touch:h-11 touch:w-11 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface-2 active:bg-surface-2">
                  <Pencil size={15} className="lg:hidden" /><Pencil size={13} className="hidden lg:block" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(acc) }} className="h-9 w-9 lg:h-7 lg:w-7 touch:h-11 touch:w-11 flex items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 active:bg-negative/10">
                  <Trash2 size={15} className="lg:hidden" /><Trash2 size={13} className="hidden lg:block" />
                </button>
              </div>
            )
            const header = (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIcon name={acc.icon} color={acc.color} size={18} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-fg truncate">{acc.name}</p>
                    <p className="text-[13px] text-muted">{typeLabels[acc.type] || typeLabels[acc.kind] || 'Lainnya'}</p>
                  </div>
                </div>
                {editBtns}
              </div>
            )

            if (acc.kind === 'investment') {
              const sum = investmentSummary[acc.id] || { marketValue: 0, netInvested: 0, cumulativeReturn: 0, returnPct: 0 }
              const ret = sum.cumulativeReturn || 0
              const retColor = ret > 0 ? 'text-positive' : ret < 0 ? 'text-negative' : 'text-muted'
              const RetIcon = ret >= 0 ? TrendingUp : TrendingDown
              return (
                <Card
                  key={acc.id}
                  className="group relative pt-4 cursor-pointer"
                  onClick={() => navigate('/investments')}
                >
                  <div>
                    {header}
                    <div className="mt-4">
                      <Money value={hidden ? 0 : sum.marketValue} hidden={hidden} className="text-2xl font-semibold text-fg" />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-border">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                        <RetIcon size={14} className={retColor} />
                        <span className="text-muted">Untung/rugi</span>
                        <span className={`font-medium tnum whitespace-nowrap ${retColor}`}>
                          {(ret >= 0 ? '+' : '−') + formatRupiah(Math.abs(ret)).replace('Rp', 'Rp')}
                          {(sum.netInvested || 0) > 0 && ` (${sum.returnPct >= 0 ? '+' : ''}${(sum.returnPct || 0).toFixed(1)}%)`}
                        </span>
                      </div>
                    </div>
                    <p className="text-[13px] text-muted mt-2">Modal bersih <span className="tnum whitespace-nowrap">{maskRupiah(sum.netInvested || 0, hidden)}</span> · kelola di halaman Investasi</p>
                  </div>
                </Card>
              )
            }

            if (acc.kind === 'paylater') {
              const info = payLaterInfo[acc.id] || { limit: acc.creditLimit || 0, used: 0, available: acc.creditLimit || 0 }
              const pct = info.limit ? (info.used / info.limit) * 100 : 0
              const statements = computeStatements(acc, transactions)
              const currentUnpaid = statements.filter((s) => s.unpaid > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
              return (
                <Card key={acc.id} className="group relative pt-4">
                  <div>
                    {header}
                    <div className="mt-4">
                      <p className="text-[13px] font-medium text-muted">Sisa limit</p>
                      <div className="mt-1">
                        <Money value={hidden ? 0 : info.available} hidden={hidden} className="text-2xl font-semibold text-fg" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Progress value={info.used} max={info.limit || 1} color={pct >= 90 ? 'rgb(var(--negative))' : pct >= 70 ? 'rgb(var(--warning))' : 'rgb(var(--fg))'} />
                      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 mt-1.5 text-[13px]">
                        <span className="text-muted tnum whitespace-nowrap">Terpakai {maskRupiah(info.used, hidden)}</span>
                        <span className="text-muted tnum whitespace-nowrap">Limit {maskRupiah(info.limit, hidden)}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border text-[13px]">
                      {currentUnpaid ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">Tagihan belum lunas</span>
                          <span className="tnum whitespace-nowrap font-semibold text-fg">{maskRupiah(currentUnpaid.unpaid, hidden)}</span>
                        </div>
                      ) : (
                        <span className="text-muted">Tidak ada tagihan tertunda</span>
                      )}
                      <p className="text-xs text-muted mt-1">
                        {acc.billingModel === 'anniversary'
                          ? 'Cicilan jatuh tempo di tanggal transaksi tiap bulan'
                          : `Closing tgl ${acc.closingDay} · jatuh tempo tgl ${acc.dueDay}`}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            }

            const balance = accountBalances[acc.id] || 0
            const { inc, exp } = flowFor(acc.id)
            return (
              <Card key={acc.id} className="group relative pt-4">
                <div>
                  {header}
                  <div className="mt-4">
                    <Money value={hidden ? 0 : balance} hidden={hidden} className={`text-2xl font-semibold ${balance < 0 ? 'text-negative' : 'text-fg'}`} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-[13px]">
                      <ArrowDownLeft size={14} className="text-positive" />
                      <span className="text-muted">Masuk</span>
                      <span className="font-medium text-fg tnum whitespace-nowrap">{formatRupiah(inc)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[13px]">
                      <ArrowUpRight size={14} className="text-negative" />
                      <span className="text-muted">Keluar</span>
                      <span className="font-medium text-fg tnum whitespace-nowrap">{formatRupiah(exp)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <AccountForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
    </div>
  )
}
