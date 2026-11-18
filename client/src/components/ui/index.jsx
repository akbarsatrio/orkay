import { useEffect, useRef } from 'react'
import { Check, Minus, X } from 'lucide-react'

export function cx(...args) {
  return args.filter(Boolean).join(' ')
}

// ---------- Card ----------
// Tampilan baru tidak memakai kotak: "Card" adalah bagian halaman yang diawali garis bagian (`border-rule`),
// sedangkan baris di dalamnya dipisah garis abu `border-border` (DESIGN.md > Bentuk).
// Jarak: garis -> isi selalu 20px (pt-5); jarak antar bagian diatur halaman (space-y-6 = 24px, sama dengan judul halaman -> isi).
// Nama komponen dipertahankan supaya pemakaiannya sama di semua halaman.
export function Card({ className, children, ...props }) {
  return (
    <section className={cx('border-t border-rule pt-5 min-w-0', className)} {...props}>
      {children}
    </section>
  )
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-fg leading-snug">{title}</h2>
        {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// Padding bawaan hanya dipasang kalau pemanggil tidak memberi padding sendiri: utilitas padding Tailwind
// tidak saling menimpa sesuai urutan class, jadi `pt-4` + `p-0` akan tetap ber-padding.
// `first:pt-0`: tanpa CardHeader, isi langsung mulai 20px di bawah garis (dari padding Card).
const HAS_PADDING = /(^|\s)p[xytblr]?-/
export function CardBody({ className, children }) {
  return <div className={cx(!HAS_PADDING.test(className || '') && 'pt-4 first:pt-0', className)}>{children}</div>
}

// ---------- Button ----------
// primary = aksi utama halaman (hitam). accent = satu-satunya aksi oranye: Tambah Transaksi global.
const btnVariants = {
  primary: 'bg-fg text-bg hover:opacity-85',
  accent: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'bg-surface-2 text-fg hover:bg-border',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-negative text-negative-fg hover:opacity-90',
  outline: 'border border-fg/20 text-fg hover:bg-surface-2',
}
// `touch:` menaikkan target ke 44px di layar sentuh (DESIGN.md > Responsif).
const btnSizes = {
  sm: 'h-8 touch:h-11 px-3 text-xs touch:text-sm gap-1.5',
  md: 'h-9 touch:h-11 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9 touch:h-11 touch:w-11 justify-center',
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.97]',
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// Tombol Hapus di footer form edit (HP & tablet): alternatif satu ketukan untuk aksi hapus yang di layar daftar
// hanya muncul lewat geser (SwipeRow). Di desktop hapus tetap lewat tombol di baris.
export function FormDeleteButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="lg:hidden mr-auto inline-flex items-center justify-center h-9 touch:h-11 px-3 -ml-3 rounded-md text-sm font-medium text-negative hover:bg-negative/10 disabled:opacity-50 transition-colors"
    >
      Hapus
    </button>
  )
}

// ---------- Input ----------
// Field berisi abu muda dengan garis tipis; garis hitam muncul saat fokus. Dipakai juga oleh input mentah di halaman.
export const fieldClass =
  'rounded-md bg-surface-2 border border-border text-fg placeholder:text-muted hover:border-muted/50 focus:border-fg focus:bg-bg outline-none transition-colors'

export function Input({ className, label, hint, autoComplete = 'off', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-medium text-muted mb-1.5">{label}</span>}
      <input
        autoComplete={autoComplete}
        className={cx(
          'w-full h-9 touch:h-11 px-3 text-base sm:text-sm',
          fieldClass,
          className
        )}
        {...props}
      />
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  )
}

export function Select({ className, label, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-medium text-muted mb-1.5">{label}</span>}
      <select
        className={cx(
          'w-full h-9 touch:h-11 px-3 text-base sm:text-sm appearance-none cursor-pointer',
          fieldClass,
          'bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat',
          className
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Textarea({ className, label, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-medium text-muted mb-1.5">{label}</span>}
      <textarea
        className={cx(
          'w-full px-3 py-2 text-base sm:text-sm resize-none',
          fieldClass,
          className
        )}
        {...props}
      />
    </label>
  )
}

// ---------- Badge ----------
export function Badge({ color, children, className, dot }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        'bg-surface-2 text-fg border border-border',
        className
      )}
    >
      {dot && color && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      )}
      {children}
    </span>
  )
}

// ---------- Progress ----------
export function Progress({ value, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  // Warna status: normal = fg (aksen oranye hanya untuk Tambah Transaksi), >= 85% = warning, >= 100% = negative.
  const barColor = color || (pct >= 100 ? 'rgb(var(--negative))' : pct >= 85 ? 'rgb(var(--warning))' : 'rgb(var(--fg))')
  return (
    <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: barColor }}
      />
    </div>
  )
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null)
  const bodyRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const body = bodyRef.current
    if (!body) return
    const onFocusIn = (e) => {
      const el = e.target
      if (!el.matches?.('input, select, textarea')) return
      // Biar field yg lagi difokus gak ketutup keyboard iOS.
      setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    }
    body.addEventListener('focusin', onFocusIn)
    return () => body.removeEventListener('focusin', onFocusIn)
  }, [open])

  if (!open) return null

  const sizes = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_.15s_ease]"
        onClick={onClose}
      />
      <div
        ref={ref}
        className={cx(
          'relative w-full flex flex-col bg-bg shadow-pop sm:bg-surface sm:border sm:border-border',
          'rounded-t-2xl sm:rounded-card',
          'animate-[slideUp_.2s_ease] sm:animate-[popIn_.15s_ease]',
          'max-h-[90dvh] sm:max-h-[85vh]',
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0 sm:py-4 sm:border-b sm:border-border">
          <h2 className="text-xl font-bold text-fg sm:text-base sm:font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="text-muted hover:text-fg h-9 w-9 touch:h-11 touch:w-11 -mr-2 flex items-center justify-center rounded-md hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div ref={bodyRef} className="px-5 pt-2 pb-4 sm:py-4 overflow-y-auto overscroll-contain flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Empty state ----------
export function Empty({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {Icon && <Icon size={22} className="text-muted mb-3" aria-hidden="true" />}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="text-[13px] text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---------- Segmented control ----------
export function Segmented({ options, value, onChange, className, fill }) {
  return (
    <div className={cx(
      'p-0.5 bg-surface-2 rounded-md',
      fill ? 'flex w-full' : 'inline-flex max-w-full overflow-x-auto no-scrollbar',
      className
    )}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cx(
            // Tinggi total (tombol + padding wadah 2px x 2) = 36px, sama dengan Input/Button md; layar sentuh 44px.
            'px-3 h-8 touch:h-10 text-[13px] touch:text-sm font-medium rounded-md transition-colors whitespace-nowrap',
            fill ? 'flex-1' : 'shrink-0',
            value === opt.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Toggle / Switch ----------
export function Toggle({ checked, onChange, disabled, className, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cx(
        'relative inline-flex items-center shrink-0 h-6 w-11 rounded-full transition-colors duration-200',
        // Area sentuh 44px tanpa membesarkan tampilan.
        "touch:before:absolute touch:before:-inset-2.5 touch:before:content-['']",
        'disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-fg' : 'bg-border',
        className
      )}
    >
      <span
        className={cx(
          'inline-block h-5 w-5 rounded-full bg-surface shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

// ---------- Checkbox ----------
// Input asli (keyboard, pembaca layar, label) dengan tampilan sendiri: kosong = isian abu seperti field, tercentang =
// `fg` seperti Toggle (aksen oranye tidak dipakai). `indeterminate` = sebagian terpilih (mis. "Pilih semua").
export function Checkbox({ checked, indeterminate = false, onChange, disabled, className, ...props }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate && !checked }, [indeterminate, checked])
  const Mark = checked ? Check : indeterminate ? Minus : null
  return (
    <span className={cx('relative inline-flex shrink-0 h-[18px] w-[18px]', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={cx(
          'peer appearance-none m-0 h-full w-full rounded-[5px] border transition-colors cursor-pointer',
          'disabled:opacity-50 disabled:cursor-default',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg',
          checked || indeterminate ? 'bg-fg border-fg' : 'bg-surface-2 border-muted/50 hover:border-muted'
        )}
        {...props}
      />
      {Mark && (
        <Mark size={13} strokeWidth={3} aria-hidden="true" className="absolute inset-0 m-auto text-bg pointer-events-none" />
      )}
    </span>
  )
}
