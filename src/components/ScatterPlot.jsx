import { useMemo, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ReferenceLine,
} from 'recharts'
import { ROWS, rowKey, axisOptions, axisFor, pearson, spearman, fmtRaw } from '../lib/ssi.js'

// 지표 간 산점도 — 가로·세로축을 직접 지정한다.
//
// 아래쪽 '민감도 산점도'는 축이 고정(Min-Max 순위 × 백분위순위 순위)이라
// 표준화 방법 이야기만 할 수 있다. 여기서는 선택 지표의 원값·표준화 값·
// 부문점수·순위를 자유롭게 짝지어 두 변수의 상관을 확인한다.

const fmt = (v) => (v == null ? '—' : Number.isInteger(v) ? String(v) : fmtRaw(v))

// 상관계수 해석 구간 — |r| 0.7 / 0.4 / 0.2를 경계로 읽는 통상적인 기준
function rWord(r) {
  const a = Math.abs(r)
  const dir = r >= 0 ? '양(+)의 상관' : '음(−)의 상관'
  if (a >= 0.7) return `강한 ${dir}`
  if (a >= 0.4) return `중간 정도의 ${dir}`
  if (a >= 0.2) return `약한 ${dir}`
  return '상관 관계 없음'
}

export default function ScatterPlot({ sector, method, selected, onSelect, xKey, yKey, onAxis, ver = 0 }) {
  const opts = useMemo(() => axisOptions(sector, method), [sector, method, ver])
  const [sidoOnly, setSidoOnly] = useState(false)

  // 기본 축은 '선택 지표 두 개의 원값'. 부문점수와 표준점수(T)를 마주 놓으면
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

  // 축 선택은 한 줄에 하나씩 세로로 쌓는다. 나란히 두면 상자 폭이 절반이라
  // '주관적 건강인지율 2023 표준화 값' 같은 이름이 잘려 무엇을 고른 상태인지
  // 읽히지 않는다. 마우스를 올리면 전체 이름이 뜨고, 아래 줄에도 한 번 더 적는다.
  const Pick = ({ side, cur }) => (
    <label className="sp-pick">
      <em>{side}축</em>
      <select value={cur.key} title={cur.label}
        onChange={(e) => onAxis(side === '가로' ? 'x' : 'y', e.target.value)}>
        {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  )

  if (opts.length < 2) return <div className="empty-hint">지표를 하나 이상 선택해 주세요</div>

  return (
    <div className="chart-bare sp">
      <div className="sp-bar">
        <Pick side="가로" cur={ax} />
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
            tick={{ fontSize: 10.5, fill: '#9aa0ac' }} tickFormatter={fmt} height={22} />
          <YAxis type="number" dataKey="y" name={ay.label} reversed={!!ay.invert}
            domain={['dataMin', 'dataMax']} tickLine={false} axisLine={false}
            tick={{ fontSize: 10.5, fill: '#9aa0ac' }} width={46} tickFormatter={fmt} />
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

      <div className="sp-axcap">
        <span><em>가로</em>{ax.label}{ax.invert ? ' · 오른쪽이 상위' : ''}</span>
        <span><em>세로</em>{ay.label}{ay.invert ? ' · 위쪽이 상위' : ''}</span>
      </div>

      <div className="sp-note">
        점 하나가 시군구 하나입니다. 점을 누르면 그 지역이 지도와 진단표에 함께 선택됩니다.
        상관계수는 두 값이 함께 변하는 정도를 나타낼 뿐이며, 인과 관계를 뜻하지 않습니다.
      </div>
    </div>
  )
}
