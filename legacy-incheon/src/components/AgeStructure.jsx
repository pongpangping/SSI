import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { pct } from '../lib/format.js'

const SEG = [
  { key: 'youngOneShare', name: '청년(20~39)', color: '#33A8FF' },
  { key: 'midOneShare', name: '중년(40~64)', color: '#94A3B8' },
  { key: 'agedOneShareOfOne', name: '고령(65+)', color: '#FF8A00' },
]

export default function AgeStructure({ rows, selected, hovered, onSelect, onHover, bare }) {
  const data = [...rows]
    .filter((r) => r.agedOneShareOfOne != null)
    .sort((a, b) => b.agedOneShareOfOne - a.agedOneShareOfOne)
  const dim = (code) => (selected && code !== selected) || (hovered && code !== hovered)

  return (
    <div className={bare ? 'chart-bare' : 'glass card'}>
      {!bare && <h2>1인가구 연령대 구성</h2>}
      <div className="card-sub">
        시군구별 1인가구를 연령대로 분해 (KOSIS 2023) · 고령 비중 높은 순 · 클릭하면 지도 이동
      </div>
      <div className="type-legend">
        {SEG.map((s) => (<span key={s.key}><i style={{ background: s.color }} />{s.name}</span>))}
      </div>
      <ResponsiveContainer width="100%" height={332}>
        <BarChart data={data} layout="vertical" stackOffset="expand"
          margin={{ left: 8, right: 12, top: 4, bottom: 4 }} barCategoryGap={5}>
          <XAxis type="number" hide domain={[0, 1]} />
          <YAxis type="category" dataKey="name" width={62} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(20,30,60,0.05)' }}
            formatter={(v, n, p) => [pct(p.payload[SEG.find((s) => s.name === n).key]), n]} />
          {SEG.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="a" name={s.name}
              isAnimationActive={false} cursor="pointer"
              onClick={(d) => onSelect(d.code)}
              onMouseEnter={(d) => onHover?.(d.code)} onMouseLeave={() => onHover?.(null)}>
              {data.map((d) => (
                <Cell key={d.code} fill={s.color}
                  fillOpacity={dim(d.code) ? 0.4 : 1}
                  stroke={d.code === selected ? '#0F172A' : '#fff'}
                  strokeWidth={d.code === selected ? 1.4 : 0.6} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
