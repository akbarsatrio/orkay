import { useEffect, useState } from 'react'
import { Modal, Button, Input, Select } from '../ui/index.jsx'
import { useData } from '../../context/DataContext.jsx'
import { formatNumber, parseNumber } from '../../lib/format.js'

const TYPES = [
  { value: 'bank', label: 'Bank', icon: 'Landmark', kind: 'cash' },
  { value: 'ewallet', label: 'E-Wallet', icon: 'Smartphone', kind: 'cash' },
  { value: 'cash', label: 'Tunai / Cash', icon: 'Banknote', kind: 'cash' },
  { value: 'paylater', label: 'Pay Later / Kartu Kredit', icon: 'CreditCard', kind: 'paylater' },
  { value: 'other', label: 'Lainnya', icon: 'Wallet', kind: 'cash' },
]
const COLORS = ['#1d4ed8', '#0ea5e9', '#16a34a', '#f97316', '#8b5cf6', '#ec4899', '#71717a', '#0f766e']

const emptyForm = () => ({
  name: '', type: 'bank', kind: 'cash', openingBalance: 0, color: '#1d4ed8', icon: 'Landmark',
  creditLimit: 0, closingDay: 15, dueDay: 1, dueMonthOffset: 1,
})

export default function AccountForm({ open, onClose, editing }) {
  const { addAccount, updateAccount } = useData()
  const [form, setForm] = useState(emptyForm())
  const [balStr, setBalStr] = useState('')
  const [limitStr, setLimitStr] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({ ...emptyForm(), ...editing })
      setBalStr(formatNumber(editing.openingBalance))
      setLimitStr(editing.creditLimit ? formatNumber(editing.creditLimit) : '')
    } else {
      setForm(emptyForm())
      setBalStr('')
      setLimitStr('')
    }
  }, [open, editing])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const isPaylater = form.kind === 'paylater'
  const canSave = form.name.trim().length > 0 && (!isPaylater || parseNumber(limitStr) > 0)

  const handleType = (val) => {
    const t = TYPES.find((x) => x.value === val)
    set({ type: val, kind: t?.kind || 'cash', icon: t?.icon || 'Wallet' })
  }
  const handleBal = (e) => {
    const v = parseNumber(e.target.value)
    setBalStr(v ? formatNumber(v) : '')
    set({ openingBalance: v })
  }
  const handleLimit = (e) => {
    const v = parseNumber(e.target.value)
    setLimitStr(v ? formatNumber(v) : '')
    set({ creditLimit: v })
  }

  const handleSave = () => {
    if (!canSave) return
    const payload = {
      name: form.name.trim(),
      type: form.type,
      kind: form.kind,
      color: form.color,
      icon: form.icon,
      openingBalance: isPaylater ? 0 : Number(form.openingBalance),
      creditLimit: isPaylater ? Number(form.creditLimit) : 0,
      closingDay: Number(form.closingDay) || 1,
      dueDay: Number(form.dueDay) || 1,
      dueMonthOffset: Number(form.dueMonthOffset) || 1,
    }
    if (editing) updateAccount(editing.id, payload)
    else addAccount(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Rekening' : 'Rekening Baru'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={!canSave}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={isPaylater ? 'Nama kartu / pay later' : 'Nama rekening / dompet'} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={isPaylater ? 'mis. GoPay Later, CC BCA' : 'mis. BCA, GoPay, Dompet'} autoFocus />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipe" value={form.type} onChange={(e) => handleType(e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>

          {isPaylater ? (
            <div>
              <span className="block text-xs font-medium text-muted mb-1.5">Limit</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
                <input
                  inputMode="numeric"
                  value={limitStr}
                  onChange={handleLimit}
                  placeholder="0"
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-sm text-fg tnum placeholder:text-muted/50 focus:border-accent outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <span className="block text-xs font-medium text-muted mb-1.5">Saldo awal</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
                <input
                  inputMode="numeric"
                  value={balStr}
                  onChange={handleBal}
                  placeholder="0"
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-sm text-fg tnum placeholder:text-muted/50 focus:border-accent outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {isPaylater && (
          <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Siklus Tagihan (Billing Cycle)</p>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" min={1} max={31} label="Closing tgl" value={form.closingDay} onChange={(e) => set({ closingDay: e.target.value })} />
              <Input type="number" min={1} max={31} label="Jatuh tempo tgl" value={form.dueDay} onChange={(e) => set({ dueDay: e.target.value })} />
              <Input type="number" min={0} max={3} label="Due +bulan" value={form.dueMonthOffset} onChange={(e) => set({ dueMonthOffset: e.target.value })} />
            </div>
            <p className="text-2xs text-muted leading-relaxed">
              Transaksi setelah tanggal closing masuk tagihan bulan berikutnya. Jatuh tempo = tanggal jatuh tempo pada {form.dueMonthOffset} bulan setelah closing.
            </p>
          </div>
        )}

        <div>
          <span className="block text-xs font-medium text-muted mb-2">Warna</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => set({ color: c })}
                className={`h-7 w-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-surface scale-110' : ''}`}
                style={{ background: c, '--tw-ring-color': c }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
