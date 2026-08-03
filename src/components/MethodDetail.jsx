import { METHODS, CAMP, methodOf, binChangeCount } from '../lib/ssi.js'
import { standardize } from '../lib/standardize.js'

// 표준화 방법 해설.
//
// 원래는 조작부(사이드바)의 방법 선택 칸 안에 수식·범위·눈금띠가 같이 붙어
// 있었다. 고르는 자리와 읽는 자리가 겹치니 무엇을 고른 상태인지가 눈에 안 들어온다.
// 그래서 조작부에는 라디오 목록만 남기고, 설명은 통계창 [표준화 민감도] 칸으로 옮겼다.

const DEMO = [12, 15, 88, 90, 91, 92, 93, 94, 96, 99]

function ScaleStrip({ mk, color }) {
  const v = standardize(DEMO, mk)
  const lo = Math.min(...v), hi = Math.max(...v), d = (hi - lo) || 1
  return (
    <div className="mp-strip" title="같은 원자료 10개가 이 방법에서 놓이는 자리">
      <span className="ms-track" />
      {/* 표식은 ms-marks 안에 담는다. 표식 자리는 % 로 잡는데, 그 % 가 띠 전체를
          기준으로 잡히면 100% 에 놓인 마지막 표식이 절반쯤 띠 밖으로 나간다. */}
      <span className="ms-marks">
        {v.map((x, i) => <i key={i} style={{ left: `${((x - lo) / d) * 100}%`, background: color }} />)}
      </span>
    </div>
  )
}

export default function MethodDetail({ sector, method, onMethod }) {
  const m = methodOf(method)
  const c = CAMP[m.camp].color

  return (
    <div className="mdet">
      <div className="mp2-detail" style={{ borderLeftColor: c }}>
        <div className="mp2-top">
          <span className="mp2-camp" style={{ background: c }}>
            {m.camp === '간격보존형' ? '간격' : '등수'}
          </span>
          <b>{m.label}</b>
          <ScaleStrip mk={m.key} color={c} />
        </div>
        <div className="mp-row"><span>정의</span><b>{m.note}</b></div>
        <div className="mp-row"><span>수식</span><code>{m.formula}</code></div>
        <div className="mp-row"><span>범위</span><b>{m.range}</b></div>
        <div className="mp-row">
          <span>눈금띠</span>
          <b>같은 원자료 10개를 이 방법으로 옮겼을 때의 자리. 값이 몰린 구간이 얼마나
            벌어지고 좁아지는지를 본다.</b>
        </div>
      </div>

      <div className="mp-change">
        <div className="mp-chg-cap">
          지금 <b>{m.label}</b>에서 다른 방법으로 바꾸면
          지도 색 구간(7단계)이 달라지는 시군구 수. 누르면 그 방법으로 바뀐다.
        </div>
        {METHODS.filter((x) => x.key !== method).map((x) => (
          <button key={x.key} className="mp-chg" onClick={() => onMethod?.(x.key)}
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
