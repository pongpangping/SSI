import { METHODS, CAMP, CAMP_NAMES, methodOf, binChangeCount } from '../lib/ssi.js'
import { standardize } from '../lib/standardize.js'

// 표준화 방법 선택 — 네 방법은 '단계'가 아니라 '갈래'다.
// 그래서 축·슬라이더 대신, 계열(간격보존형 / 순위전용형)로 묶은 라디오 목록으로 둔다.
// 위에서 아래로 순서가 있는 것처럼 보이지 않아야 지표 선택과 헷갈리지 않는다.
const CAMPS = CAMP_NAMES
const CAMP_NOTE = { 간격보존형: '값 간격 유지', 순위전용형: '등수만 사용' }
// 한 줄 요약 — 목록에서 바로 고를 수 있게 방법마다 성격을 한 문장으로.
// 목록에 없는 방법(예: 나중에 들어올 LQ)은 데이터의 note를 그대로 쓴다.
const ONELINE = {
  minmax: '가장 낮은 곳 0점, 가장 높은 곳 100점',
  distance: '전국 평균이 100점',
  logistic: '평균 근처를 넓게, 양극단을 좁게',
  pctrank: '등수를 그대로 0~100점으로',
  lq: '전국 평균 대비 특화 정도(=1이 평균)',
}
const DEMO = [12, 15, 88, 90, 91, 92, 93, 94, 96, 99]

function ScaleStrip({ mk, color }) {
  const v = standardize(DEMO, mk)
  const lo = Math.min(...v), hi = Math.max(...v), d = (hi - lo) || 1
  return (
    <div className="mp-strip" title="같은 원자료 10개가 이 방법에서 놓이는 위치">
      <span className="ms-track" />
      {v.map((x, i) => <i key={i} style={{ left: `${((x - lo) / d) * 100}%`, background: color }} />)}
    </div>
  )
}

export default function MethodPicker({ sector, method, onMethod }) {
  const m = methodOf(method)
  const c = CAMP[m.camp].color

  return (
    <div className="mp2">
      {/* ── 계열별 라디오 목록 ───────────────────────────── */}
      <div className="mgrp">
        {CAMPS.filter((c) => CAMP[c].methods.length).map((camp) => (
          <div key={camp} className="mg" style={{ '--c': CAMP[camp].color }}>
            <div className="mg-h">
              <span className="mg-dotc" />
              <b>{camp}</b>
              <em>{CAMP_NOTE[camp]}</em>
            </div>
            {CAMP[camp].methods.map((k) => {
              const x = methodOf(k)
              const on = k === method
              return (
                <button key={k} className={`mg-op${on ? ' on' : ''}`} onClick={() => onMethod(k)}
                  role="radio" aria-checked={on} title={x.note} data-mk={k}>
                  <span className="mg-rd" />
                  <span className="mg-tx"><b>{x.label}</b><em>{ONELINE[k] || x.note}</em></span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── 고른 방법의 성질 ─────────────────────────────── */}
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

      {/* ── 다른 방법으로 바꿨을 때 지도가 얼마나 달라지나 ── */}
      <div className="mp-change">
        <div className="mp-chg-cap">
          지금 <b>{m.label}</b>에서 다른 방법으로 바꾸면
          <br />지도 색 구간이 달라지는 시군구 수
        </div>
        {METHODS.filter((x) => x.key !== method).map((x) => (
          <button key={x.key} className="mp-chg" onClick={() => onMethod(x.key)}
            title={`${m.label} 대신 ${x.label}을 쓰면 지도 색 구간이 달라지는 시군구 수`}>
            <span className="mc-nm">{m.label} <i>→</i> {x.label}</span>
            <b>{binChangeCount(sector, method, x.key)}</b>
            <em>곳</em>
          </button>
        ))}
      </div>
    </div>
  )
}
