import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LabelList, ReferenceLine, ReferenceArea,
} from 'recharts'
import { pct, comma } from '../lib/format.js'

// 1인가구 비율 × 고령 1인가구 비중은 선형 상관이 약하다(청년 집중 도심 ↔ 고령 집중 섬·원도심이 섞임).
// → 회귀선 대신 '인천 평균(십자선)' 기준 4사분면 유형으로 읽는다.
export default function ScatterAgedOne({ rows, selected, hovered, onSelect, onHover, summary, bare }) {
  const data = rows
    .filter((r) => r.onePersonRate != null && r.agedOneShareOfOne != null)
    .map((r) => ({ x: r.onePersonRate, y: r.agedOneShareOfOne, z: r.onePerson, name: r.name, code: r.code }))

  const xs = data.map((d) => d.x), ys = data.map((d) => d.y)
  const ax = summary.onePersonRate         // 인천 평균 1인가구 비율
  const ay = summary.agedOneShareOfOne      // 인천 평균 고령 비중
  const xLo = Math.min(...xs) - 2, xHi = Math.max(...xs) + 2
  const yLo = Math.min(...ys) - 3, yHi = Math.max(...ys) + 4

  // 유형: 1인가구율(평균 대비) × 고령비중(평균 대비)
  const typeOf = (d) => d.x >= ax
    ? (d.y >= ay ? 'aged' : 'young')   // 1인가구 많음 → 고령집중형 / 청년집중형
    : 'low'                             // 1인가구 적음
  const COL = { aged: '#F5760D', young: '#0B93EE', low: '#94A3B8' }
  const fillFor = (d) => {
    const base = COL[typeOf(d)]
    if (d.code === selected) return base
    if (d.code === hovered) return base
    return base + 'B0' // 약한 투명
  }

  return (
    <div className={bare ? 'chart-bare' : 'glass card'}>
      {!bare && <h2>1인가구 비율 × 고령 비중 — 유형 분석</h2>}
      <div className="card-sub">
        인천 평균(십자선) 기준 4개 유형 · 원 크기 = 1인가구 수. 두 지표는 상관이 아니라 유형을 가릅니다.
      </div>
      <div className="type-legend">
        <span><i style={{ background: COL.young }} />청년 집중형</span>
        <span><i style={{ background: COL.aged }} />고령 집중형</span>
        <span><i style={{ background: COL.low }} />1인가구 적음</span>
      </div>
      <ResponsiveContainer width="100%" height={324}>
        <ScatterChart margin={{ left: 4, right: 18, top: 10, bottom: 16 }}>
          <CartesianGrid strokeDasharray="2 4" />
          {/* 사분면 배경 — 정책상 중요한 '1인가구 많은' 우측 두 유형을 옅게 강조 */}
          <ReferenceArea x1={ax} x2={xHi} y1={ay} y2={yHi} fill="#F5760D" fillOpacity={0.06}
            label={{ value: '고령 집중형', position: 'insideTopRight', fill: '#C2620B', fontSize: 10, fontWeight: 700 }} />
          <ReferenceArea x1={ax} x2={xHi} y1={yLo} y2={ay} fill="#0B93EE" fillOpacity={0.06}
            label={{ value: '청년 집중형', position: 'insideBottomRight', fill: '#0B6BB0', fontSize: 10, fontWeight: 700 }} />
          <XAxis type="number" dataKey="x" name="1인가구 비율" unit="%"
            domain={[xLo, xHi]} tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: '#9aa0ac' }}
            label={{ value: '1인가구 비율(%) →', position: 'insideBottom', offset: -6, fill: '#8a909c', fontSize: 10 }} />
          <YAxis type="number" dataKey="y" name="고령 비중" unit="%"
            domain={[yLo, yHi]} tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: '#9aa0ac' }}
            label={{ value: '고령 비중(%) →', angle: -90, position: 'insideLeft', fill: '#8a909c', fontSize: 10 }} />
          <ZAxis type="number" dataKey="z" range={[40, 260]} />
          <ReferenceLine x={ax} stroke="#CBD5E1" strokeDasharray="4 3"
            label={{ value: '평균', position: 'top', fill: '#94A3B8', fontSize: 9 }} />
          <ReferenceLine y={ay} stroke="#CBD5E1" strokeDasharray="4 3" />
          <Tooltip cursor={{ strokeDasharray: '3 3', stroke: 'rgba(20,30,60,0.25)' }}
            formatter={(v, n) => n === '1인가구 수' ? comma(v) : pct(v)} />
          <Scatter data={data} isAnimationActive={false}
            onClick={(d) => onSelect(d.code)}
            onMouseEnter={(d) => onHover?.(d.code)} onMouseLeave={() => onHover?.(null)}>
            {data.map((d) => (
              <Cell key={d.code} fill={fillFor(d)}
                stroke={d.code === selected ? '#0F172A' : 'rgba(255,255,255,0.9)'}
                strokeWidth={d.code === selected ? 2 : 1} cursor="pointer" />
            ))}
            <LabelList dataKey="name" position="top" fill="#4b515e" fontSize={9} offset={6} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
