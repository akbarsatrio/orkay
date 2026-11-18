import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { cx } from './index.jsx'

/** Aksi standar Ubah + Hapus untuk SwipeRow. `name` dipakai di label pembaca layar. */
export function editDeleteActions(name, onEdit, onDelete) {
  return [
    { label: 'Ubah', ariaLabel: `Ubah ${name}`, icon: Pencil, onSelect: onEdit },
    { label: 'Hapus', ariaLabel: `Hapus ${name}`, icon: Trash2, onSelect: onDelete, danger: true },
  ]
}

// Hanya HP & tablet (< 1024px). Di desktop baris tampil biasa dan aksi memakai tombol yang muncul saat hover.
const MOBILE_QUERY = '(max-width: 1023px)'
const ACTION_W = 64 // px per tombol aksi (ikon saja), tombol menempel penuh tanpa celah & tanpa radius
// Saat digeser, konten mendapat padding kanan yang tumbuh bersama geseran (maks 14px) supaya teks tidak menempel
// ke tombol; saat tertutup padding 0 sehingga tata letak baris tidak berubah.
const CONTENT_PAD = 14
const OPEN_EVENT = 'swiperow:open'
// Elemen interaktif di dalam baris (saklar, tombol, link) tidak memicu ketukan baris.
const INTERACTIVE = 'button, a, input, select, textarea, [role="switch"]'
// Waktu terakhir sebuah baris ditutup oleh ketukan di luar (dipakai bersama semua baris).
let lastOutsideClose = 0

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = (e) => setMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

/**
 * Baris dengan aksi geser ala WhatsApp/Telegram (HP & tablet):
 * - Geser ke kiri memunculkan tombol aksi di kanan (mis. Ubah, Hapus). Hanya satu baris terbuka sekaligus;
 *   ketuk di luar, Escape, atau geser balik untuk menutup.
 * - Ketuk baris menjalankan `onTap`: alternatif satu ketukan untuk gesture (WCAG 2.5.1).
 * - Keyboard & pembaca layar: aksi tetap tersedia sebagai tombol tak terlihat (sr-only) dengan `ariaLabel`.
 * actions: [{ label, ariaLabel, icon: LucideIcon, onSelect, danger }]
 */
export default function SwipeRow({ actions = [], onTap, children, className }) {
  const mobile = useIsMobile()
  const id = useRef(Math.random().toString(36).slice(2))
  const wrapRef = useRef(null)
  const drag = useRef(null)
  const suppressClick = useRef(false)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const max = actions.length * ACTION_W
  const open = offset !== 0

  const close = useCallback(() => setOffset(0), [])
  const openRow = useCallback(() => {
    setOffset(-max)
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id.current }))
  }, [max])

  // Baris lain ditutup saat baris ini dibuka.
  useEffect(() => {
    if (!mobile) return
    const onOtherOpen = (e) => { if (e.detail !== id.current) close() }
    window.addEventListener(OPEN_EVENT, onOtherOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpen)
  }, [mobile, close])

  // Ketuk di luar / Escape menutup baris yang terbuka.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      lastOutsideClose = Date.now()
      close()
    }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  if (!mobile) return <div className={className}>{children}</div>

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    suppressClick.current = false
    drag.current = { x: e.clientX, y: e.clientY, start: offset, axis: null }
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.axis === 'x') {
        setDragging(true)
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }
    }
    if (d.axis === 'x') setOffset(Math.max(-max, Math.min(0, d.start + dx)))
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d || !d.axis) return
    // Gerakan (geser/scroll) bukan ketukan: klik yang menyusul diabaikan.
    suppressClick.current = true
    if (d.axis === 'x') {
      // Lepas melewati setengah lebar aksi = terbuka, kalau tidak = tertutup.
      if (offset < -max / 2) openRow()
      else close()
    }
  }

  // Ketukan dijalankan pada `click` (bukan pointerup) supaya klik susulan dari ketukan tidak jatuh ke modal yang
  // baru terbuka di bawah jari.
  const onClick = (e) => {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (open) { close(); return }
    // Ketukan yang baru saja menutup baris lain bukan ketukan untuk baris ini.
    if (Date.now() - lastOutsideClose < 400) return
    if (e.target.closest(INTERACTIVE)) return
    onTap?.()
  }

  const onPointerCancel = () => {
    drag.current = null
    setDragging(false)
    if (offset > -max / 2) close()
  }

  // Ikon muncul bertahap selama 80% pertama geseran (0% -> 80% = transparan -> penuh), lalu tetap penuh.
  // Latar tombol tetap padat; hanya ikonnya yang memudar, supaya ikon tidak terpotong/tumpang tindih saat tombol masih sempit.
  const iconOpacity = max ? Math.min(1, (-offset / max) / 0.8) : 0

  return (
    <div ref={wrapRef} className={cx('relative overflow-hidden', className)}>
      {/* Tombol aksi rata kanan, setinggi baris, menempel tanpa celah. Lebar panel mengikuti jarak geser, jadi tombol
          ikut melebar mulus dari kanan; latar padat (tanpa transparansi). */}
      <div
        className={cx(
          'absolute inset-y-0 right-0 flex overflow-hidden',
          !dragging && 'transition-[width] duration-200 ease-out'
        )}
        style={{ width: -offset }}
        aria-hidden={!open}
      >
        {actions.map(({ label, ariaLabel, icon: Icon, onSelect, danger }) => (
          <button
            key={label}
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label={ariaLabel || label}
            title={label}
            onClick={() => { close(); onSelect() }}
            className={cx(
              'flex-1 min-w-0 overflow-hidden flex items-center justify-center',
              danger ? 'bg-negative text-negative-fg' : 'bg-surface-2 text-fg'
            )}
          >
            {Icon && (
              <Icon
                size={19}
                className={cx('shrink-0', !dragging && 'transition-opacity duration-200 ease-out')}
                style={{ opacity: iconOpacity }}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      {/* Konten baris: bergeser saat diseret; latar selalu padat (tidak tembus pandang) */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        onPointerCancel={onPointerCancel}
        className={cx(
          'relative bg-bg touch-pan-y select-none',
          onTap && 'cursor-pointer',
          onTap && !dragging && !open && 'active:bg-surface-2',
          !dragging && 'transition-[transform,padding] duration-200 ease-out'
        )}
        style={{
          transform: `translateX(${offset}px)`,
          paddingRight: max ? Math.min(CONTENT_PAD, (-offset / max) * CONTENT_PAD) : 0,
        }}
      >
        {children}
      </div>

      <div className="sr-only">
        {actions.map(({ label, ariaLabel, onSelect }) => (
          <button key={label} type="button" onClick={onSelect}>{ariaLabel || label}</button>
        ))}
      </div>
    </div>
  )
}
