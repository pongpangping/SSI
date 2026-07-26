import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { metricBy } from '../lib/metrics.js'

export default function RankingBar({ rows, selected, hovered, onSelect, onHover, metricKey, typeFilter }) {
  const metric = metricBy(metricKey)
  const data = [...rows]
    .filter((r) => r[metric.key] != null)
    .sort((a, b) => b[metric.key] - a[metric.key])
    .map((r) => ({ ...r, label: r.name, val: r[metric.key] }))

  const fillFor = (row) => {
    if (typeFilter && row.oneType !== typeFilter) return 'rgba(42,120,214,0.12)'
    if (row.code === selected) return '#2a78d6'
    if (row.code === hovered) return '#5598e7'
    return 'rgba(42,120,214,0.38)'
  }

  return (
    <div className="glass card">
      <h2>시군구 순위 · {metric.label}</h2>
      <div className="card-sub">막대에 올리면 지도가 함께 표시 · 클릭하면 선택 · 지도 버튼으로 지표 전환</div>
      <ResponsiveContainer width="100%" height={330}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}
          barCategoryGap={6}>
          <XAxis type="number" domain={[0, 'dataMax']} tickLine={false} axisLine={false}
            tickFormatter={(v) => metric.fmt(v)} />
          <YAxis type="category" dataKey="label" width={62} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(20,30,60,0.05)' }}
            formatter={(v) => [metric.fmt(v), metric.label]} />
          <Bar dataKey="val" radius={[0, 5, 5, 0]} cursor="pointer" isAnimationActive={false}
            onClick={(d) => onSelect(d.code)}
            onMouseEnter={(d) => onHover?.(d.code)} onMouseLeave={() => onHover?.(null)}>
            {data.map((d) => (
              <Cell key={d.code} fill={fillFor(d)}
                stroke={d.code === selected ? '#184f95' : 'none'} strokeWidth={1.5} />
            ))}
            <LabelList dataKey="val" position="right"
              formatter={(v) => metric.fmt(v)} fill="#4b515e" fontSize={11.5} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
