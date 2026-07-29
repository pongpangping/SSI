import { useMemo, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ReferenceLine,
} from 'recharts'
import { ROWS, rowKey, axisOptions, axisFor, pearson, spearman, fmtRaw } from '../lib/ssi.js'

// 두 축을 직접 골라 보는 산점도.
//
// 아래쪽 '민감도 산점도'는 축이 고정(Min-Max 순위 × 백분위순위 순위)이라
// 표준화 방법 이야기만 할 수 있다. 여기서는 담은 지표의 원값·표준화 값·
// 부문점수·순위를 자유롭게 짝지어, "이 지표가 높은 곳은 저 지표도 높은가"를 본다.

const fmt = (v) => (v == null ? '—' : Number.isInteger(v) ? String(v) : fmtRaw(v))

// 상관계수 읽는 법 — 숫자만 던지면 아무도 안 읽는다
function rWord(r) {
  const a = Math.abs(r)
  const dir = r >= 0 ? '같이 움직임' : '반대로 움직임'
  if (a >= 0.7) return `뚜렷하게 ${dir}`
  if (a >= 0.4) return `어느 정도 ${dir}`
  if (a >= 0.2) return `약하게 ${dir}`
  return '뚜렷한 관계 없음'
}

export default function ScatterPlot({ sector, method, selected, onSelect, xKey, yKey, onAxis, ver = 0 }) {
  const opts = useMemo(() => axisOptions(sector, method), [sector, method, ver])
  const [sidoOnly, setSidoOnly] = useState(false)

  // 기본 축은 '담은 지표 두 개의 원값'. 부문점수와 표준점수(T)를 마주 놓으면
  // 같은 값을 눈금만 바꿔 그린 것이라 상관이 1.000으로 나와 볼 것이 없다.
  const [dx, dy] = useMemo(() => {
    const raws = opts.filter((o) => o.key.startsWith('raw:'))
    if (raws.length >= 2) return [raws[0].key, raws[1].key]
    if (raws.length === 1) return [raws[0].key, 'ssiCamp']
    return ['ci', 'ssiCamp']
  }, [opts])

  const ax = axisFor(sector, method, xKey || dx)
  const ay = axisFor(sector, method, yKey || dy)

  const data = useMemo(() => {
    const xs = ROWS.map((r, i) => ax.get(r, i))
    const ys = ROWS.map((r, i) => ay.get(r, i))
    return ROWS.map((r, i) => ({
      x: xs[i], y: ys[i], name: r.name, sido: r.sido,
      key: rowKey(r), high: r[sector]?.flag === 'high',
    })).filter((d) => d.x != null && d.y != null)
  }, [ax, ay, sector, ver])

  const r = useMemo(() => pearson(data.map((d) => d.x), data.map((d) => d.y)), [data])
  const rs = useMemo(() => spearman(data.map((d) => d.x), data.map((d) => d.y)), [data])

  const selRow = data.find((d) => d.key === selected)
  const selSido = selRow ? selRow.sido : null
  const shown = sidoOnly && selSido ? data.filter((d) => d.sido === selSido) : data

  const fill = (d) => (d.key === selected ? '#0F172A' : d.sido === selSido ? '#F5760D' : '#9AD3FF')

  const Pick = ({ side, cur }) => (
    <label className="sp-pick">
      <em>{side}</em>
      <select value={cur.key} onChange={(e) => onAxis(side === '가로' ? 'x' : 'y', e.target.value)}>
        {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  )

  if (opts.length < 2) return <div className="empty-hint">지표를 하나 이상 담아 주세요</div>

  return (
    <div className="chart-bare sp">
      <div className="sp-bar">
        <Pick side="가로" cur={ax} />
        <span className="sp-x">×</span>
        <Pick side="세로" cur={ay} />
      </div>

      <div className="sp-r">
        <b style={{ color: Math.abs(r) >= 0.4 ? '#0B93EE' : '#8894A4' }}>r {r == null ? '—' : r.toFixed(3)}</b>
        <span>{r == null ? '' : rWord(r)}</span>
        <em>순위 상관(Spearman) {rs == null ? '—' : rs.toFixed(3)} · {shown.length}개 지역</em>
        {selSido && (
          <button className={`sp-only${sidoOnly ? ' on' : ''}`} onClick={() => setSidoOnly(!sidoOnly)}>
            {selSido}만
          </button>
        )}
      </div>

      <ResponsiveContainer width="100%" height={286}>
        <ScatterChart margin={{ left: 4, right: 14, top: 10, bottom: 18 }}>
          <CartesianGrid strokeDasharray="2 4" />
          <XAxis type="number" dataKey="x" name={ax.label} reversed={!!ax.invert}
            domain={['dataMin', 'dataMax']} tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: '#9aa0ac' }} tickFormatter={fmt}
            label={{ value: ax.label + (ax.invert ? ' (오른쪽이 상위)' : ''), position: 'insideBottom', offset: -8, fill: '#8a909c', fontSize: 10 }} />
          <YAxis type="number" dataKey="y" name={ay.label} reversed={!!ay.invert}
            domain={['dataMin', 'dataMax']} tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: '#9aa0ac' }} width={44} tickFormatter={fmt}
            label={{ value: ay.label + (ay.invert ? ' (위가 상위)' : ''), angle: -90, position: 'insideLeft', fill: '#8a909c', fontSize: 10 }} />
          {ax.key === 'ciT' && <ReferenceLine x={50} stroke="#CBD5E1" strokeDasharray="5 4" />}
          {ay.key === 'ciT' && <ReferenceLine y={50} stroke="#CBD5E1" strokeDasharray="5 4" />}
          <Tooltip cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="rc-tip">
                  <b>{d.sido} {d.name}</b><br />
                  {ax.label} {fmt(d.x)}<br />
                  {ay.label} {fmt(d.y)}
                </div>
              )
            }} />
          <Scatter data={shown} isAnimationActive={false} onClick={(d) => onSelect(d.key)}>
            {shown.map((d) => (
              <Cell key={d.key} fill={fill(d)} fillOpacity={d.key === selected ? 1 : 0.78}
                stroke={d.key === selected ? '#0F172A' : 'rgba(255,255,255,0.85)'}
                strokeWidth={d.key === selected ? 2 : 0.6} cursor="pointer"
                r={d.key === selected ? 6 : 3.4} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div className="sp-note">
        점 하나가 시군구 하나입니다. 점을 누르면 그 지역이 지도와 성적표에 함께 선택됩니다.
        상관은 두 값이 함께 움직이는 정도일 뿐, 한쪽이 다른 쪽의 원인이라는 뜻은 아닙니다.
      </div>
    </div>
  )
}
