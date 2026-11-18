import { formatNumber } from '../../lib/format.js'
import { cx } from './index.jsx'

// Lebar glyph Instrument Sans tebal (angka tabular) dalam em, diukur dari file font Google Fonts.
const METRICS = {
  75: { digit: 0.5, dot: 0.242, bullet: 0.305, rp: 0.947 },
  100: { digit: 0.6, dot: 0.285, bullet: 0.351, rp: 1.296 },
}
const RP_SCALE = 0.42 // "Rp" lebih kecil dari digit
const RP_GAP = 0.08
const SAFETY = 1.04

const MAX = { giant: '5.5rem', large: '2.5rem' }

function emWidth(text, w) {
  const m = METRICS[w]
  let width = m.rp * RP_SCALE + RP_GAP
  for (const ch of text) {
    if ((ch >= '0' && ch <= '9') || ch === '−' || ch === '+') width += m.digit
    else if (ch === '•') width += m.bullet
    else width += m.dot // titik ribuan
  }
  return width * SAFETY
}

/**
 * Nominal Rupiah untuk tampilan baru.
 * size 'giant' | 'large': ukuran mengecil otomatis supaya selalu muat di lebar wadah (tidak pernah terpotong).
 * size 'row': angka di daftar, ukuran mengikuti teks sekitar.
 * sign: '+' / '-' untuk memaksa tanda (mis. pemasukan/pengeluaran); default ikut tanda nilai.
 */
export default function Money({ value, hidden = false, size = 'row', sign, className }) {
  const n = Math.round(value || 0)
  const negative = sign ? sign === '-' : !hidden && n < 0
  const prefix = sign === '+' ? '+' : negative ? '−' : ''
  const body = hidden ? '••••••' : formatNumber(Math.abs(n))

  if (size === 'row') {
    return (
      <span className={cx('tnum whitespace-nowrap', className)}>
        {prefix}Rp&nbsp;{body}
      </span>
    )
  }

  const label = hidden ? 'Nominal disembunyikan' : `${negative ? 'minus ' : ''}Rp ${body}`
  const style = {
    '--money-max': MAX[size],
    '--w75': emWidth(prefix + body, 75),
    '--w100': emWidth(prefix + body, 100),
  }

  return (
    <div className="money-fit">
      <p className={cx('money flex items-start', className)} style={style}>
        <span className="sr-only">{label}</span>
        {prefix && <span aria-hidden="true">{prefix}</span>}
        <span aria-hidden="true" className="text-[0.42em] leading-none mt-[0.14em] mr-[0.08em] font-semibold">Rp</span>
        <span aria-hidden="true">{body}</span>
      </p>
    </div>
  )
}
