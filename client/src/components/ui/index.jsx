import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function cx(...args) {
  return args.filter(Boolean).join(' ')
}

// ---------- Card ----------
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx('bg-surface border border-border rounded-card shadow-card', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cx('p-5', className)}>{children}</div>
}

// ---------- Button ----------
const btnVariants = {
  primary: 'bg-accent text-accent-fg hover:opacity-90 shadow-sm',
  secondary: 'bg-surface-2 text-fg hover:bg-border/60 border border-border',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-negative text-white hover:opacity-90',
  outline: 'border border-border text-fg hover:bg-surface-2',
}
const btnSizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9 justify-center',
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
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

// ---------- Input ----------
export function Input({ className, label, hint, autoComplete = 'off', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>}
      <input
        autoComplete={autoComplete}
        className={cx(
          'w-full h-9 px-3 rounded-lg bg-surface border border-border text-base sm:text-sm text-fg',
          'placeholder:text-muted/70 focus:border-accent focus:ring-0 outline-none transition-colors',
          className
        )}
        {...props}
      />
      {hint && <span className="block text-2xs text-muted mt-1">{hint}</span>}
    </label>
  )
}

export function Select({ className, label, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>}
      <select
        className={cx(
          'w-full h-9 px-3 rounded-lg bg-surface border border-border text-base sm:text-sm text-fg',
          'focus:border-accent outline-none transition-colors appearance-none cursor-pointer',
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
      {label && <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>}
      <textarea
        className={cx(
          'w-full px-3 py-2 rounded-lg bg-surface border border-border text-base sm:text-sm text-fg',
          'placeholder:text-muted/70 focus:border-accent outline-none transition-colors resize-none',
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
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium',
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
  const barColor = color || (pct >= 100 ? 'rgb(var(--negative))' : pct >= 85 ? 'rgb(var(--warning))' : 'rgb(var(--accent))')
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
          'relative w-full flex flex-col bg-surface border border-border shadow-pop',
          'rounded-t-2xl sm:rounded-card',
          'animate-[slideUp_.2s_ease] sm:animate-[popIn_.15s_ease]',
          'max-h-[90dvh] sm:max-h-[85vh]',
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-fg h-9 w-9 sm:h-7 sm:w-7 flex items-center justify-center rounded-md hover:bg-surface-2 transition-colors"
          >
            <X size={18} className="sm:hidden" />
            <X size={16} className="hidden sm:block" />
          </button>
        </div>
        <div ref={bodyRef} className="px-5 py-4 overflow-y-auto overscroll-contain flex-1">{children}</div>
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
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      {Icon && (
        <div className="h-11 w-11 rounded-full bg-surface-2 flex items-center justify-center mb-3">
          <Icon size={20} className="text-muted" />
        </div>
      )}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="text-xs text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---------- Segmented control ----------
export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cx('inline-flex max-w-full overflow-x-auto no-scrollbar p-0.5 bg-surface-2 rounded-lg border border-border', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cx(
            'px-3 h-8 sm:h-7 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0',
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
export function Toggle({ checked, onChange, disabled, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cx(
        'relative inline-flex items-center shrink-0 h-6 w-11 rounded-full transition-colors duration-200 outline-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-accent' : 'bg-border',
        className
      )}
    >
      <span
        className={cx(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}
