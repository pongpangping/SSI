import { METHODS, CAMP, methodOf, binChangeCount } from '../lib/ssi.js'

// ★ 이 대시보드의 핵심 조작부.
// 여기서 방법을 바꾸면 지도 색·순위·차트가 전부 다시 계산된다.
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
              onClick={() => onMethod(x.key)}>
              <span className="mp-camp" style={{ background: c }}>{x.camp === '간격보존형' ? '간격' : '순위'}</span>
              <b>{x.label}</b>
              <em>{x.short}</em>
            </button>
          )
        })}
      </div>

      <div className="mp-detail" style={{ borderLeftColor: campColor }}>
        <div className="mp-row"><span>진영</span><b style={{ color: campColor }}>{m.camp}</b></div>
        <div className="mp-row"><span>수식</span><code>{m.formula}</code></div>
        <div className="mp-row"><span>값 범위</span><b>{m.range}</b></div>
        <p className="mp-note">{m.note}</p>
      </div>

      <div className="mp-change">
        {METHODS.filter((x) => x.key !== method).map((x) => (
          <button key={x.key} className="mp-chg" onClick={() => onMethod(x.key)}>
            <span>{m.short} → {x.short}</span>
            <b>{binChangeCount(sector, method, x.key)}개</b>
            <em>시군구 색 등급 변경</em>
          </button>
        ))}
      </div>
    </div>
  )
}
