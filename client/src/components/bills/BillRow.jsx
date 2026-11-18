import { Button } from '../ui/index.jsx'
import Money from '../ui/Money.jsx'

export function BillIcon({ icon: Icon }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg shrink-0 h-[34px] w-[34px] bg-surface-2 text-muted">
      <Icon size={16} aria-hidden="true" />
    </span>
  )
}

/**
 * Baris tagihan yang bisa dibayar/dikonfirmasi (Dashboard, Tagihan Rutin).
 * Kolom: ikon (34px) | nama + badge + keterangan | nominal | tombol aksi.
 * Desktop: nominal & tombol sebaris, nominal rata kanan membentuk satu kolom.
 * HP: nominal di atas tombol karena lebar tidak cukup.
 * `due` ditampilkan lebih terang dari `meta`; `urgent` mewarnainya kuning (jatuh tempo hari ini).
 * `actionWidth`: lebar minimum tombol supaya kolom nominal tetap lurus antar-bagian di satu halaman.
 */
export default function BillRow({
  icon, title, badges, due, urgent, meta, amount, actionLabel, onAction, actionWidth = 'sm:min-w-[4.5rem]',
}) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] sm:grid-cols-[34px_minmax(0,1fr)_auto_auto] items-center gap-x-3 sm:gap-x-5 py-3.5">
      {icon}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="text-[15px] font-medium text-fg truncate max-w-full">{title}</span>
          {badges}
        </p>
        <p className="text-[13px] text-muted mt-0.5">
          {due && <span className={urgent ? 'font-medium text-warning' : 'text-fg'}>{due}</span>}
          {due && meta && ' · '}
          {meta}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 sm:contents">
        <Money value={amount} className="text-base font-semibold text-fg sm:text-right" />
        <Button size="sm" variant="secondary" onClick={onAction} className={actionWidth}>
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}
