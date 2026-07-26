import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { comma } from '../lib/format.js'

// dual-axis 금지 → 단일 축 small multiples 두 개
function Mini({ data, dataKey, color, unit, fmt, ytick }) {
  return (
    <ResponsiveContainer width="100%" height={128}>
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 2 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} interval={1} fontSize={10} />
        <YAxis domain={['dataMin', 'dataMax']} width={40} tickFormatter={ytick}
          tickLine={false} axisLine={false} fontSize={10} />
        <Tooltip formatter={(v) => [fmt(v), unit]} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5}
          dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function TrendChart({ trend, bare }) {
  const data = trend.map((t) => ({
    month: t.month.slice(5) + '월',
    households: t.households,
    avg: t.avgHouseholdSize,
  }))
  return (
    <div className={bare ? 'chart-bare' : 'glass card'}>
      {!bare && <h2>세대수 · 세대당 인구 추이</h2>}
      <div className="card-sub">인천광역시 · 2025년 월별 (주민등록)</div>
      <div style={{ fontSize: 12, color: '#008AE0', fontWeight: 600, margin: '2px 0 -2px' }}>세대수</div>
      <Mini data={data} dataKey="households" color="#008AE0" unit="세대수"
        fmt={(v) => comma(v) + '세대'} ytick={(v) => `${(v / 10000).toFixed(0)}만`} />
      <div style={{ fontSize: 12, color: '#FF8A00', fontWeight: 600, margin: '8px 0 -2px' }}>세대당 인구(명)</div>
      <Mini data={data} dataKey="avg" color="#FF8A00" unit="세대당 인구"
        fmt={(v) => v + '명'} ytick={(v) => v.toFixed(2)} />
    </div>
  )
}
