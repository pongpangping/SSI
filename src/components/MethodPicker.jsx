import { METHODS, CAMP, methodOf, binChangeCount } from '../lib/ssi.js'
import { standardize } from '../lib/standardize.js'

// 설명 문장 대신 "같은 10개 값이 이 방식에서는 어디에 놓이는가"를 눈금으로 보여준다.
const DEMO = [12, 15, 88, 90, 91, 92, 93, 94, 96, 99]

function ScaleStrip({ mk, color }) {
  const v = standardize(DEMO, mk)
  const lo = Math.min(...v), hi = Math.max(...v), d = (hi - lo) || 1
  return (
    <div className="mp-strip" title="같은 원자료 10개가 이 방식에서 놓이는 위치">
      <span className="ms-track" />
      {v.map((x, i) => (
        <i key={i} style={{ left: `${((x - lo) / d) * 100}%`, background: color }} />
      ))}
    </div>
  )
}

export default function MethodPicker({ sector, method, onMethod }) {
  const m = methodOf(method)
  const campColor = CAMP[m.camp].color

  return (
    <div className="mp">
      <div className="mp-grid">
        {METHODS.map((x) => {
          const on = x.key === method
          const c = CAMP[x.camp].color
          return (
            <button key={x.key} className={`mp-btn${on ? ' on' : ''}`}
              style={on ? { borderColor: c, background: `${c}14` } : undefined}
              onClick={() => onMethod(x.key)} title={x.note}>
              <span className="mp-camp" style={{ background: c }}>{x.camp === '간격보존형' ? '간격' : '등수'}</span>
              <b>{x.label}</b>
              <ScaleStrip mk={x.key} color={c} />
            </button>
          )
        })}
      </div>

      <div className="mp-detail" style={{ borderLeftColor: campColor }}>
        <div className="mp-row"><span>계열</span>
          <b style={{ color: campColor }}>{m.camp === '간격보존형' ? '값 간격을 그대로' : '등수만'}</b></div>
        <div className="mp-row"><span>수식</span><code>{m.formula}</code></div>
        <div className="mp-row"><span>범위</span><b>{m.range}</b></div>
      </div>

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
