import { formatRupiah } from '../../lib/format.js'

export default function ChartTooltip({ active, payload, label, labelText }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-pop px-3 py-2 text-xs">
      {label != null && <p className="font-medium text-fg mb-1">{labelText ? labelText(label) : label}</p>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span className="text-muted">{p.name}</span>
            <span className="ml-auto font-semibold text-fg tnum">{formatRupiah(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
