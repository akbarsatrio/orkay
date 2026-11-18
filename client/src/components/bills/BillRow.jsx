import { ChevronRight } from 'lucide-react'
import { Button, cx } from '../ui/index.jsx'
import Money from '../ui/Money.jsx'
import { useIsMobile } from '../ui/SwipeRow.jsx'

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
 * `tapToAct` (HP & tablet): seluruh baris jadi area ketuk untuk aksi, tombol disembunyikan secara visual
 * (tetap ada untuk keyboard/pembaca layar) dan diganti chevron sebagai penanda baris bisa diketuk.
 * `due` ditampilkan lebih terang dari `meta`; `urgent` mewarnainya kuning (jatuh tempo hari ini).
 * `actionWidth`: lebar minimum tombol supaya kolom nominal tetap lurus antar-bagian di satu halaman.
 */
export default function BillRow({
  icon, title, badges, due, urgent, meta, amount, actionLabel, onAction, actionWidth = 'sm:min-w-[4.5rem]', tapToAct = false,
}) {
  const mobile = useIsMobile()
  const tap = tapToAct && mobile
  return (
    <div
      onClick={tap ? onAction : undefined}
      className={cx(
        'grid grid-cols-[34px_minmax(0,1fr)_auto] sm:grid-cols-[34px_minmax(0,1fr)_auto_auto] items-center gap-x-3 sm:gap-x-5 py-3.5',
        tap && 'cursor-pointer select-none active:bg-surface-2/60'
      )}
    >
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
      <div className={cx('flex flex-col items-end gap-1.5 sm:contents', tapToAct && 'max-lg:flex-row max-lg:items-center max-lg:gap-2')}>
        <Money value={amount} className="text-base font-semibold text-fg sm:text-right" />
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); onAction() }}
          aria-label={`${actionLabel} ${title}`}
          className={cx(actionWidth, tapToAct && 'max-lg:sr-only')}
        >
          {actionLabel}
        </Button>
        {tapToAct && <ChevronRight size={18} className="lg:hidden text-muted" aria-hidden="true" />}
      </div>
    </div>
  )
}
