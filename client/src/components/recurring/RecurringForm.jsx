import { useEffect, useState } from 'react'
import { Modal, Button, Input, Select } from '../ui/index.jsx'
import { useData } from '../../context/DataContext.jsx'
import { formatNumber, parseNumber } from '../../lib/format.js'

export default function RecurringForm({ open, onClose, editing }) {
  const { categories, accounts, addRecurring, updateRecurring } = useData()
  const expenseCats = categories.filter((c) => c.type === 'expense')
  const [form, setForm] = useState({ name: '', categoryId: '', accountId: '', amount: 0, dueDay: 1, active: true })
  const [amtStr, setAmtStr] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({ ...editing })
      setAmtStr(formatNumber(editing.amount))
    } else {
      setForm({ name: '', categoryId: '', accountId: '', amount: 0, dueDay: 1, active: true })
      setAmtStr('')
    }
  }, [open, editing])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const canSave = form.name.trim() && form.amount > 0 && form.categoryId && form.accountId

  const handleAmt = (e) => {
    const v = parseNumber(e.target.value)
    setAmtStr(v ? formatNumber(v) : '')
    set({ amount: v })
  }

  const handleSave = () => {
    if (!canSave) return
    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      accountId: form.accountId,
      amount: Number(form.amount),
      dueDay: Math.min(31, Math.max(1, Number(form.dueDay) || 1)),
      active: form.active,
    }
    if (editing) updateRecurring(editing.id, payload)
    else addRecurring(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Tagihan Rutin' : 'Tagihan Rutin Baru'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={!canSave}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Nama tagihan" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="mis. Kos, Internet, Netflix" autoFocus />
        <div>
          <span className="block text-xs font-medium text-muted mb-1.5">Nominal per bulan</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
            <input
              inputMode="numeric"
              value={amtStr}
              onChange={handleAmt}
              placeholder="0"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-base sm:text-sm font-medium text-fg tnum placeholder:text-muted/50 focus:border-accent outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Kategori" value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">Pilih kategori</option>
            {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Bayar dari" value={form.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            <option value="">Pilih rekening</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <Input
          type="number"
          min={1}
          max={31}
          label="Jatuh tempo tiap tanggal"
          value={form.dueDay}
          onChange={(e) => set({ dueDay: e.target.value })}
          hint="Kalau tanggalnya melebihi hari di bulan itu, otomatis dipakai tanggal terakhir bulan tsb."
        />
      </div>
    </Modal>
  )
}
