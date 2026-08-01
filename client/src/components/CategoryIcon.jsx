import * as Icons from 'lucide-react'

// Render icon lucide by name string, dengan warna kategori sebagai bg lembut.
export default function CategoryIcon({ name, color = '#71717a', size = 18, boxed = true }) {
  const Icon = Icons[name] || Icons.Circle
  if (!boxed) return <Icon size={size} style={{ color }} />
  const box = size + 18
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg shrink-0"
      style={{
        width: box,
        height: box,
        background: color + '1f',
        color,
      }}
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  )
}
