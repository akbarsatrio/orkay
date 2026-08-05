import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import ChartTooltip from './ChartTooltip.jsx'
import { formatRupiahCompact } from '../../lib/format.js'

export default function NetWorthTrend({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.28} />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={formatRupiahCompact}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgb(var(--border))' }} />
        <Area
          type="monotone"
          dataKey="value"
          name="Kekayaan Bersih"
          stroke="rgb(var(--accent))"
          strokeWidth={2}
          fill="url(#netWorthGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
