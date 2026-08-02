import { useState } from 'react'
import { Plus, Pencil, Trash2, Wallet, ArrowDownLeft, ArrowUpRight, CreditCard } from 'lucide-react'
import { Card, CardBody, Button, Empty, Progress, Badge } from '../components/ui/index.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import AccountForm from '../components/accounts/AccountForm.jsx'
import { useData } from '../context/DataContext.jsx'
import { formatRupiah, formatDate } from '../lib/format.js'
import { computeStatements } from '../lib/paylater.js'

const typeLabels = { bank: 'Bank', ewallet: 'E-Wallet', cash: 'Tunai', paylater: 'Pay Later', other: 'Lainnya' }

export default function Accounts() {
  const { accounts, accountBalances, totalBalance, totalDebt, payLaterInfo, transactions, deleteAccount } = useData()
  const [form, setForm] = useState({ open: false, editing: null })

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
    const hasTx = transactions.some((t) => t.accountId === acc.id)
    const msg = hasTx
      ? `Hapus "${acc.name}"? Transaksi terkait tidak ikut terhapus, tapi saldonya jadi tidak terhitung.`
      : `Hapus rekening "${acc.name}"?`
    if (confirm(msg)) deleteAccount(acc.id)
  }

  return (
    <div className="space-y-6">
      {/* Total */}
      <Card className="bg-gradient-to-br from-accent/[0.07] to-transparent">
        <CardBody className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted">Kekayaan bersih (saldo − utang pay later)</p>
            <p className="text-3xl font-bold text-fg tnum mt-1">{formatRupiah(totalBalance)}</p>
            <p className="text-2xs text-muted mt-1">
              {accounts.length} rekening
              {totalDebt > 0 && <span className="text-negative"> · utang pay later {formatRupiah(totalDebt)}</span>}
            </p>
          </div>
          <Button onClick={() => setForm({ open: true, editing: null })}>
            <Plus size={16} /> Tambah Rekening
          </Button>
        </CardBody>
      </Card>

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
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const editBtns = (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setForm({ open: true, editing: acc })} className="h-7 w-7 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface-2">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(acc)} className="h-7 w-7 flex items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10">
                  <Trash2 size={13} />
                </button>
              </div>
            )
            const header = (
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CategoryIcon name={acc.icon} color={acc.color} size={18} />
                  <div>
                    <p className="text-sm font-semibold text-fg">{acc.name}</p>
                    <p className="text-2xs text-muted">{typeLabels[acc.type] || typeLabels[acc.kind] || 'Lainnya'}</p>
                  </div>
                </div>
                {editBtns}
              </div>
            )

            if (acc.kind === 'paylater') {
              const info = payLaterInfo[acc.id] || { limit: acc.creditLimit || 0, used: 0, available: acc.creditLimit || 0 }
              const pct = info.limit ? (info.used / info.limit) * 100 : 0
              const statements = computeStatements(acc, transactions)
              const currentUnpaid = statements.filter((s) => s.unpaid > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
              return (
                <Card key={acc.id} className="group relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-full w-1" style={{ background: acc.color }} />
                  <CardBody>
                    {header}
                    <div className="mt-4">
                      <p className="text-2xs text-muted">Sisa limit</p>
                      <p className="text-2xl font-bold tnum text-fg">{formatRupiah(info.available)}</p>
                    </div>
                    <div className="mt-3">
                      <Progress value={info.used} max={info.limit || 1} color={pct >= 90 ? 'rgb(var(--negative))' : pct >= 70 ? 'rgb(var(--warning))' : 'rgb(var(--accent))'} />
                      <div className="flex justify-between mt-1.5 text-2xs">
                        <span className="text-muted tnum">Terpakai {formatRupiah(info.used)}</span>
                        <span className="text-muted tnum">Limit {formatRupiah(info.limit)}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border text-xs">
                      {currentUnpaid ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Tagihan belum lunas</span>
                          <span className="tnum font-medium text-fg">{formatRupiah(currentUnpaid.unpaid)}</span>
                        </div>
                      ) : (
                        <span className="text-muted">Tidak ada tagihan tertunda</span>
                      )}
                      <p className="text-2xs text-muted mt-1">
                        {acc.billingModel === 'anniversary'
                          ? 'Cicilan jatuh tempo di tanggal transaksi tiap bulan'
                          : `Closing tgl ${acc.closingDay} · jatuh tempo tgl ${acc.dueDay}`}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              )
            }

            const balance = accountBalances[acc.id] || 0
            const { inc, exp } = flowFor(acc.id)
            return (
              <Card key={acc.id} className="group relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full w-1" style={{ background: acc.color }} />
                <CardBody>
                  {header}
                  <p className={`text-2xl font-bold tnum mt-4 ${balance < 0 ? 'text-negative' : 'text-fg'}`}>
                    {formatRupiah(balance)}
                  </p>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs">
                      <ArrowDownLeft size={14} className="text-positive" />
                      <span className="text-muted">Masuk</span>
                      <span className="font-medium text-fg tnum">{formatRupiah(inc)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <ArrowUpRight size={14} className="text-negative" />
                      <span className="text-muted">Keluar</span>
                      <span className="font-medium text-fg tnum">{formatRupiah(exp)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <AccountForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
    </div>
  )
}
