import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import ChartTooltip from './ChartTooltip.jsx'
import { formatRupiahCompact } from '../../lib/format.js'

export default function NetWorthTrend({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
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
          stroke="rgb(var(--fg))"
          strokeWidth={2}
          fill="rgb(var(--fg))"
          fillOpacity={0.06}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
