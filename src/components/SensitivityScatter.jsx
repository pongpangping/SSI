import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ReferenceLine,
} from 'recharts'
import { ROWS, rowKey } from '../lib/ssi.js'

// x=MinMax(간격보존형) 순위, y=PctRank(순위전용형) 순위.
// 대각선에서 멀수록 두 진영의 판단이 다름 = SSI_camp 큼.
export default function SensitivityScatter({ sector, selected, onSelect, ver = 0 }) {
  const data = ROWS
    .filter((r) => r[sector]?.rank.minmax != null && r[sector]?.rank.pctrank != null)
    .map((r) => ({
      x: r[sector].rank.minmax, y: r[sector].rank.pctrank,
      camp: r[sector].ssiCamp, high: r[sector].flag === 'high',
      name: r.name, sido: r.sido, key: rowKey(r),
    }))

  const fill = (d) => d.key === selected ? '#0F172A' : d.high ? '#F5760D' : '#9AD3FF'

  return (
    <div className="chart-bare">
      <div className="card-sub">대각선 위 = 두 방법 순위 동일. 대각선에서 멀수록(주황) 표준화 방법에 민감. 클릭하면 상세 진단.</div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ left: 6, right: 14, top: 8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="2 4" />
          <XAxis type="number" dataKey="x" name="Min-Max 순위" domain={[0, 230]} reversed
            tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: '#9aa0ac' }} height={22} />
          <YAxis type="number" dataKey="y" name="백분위순위 순위" domain={[0, 230]} reversed
            tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: '#9aa0ac' }} width={34} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 230, y: 230 }]} stroke="#CBD5E1" strokeDasharray="5 4" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return <div className="rc-tip"><b>{d.sido} {d.name}</b><br />Min-Max {d.x}위 · 백분위순위 {d.y}위<br />순위 이동 {d.camp}계단{d.high ? ' · 민감' : ''}</div>
            }} />
          <Scatter data={data} isAnimationActive={false} onClick={(d) => onSelect(d.key)}>
            {data.map((d) => (
              <Cell key={d.key} fill={fill(d)} fillOpacity={d.key === selected ? 1 : 0.8}
                stroke={d.key === selected ? '#0F172A' : 'rgba(255,255,255,0.85)'}
                strokeWidth={d.key === selected ? 2 : 0.6} cursor="pointer" r={d.key === selected ? 6 : d.high ? 4 : 3} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="sp-axcap">
        <span><em>가로</em>Min-Max(간격보존형) 순위 · 오른쪽이 상위</span>
        <span><em>세로</em>백분위순위(순위전용형) 순위 · 위쪽이 상위</span>
      </div>
      <div className="type-legend">
        <span><i style={{ background: '#F5760D' }} />민감(high)</span>
        <span><i style={{ background: '#9AD3FF' }} />안정</span>
        <span><i style={{ background: '#0F172A' }} />선택</span>
      </div>
    </div>
  )
}
