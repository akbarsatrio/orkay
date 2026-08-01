import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import ChartTooltip from './ChartTooltip.jsx'
import { formatRupiahCompact } from '../../lib/format.js'

export default function CashflowBar({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={4}>
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
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--surface-2))' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: 'rgb(var(--muted))', paddingTop: 8 }}
        />
        <Bar dataKey="income" name="Pemasukan" fill="rgb(var(--positive))" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expense" name="Pengeluaran" fill="rgb(var(--negative))" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
