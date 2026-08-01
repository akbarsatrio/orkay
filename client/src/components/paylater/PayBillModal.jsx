import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Modal, Button, Input, Select } from '../ui/index.jsx'
import { useData } from '../../context/DataContext.jsx'
import { formatRupiah, formatDate, toISODate } from '../../lib/format.js'

/**
 * Modal bayar tagihan pay later.
 * item bisa berupa:
 *  - { kind:'statement', account, period, dueDate, unpaid }
 *  - { kind:'installment', installment, account, termin, dueDate, amount }
 * User pilih rekening cash sumber + tanggal bayar.
 */
export default function PayBillModal({ open, item, onClose }) {
  const { accounts, payStatement, payInstallment } = useData()
  const cashAccounts = accounts.filter((a) => a.kind !== 'paylater')
  const [fromAccountId, setFromAccountId] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (open) {
      setDate(toISODate(new Date()))
      setFromAccountId(cashAccounts[0]?.id || '')
      setErr(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  if (!item) return null
  const isInstallment = item.kind === 'installment'
  const amount = isInstallment ? item.amount : item.unpaid
  const acc = item.account

  const canSave = fromAccountId && date && amount > 0

  const handlePay = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setErr(null)
    try {
      if (isInstallment) {
        await payInstallment(item.installment, date, fromAccountId)
      } else {
        await payStatement(acc.id, fromAccountId, amount, date, item.period)
      }
      onClose()
    } catch (e) {
      setErr(e.message || 'Gagal membayar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isInstallment ? 'Bayar Cicilan' : 'Bayar Tagihan Pay Later'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handlePay} disabled={!canSave || saving}>
            <Check size={15} /> {saving ? 'Memproses…' : 'Bayar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-2 border border-border p-3">
          <p className="text-sm font-medium text-fg">
            {isInstallment ? `${item.installment.name} — cicilan ${item.termin}/${item.installment.tenor}` : `Tagihan ${acc.name}`}
          </p>
          <p className="text-2xs text-muted mt-0.5">
            {acc.name} · jatuh tempo {formatDate(item.dueDate, { short: true })}
          </p>
          <p className="text-xl font-bold text-fg tnum mt-2">{formatRupiah(amount)}</p>
        </div>

        <Select label="Bayar dari rekening" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
          <option value="">Pilih rekening</option>
          {cashAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        {cashAccounts.length === 0 && (
          <p className="text-2xs text-warning">Belum ada rekening cash untuk membayar. Tambahkan rekening dulu.</p>
        )}

        <Input type="date" label="Tanggal bayar" value={date} onChange={(e) => setDate(e.target.value)} />

        {err && <p className="text-xs text-negative">{err}</p>}
      </div>
    </Modal>
  )
}
