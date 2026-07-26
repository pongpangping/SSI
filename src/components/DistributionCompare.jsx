import { useMemo } from 'react'
import { METHODS, CAMP, ROWS, rowKey } from '../lib/ssi.js'
import { minmax, pctrank } from '../lib/standardize.js'

const BINS = 24

function hist(values, lo, hi) {
  const b = new Array(BINS).fill(0)
  const d = (hi - lo) || 1
  values.forEach((v) => { b[Math.min(BINS - 1, Math.max(0, Math.floor((v - lo) / d * BINS)))]++ })
  return b
}

// 지침서 6.4 예시: 한쪽에만 극단값이 있고 나머지는 촘촘한 분포
const DEMO = [10, 45, 88, 90, 91, 92, 93, 94, 96, 100]

export default function DistributionCompare({ sector, selectedRow, method }) {
  const cards = useMemo(() => METHODS.map((m) => {
    const v = ROWS.map((r) => r[sector].ci[m.key]).filter((x) => x != null)
    const lo = Math.min(...v), hi = Math.max(...v)
    const b = hist(v, lo, hi)
    const peak = Math.max(...b)
    const sv = selectedRow ? selectedRow[sector].ci[m.key] : null
    const selBin = sv == null ? null : Math.min(BINS - 1, Math.floor((sv - lo) / ((hi - lo) || 1) * BINS))
    return { m, b, peak, lo, hi, sv, selBin }
  }), [sector, selectedRow])

  const demoMM = minmax(DEMO)
  const demoPR = pctrank(DEMO)

  return (
    <div className="dist">
      <div className="card-sub">
        같은 원자료라도 표준화 방법에 따라 <b>CI 값의 분포 모양 자체</b>가 달라진다 →
        같은 색 범례를 써도 지도에 칠해지는 등급이 달라진다.
      </div>

      <div className="dist-grid">
        {cards.map(({ m, b, peak, lo, hi, sv, selBin }) => (
          <div key={m.key} className={`dist-card${m.key === method ? ' on' : ''}`}
            style={{ borderTopColor: CAMP[m.camp].color }}>
            <div className="dist-h">
              <b>{m.label}</b>
              <em>{lo.toFixed(1)} ~ {hi.toFixed(1)}</em>
            </div>
            <div className="dist-bars">
              {b.map((c, i) => (
                <i key={i} className={i === selBin ? 'sel' : ''}
                  style={{ height: `${Math.max(2, c / peak * 100)}%`, background: i === selBin ? '#0F172A' : CAMP[m.camp].color }} />
              ))}
            </div>
            <div className="dist-f">
              {sv != null && <>선택 지역 <b>{sv.toFixed(1)}</b></>}
            </div>
          </div>
        ))}
      </div>

      {/* 지침서 6.4 — 간격보존형 vs 순위전용형이 갈리는 이유 */}
      <div className="demo">
        <div className="demo-h">왜 갈리는가 · 10개 값 예시 (지침서 6.4)</div>
        <div className="demo-tbl">
          <div className="demo-r demo-hd"><span>원자료</span>{DEMO.map((v) => <b key={v}>{v}</b>)}</div>
          <div className="demo-r"><span style={{ color: CAMP['간격보존형'].color }}>Min-Max</span>
            {demoMM.map((v, i) => <b key={i}>{Math.round(v)}</b>)}</div>
          <div className="demo-r"><span style={{ color: CAMP['순위전용형'].color }}>백분위순위</span>
            {demoPR.map((v, i) => <b key={i}>{Math.round(v)}</b>)}</div>
        </div>
        <p className="demo-note">
          값 88은 Min-Max에서 {Math.round(demoMM[2])}점(최댓값 100에 가까움)이지만
          백분위순위에서는 {Math.round(demoPR[2])}점(아래에서 세 번째)이다.
          간격보존형은 “실제 값이 얼마나 큰가”를, 순위전용형은 “몇 등인가”를 본다.
          이 차이가 지표를 합칠 때 누적되어 CI 순위를 흔든다.
        </p>
      </div>
    </div>
  )
}
