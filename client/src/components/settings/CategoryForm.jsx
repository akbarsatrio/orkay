import { useEffect, useState } from 'react'
import { Modal, Button, Input, Segmented } from '../ui/index.jsx'
import CategoryIcon from '../CategoryIcon.jsx'
import { useData } from '../../context/DataContext.jsx'

const ICONS = [
  'UtensilsCrossed', 'Car', 'ShoppingBag', 'ReceiptText', 'Clapperboard', 'HeartPulse',
  'Home', 'PiggyBank', 'Wallet', 'Laptop', 'Gift', 'Plane', 'Coffee', 'Fuel',
  'Dumbbell', 'GraduationCap', 'Baby', 'PawPrint', 'Smartphone', 'Shirt',
  'Wrench', 'Gamepad2', 'MoreHorizontal', 'Briefcase', 'TrendingUp', 'CreditCard',
]
const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#16a34a', '#14b8a6',
  '#0ea5e9', '#4f46e5', '#8b5cf6', '#ec4899', '#71717a', '#0f766e',
]

export default function CategoryForm({ open, onClose, editing }) {
  const { addCategory, updateCategory } = useData()
  const [form, setForm] = useState({ name: '', type: 'expense', icon: 'ShoppingBag', color: '#4f46e5' })

  useEffect(() => {
    if (!open) return
    if (editing) setForm({ ...editing })
    else setForm({ name: '', type: 'expense', icon: 'ShoppingBag', color: '#4f46e5' })
  }, [open, editing])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const canSave = form.name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    const payload = { name: form.name.trim(), type: form.type, icon: form.icon, color: form.color }
    if (editing) updateCategory(editing.id, payload)
    else addCategory(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Kategori' : 'Kategori Baru'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={!canSave}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CategoryIcon name={form.icon} color={form.color} size={22} />
          <div className="flex-1">
            <Input
              label="Nama kategori"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="mis. Kopi & Cafe"
              autoFocus
            />
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-muted mb-1.5">Tipe</span>
          <Segmented
            className="flex w-full [&>button]:flex-1"
            options={[
              { value: 'expense', label: 'Pengeluaran' },
              { value: 'income', label: 'Pemasukan' },
            ]}
            value={form.type}
            onChange={(v) => set({ type: v })}
          />
        </div>

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

        <div>
          <span className="block text-xs font-medium text-muted mb-2">Ikon</span>
          <div className="grid grid-cols-8 gap-2">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => set({ icon: ic })}
                className={`h-9 flex items-center justify-center rounded-lg border transition-colors ${
                  form.icon === ic ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:text-fg hover:bg-surface-2'
                }`}
              >
                <CategoryIcon name={ic} color="currentColor" size={16} boxed={false} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
