import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cx } from './index.jsx'

/**
 * Tombol "⋯" yang membuka daftar aksi baris (dipakai di HP supaya aksi tidak memakan lebar baris).
 * items: [{ label, icon: LucideIcon, onSelect, danger }]. Tutup dengan Escape, klik di luar, atau setelah memilih.
 * Menu membuka ke atas kalau ruang di bawah tidak cukup (mis. dekat bottom nav).
 */
export default function RowMenu({ items, label = 'Aksi', className }) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      const r = btnRef.current.getBoundingClientRect()
      setUp(window.innerHeight - r.bottom < 180)
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={wrapRef} className={cx('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-9 w-9 touch:h-11 touch:w-11 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface-2 transition-colors"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className={cx(
            'absolute right-0 z-20 min-w-[10rem] rounded-md border border-border bg-bg shadow-pop py-1',
            up ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          {items.map(({ label: itemLabel, icon: Icon, onSelect, danger }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onSelect() }}
              className={cx(
                'flex w-full items-center gap-2.5 h-11 px-3 text-sm text-left transition-colors hover:bg-surface-2',
                danger ? 'text-negative' : 'text-fg'
              )}
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
