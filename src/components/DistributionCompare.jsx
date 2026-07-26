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
        <div className="demo-h">값 10개 예시 <em>지침서 6.4</em></div>
        <div className="demo-tbl">
          <div className="demo-r demo-hd"><span>원자료</span>
            {DEMO.map((v, i) => <b key={v} className={i === 2 ? 'pick' : ''}>{v}</b>)}</div>
          <div className="demo-r"><span style={{ color: CAMP['간격보존형'].color }}>Min-Max</span>
            {demoMM.map((v, i) => <b key={i} className={i === 2 ? 'pick' : ''}>{Math.round(v)}</b>)}</div>
          <div className="demo-r"><span style={{ color: CAMP['순위전용형'].color }}>백분위순위</span>
            {demoPR.map((v, i) => <b key={i} className={i === 2 ? 'pick' : ''}>{Math.round(v)}</b>)}</div>
        </div>
        <div className="demo-pick" title="간격보존형은 값의 크기를, 순위전용형은 등수를 본다">
          <span className="dp-raw">88</span>
          <span className="dp-arw">→</span>
          <span className="dp-v" style={{ borderColor: CAMP['간격보존형'].color }}>
            값 크기<b style={{ color: CAMP['간격보존형'].color }}>{Math.round(demoMM[2])}점</b></span>
          <span className="dp-v" style={{ borderColor: CAMP['순위전용형'].color }}>
            등수<b style={{ color: CAMP['순위전용형'].color }}>{Math.round(demoPR[2])}점</b></span>
        </div>
      </div>
    </div>
  )
}
