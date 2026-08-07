import { useMemo, useRef, useState } from 'react'
import DlMenu from './DlMenu.jsx'
import { ROWS } from '../lib/pipeline.js'

// 산점도 — 통계 패널용. v2의 산점도(축을 골라 두 값의 관계를 본다)를
// v3 파이프라인 값으로 다시 만들었다. 축 후보는 부문지수·T점수와
// 선택 지표 각각의 표준화값·원값이고, 고른 지역은 붉게 도드라진다.

const num = (x) => x != null && Number.isFinite(x)

export default function MiniScatter({ options, selectedIdx = null }) {
  const [xi, setXi] = useState(Math.min(2, options.length - 1))
  const [yi, setYi] = useState(0)
  const svgRef = useRef(null)
  const X = options[Math.min(xi, options.length - 1)]
  const Y = options[Math.min(yi, options.length - 1)]
  const pts = useMemo(
    () => X.vals.map((x, i) => [x, Y.vals[i], i]).filter((p) => num(p[0]) && num(p[1])),
    [X, Y])
  if (!pts.length) return <div className="eh-empty">그릴 값이 없습니다</div>

  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  const W = 272, H = 188, P = 10
  const sx = (v) => P + ((v - x0) / ((x1 - x0) || 1)) * (W - 2 * P)
  const sy = (v) => H - P - ((v - y0) / ((y1 - y0) || 1)) * (H - 2 * P)

  const n = pts.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let t = 0, da = 0, db = 0
  pts.forEach(([x, y]) => { t += (x - mx) * (y - my); da += (x - mx) ** 2; db += (y - my) ** 2 })
  const r = t / Math.sqrt(da * db || 1)

  const sel = selectedIdx != null ? pts.find((p) => p[2] === selectedIdx) : null

  return (
    <div className="msc">
      <div className="msc-axes mono">
        <label>X
          <select value={xi} onChange={(e) => setXi(+e.target.value)}>
            {options.map((o, i) => <option key={o.key} value={i}>{o.label}</option>)}
          </select>
        </label>
        <label>Y
          <select value={yi} onChange={(e) => setYi(+e.target.value)}>
            {options.map((o, i) => <option key={o.key} value={i}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="msc-svg rf-svg" ref={svgRef}>
        <rect x="0" y="0" width={W} height={H} rx="8" fill="rgba(255,255,255,0.6)" stroke="rgba(15,23,42,0.10)" />
        {pts.map((p) => (
          <circle key={p[2]} cx={sx(p[0])} cy={sy(p[1])} r="2.1"
            fill="#008AE0" opacity={sel && p[2] === sel[2] ? 0 : 0.4} />
        ))}
        {sel && <circle cx={sx(sel[0])} cy={sy(sel[1])} r="4.4" fill="#E8420C" stroke="#fff" strokeWidth="1.4" />}
      </svg>
      <div className="msc-foot mono">
        <span>n={n}</span><span>상관 r = {r.toFixed(3)}</span>
        {sel && <span className="msc-sel">● 선택 지역</span>}
        <span className="msc-dl"><DlMenu cls="e5r-dl" label="저장" wide up
          elRef={{ current: svgRef.current?.parentElement }}
          pack={() => ({
            base: 'SSI_산점도', title: '산점도',
            sub: `X ${X.label} · Y ${Y.label} · r=${r.toFixed(3)}`,
            cols: ['시도', '시군구', X.label, Y.label],
            rows: pts.map(([x, y, i]) => [ROWS[i].sido, ROWS[i].name,
              Math.round(x * 100) / 100, Math.round(y * 100) / 100]),
          })} /></span>
      </div>
    </div>
  )
}
