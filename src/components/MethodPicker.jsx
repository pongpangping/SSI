import { METHODS, CAMP, methodOf, binChangeCount } from '../lib/ssi.js'
import { standardize } from '../lib/standardize.js'

// 표준화 방법 선택 — 네 방식을 "간격을 그대로 → 등수만" 축 위에 눈금으로 놓고
// 손잡이를 옮기며 훑는다. 조작이 하나(슬라이더)로 줄어 지도 변화를 연속으로 본다.
// 축 순서: 값 간격을 가장 그대로 두는 쪽(Min-Max) → 간격을 가장 많이 접는 쪽(백분위순위)
const AXIS = ['minmax', 'distance', 'logistic', 'pctrank']
const DEMO = [12, 15, 88, 90, 91, 92, 93, 94, 96, 99]

function ScaleStrip({ mk, color }) {
  const v = standardize(DEMO, mk)
  const lo = Math.min(...v), hi = Math.max(...v), d = (hi - lo) || 1
  return (
    <div className="mp-strip" title="같은 원자료 10개가 이 방식에서 놓이는 위치">
      <span className="ms-track" />
      {v.map((x, i) => <i key={i} style={{ left: `${((x - lo) / d) * 100}%`, background: color }} />)}
    </div>
  )
}

export default function MethodPicker({ sector, method, onMethod }) {
  const m = methodOf(method)
  const c = CAMP[m.camp].color
  const idx = Math.max(0, AXIS.indexOf(method))

  return (
    <div className="mp2">
      {/* ── 방식 축 슬라이더 ─────────────────────────────── */}
      <div className="ms2" style={{ '--c': c }}>
        <div className="ms2-rail">
          <span className="ms2-fill" style={{ width: `${(idx / (AXIS.length - 1)) * 100}%` }} />
          {AXIS.map((k, i) => {
            const on = k === method
            return (
              <button key={k} className={`ms2-dot${on ? ' on' : ''}`}
                style={{ left: `${(i / (AXIS.length - 1)) * 100}%` }}
                onClick={() => onMethod(k)} title={methodOf(k).note}
                aria-label={methodOf(k).label} />
            )
          })}
        </div>
        <input className="ms2-input" type="range" min="0" max={AXIS.length - 1} step="1"
          value={idx} onChange={(e) => onMethod(AXIS[+e.target.value])}
          aria-label="표준화 방법" />
        <div className="ms2-ticks">
          {AXIS.map((k) => (
            <button key={k} className={`ms2-tick${k === method ? ' on' : ''}`}
              onClick={() => onMethod(k)}>{methodOf(k).label}</button>
          ))}
        </div>
        <div className="ms2-ends"><span>값 간격 그대로</span><span>등수만</span></div>
      </div>

      {/* ── 고른 방식의 성질 ─────────────────────────────── */}
      <div className="mp2-detail" style={{ borderLeftColor: c }}>
        <div className="mp2-top">
          <span className="mp2-camp" style={{ background: c }}>
            {m.camp === '간격보존형' ? '간격' : '등수'}
          </span>
          <b>{m.label}</b>
          <ScaleStrip mk={m.key} color={c} />
        </div>
        <div className="mp-row"><span>수식</span><code>{m.formula}</code></div>
        <div className="mp-row"><span>범위</span><b>{m.range}</b></div>
      </div>

      {/* ── 다른 방식으로 옮겼을 때 지도가 얼마나 달라지나 ── */}
      <div className="mp-change">
        {METHODS.filter((x) => x.key !== method).map((x) => (
          <button key={x.key} className="mp-chg" onClick={() => onMethod(x.key)}
            title={`${m.label} → ${x.label} 로 바꾸면 지도 색 등급이 달라지는 시군구 수`}>
            <span>{m.short} → {x.short}</span>
            <b>{binChangeCount(sector, method, x.key)}</b>
            <em>곳 색 바뀜</em>
          </button>
        ))}
      </div>
    </div>
  )
}
