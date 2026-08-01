import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import ChartTooltip from './ChartTooltip.jsx'
import { formatRupiah } from '../../lib/format.js'
import { Empty } from '../ui/index.jsx'
import { PieChart as PieIcon } from 'lucide-react'

export default function CategoryDonut({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) {
    return <Empty icon={PieIcon} title="Belum ada pengeluaran" description="Data breakdown kategori akan muncul di sini." />
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xs text-muted">Total</span>
          <span className="text-sm font-bold text-fg tnum">{formatRupiah(total)}</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {data.slice(0, 6).map((d) => {
          const pct = ((d.value / total) * 100).toFixed(0)
          return (
            <div key={d.name} className="flex items-center gap-2.5 text-sm">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
              <span className="text-fg truncate flex-1">{d.name}</span>
              <span className="text-muted text-xs tnum">{pct}%</span>
              <span className="font-medium text-fg tnum w-24 text-right">{formatRupiah(d.value)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
