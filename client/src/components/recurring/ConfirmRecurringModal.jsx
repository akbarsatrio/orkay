import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Modal, Button, Input } from '../ui/index.jsx'
import CategoryIcon from '../CategoryIcon.jsx'
import { useData } from '../../context/DataContext.jsx'
import { formatRupiah, formatDate, toISODate } from '../../lib/format.js'

/**
 * Modal konfirmasi pembayaran tagihan rutin.
 * `item` = { recurring, dueDate, period, isDue } dari getPendingRecurring/upcoming.
 * User memilih TANGGAL TRANSAKSI aktual (default hari ini). Nominal & lainnya ikut template.
 * `period` tetap periode tagihan, jadi walau bayar di bulan lain, penandaan tetap akurat.
 */
export default function ConfirmRecurringModal({ open, item, onClose }) {
  const { categoryMap, accountMap, confirmRecurring } = useData()
  const [date, setDate] = useState(toISODate(new Date()))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (open) {
      setDate(toISODate(new Date())) // default: hari ini (kapan kamu benar-benar bayar)
      setErr(null)
    }
  }, [open, item])

  if (!item) return null
  const rec = item.recurring
  const cat = categoryMap[rec.categoryId]
  const acc = accountMap[rec.accountId]

  const handleConfirm = async () => {
    if (!date || saving) return
    setSaving(true)
    setErr(null)
    try {
      await confirmRecurring(rec, date, item.period)
      onClose()
    } catch (e) {
      setErr(e.message || 'Gagal mengonfirmasi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Konfirmasi Pembayaran"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handleConfirm} disabled={!date || saving}>
            <Check size={15} /> {saving ? 'Menyimpan…' : 'Konfirmasi & Catat'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-border">
          <CategoryIcon name={cat?.icon || 'ReceiptText'} color={cat?.color || '#71717a'} size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg truncate">{rec.name}</p>
            <p className="text-2xs text-muted">
              {acc?.name} · {cat?.name} · jatuh tempo {formatDate(item.dueDate, { short: true })}
            </p>
          </div>
          <span className="text-sm font-semibold text-fg tnum">{formatRupiah(rec.amount)}</span>
        </div>

        <Input
          type="date"
          label="Tanggal transaksi (kapan kamu benar-benar bayar)"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          autoFocus
        />
        <p className="text-2xs text-muted -mt-2">
          Boleh sebelum atau sesudah tanggal jatuh tempo. Tagihan tetap ditandai lunas untuk periode ini.
        </p>

        {err && <p className="text-xs text-negative">{err}</p>}
      </div>
    </Modal>
  )
}
