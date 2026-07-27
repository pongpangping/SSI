import { useState } from 'react'
import { SECTORS, metricsFor, sectorSummary } from '../lib/ssi.js'
import MethodPicker from './MethodPicker.jsx'
import RegionPicker from './RegionPicker.jsx'

const SECTOR_KEYS = ['S1', 'S8']
const SECTOR_ICON = { S1: '◫', S8: '✚' }

// 조작부 = 제품의 조작 패널. 접히지 않고 늘 열려 있다.
// 위쪽 [지표 선택]은 부문 아코디언 안에 지도 색 기준을 담고,
// 아래쪽 [조건 선택]은 행정구역 범위와 표준화 방법을 늘 보이게 둔다.
// 맨 아래는 이 화면에서 가장 중요한 행동 하나(두 방식 나란히 비교).
export default function Sidebar({
  sector, onSector, method, onMethod, metric, metricKey, onMetric,
  onlyHigh, onOnlyHigh, compare, onCompare,
  sido, onSido, selected, onSelect,
}) {
  const [openSect, setOpenSect] = useState(sector)
  const s = sectorSummary(sector)

  const pick = (k) => { onSector(k); setOpenSect(k) }

  return (
    <aside className="sidebar sb2">
      <div className="sb2-scroll">
        {/* ── 1. 지표 선택 — 부문 아코디언 + 그 안의 지도 색 기준 ── */}
        <div className="sb2-cap"><b>1</b>지표 선택<em>부문 · 지도 색 기준</em></div>
        <div className="acc2">
          {SECTOR_KEYS.map((k) => {
            const on = openSect === k
            const items = metricsFor(k, method)
            const groups = items.reduce((a, m) => { (a[m.group] ||= []).push(m); return a }, {})
            return (
              <div key={k} className={`acc2-card${on ? ' open' : ''}${sector === k ? ' cur' : ''}`}>
                <button className="acc2-head" onClick={() => pick(on && sector === k ? k : k)}
                  aria-expanded={on}>
                  <span className="acc2-ic">{SECTOR_ICON[k]}</span>
                  <span className="acc2-t"><b>{SECTORS[k].name}</b><em>{k}</em></span>
                  <span className="acc2-sign">{on ? '−' : '+'}</span>
                </button>
                {on && (
                  <div className="acc2-body">
                    <div className="acc2-chips">
                      {SECTORS[k].inds.map((i) => <span key={i.label}>{i.label}</span>)}
                    </div>
                    {Object.entries(groups).map(([g, list]) => (
                      <div key={g} className="acc2-grp">
                        <div className="acc2-grp-h">{g}</div>
                        {list.map((m) => (
                          <button key={m.key}
                            className={`acc2-item${sector === k && metricKey === m.key ? ' on' : ''}`}
                            onClick={() => { onSector(k); onMetric(m.key) }} title={m.desc}>
                            {m.label}
                            {m.dynamic && <i title="표준화 방법을 바꾸면 지도가 바뀜">◆</i>}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── 2. 조건 선택 — 늘 보이는 조작 줄 ── */}
        <div className="sb2-cap"><b>2</b>조건 선택<em>지역 범위 · 표준화 방법</em></div>
        <div className="sb2-block">
          <RegionPicker sido={sido} onSido={onSido} selected={selected} onSelect={onSelect} />
          <div className="sb2-sub">표준화 방법</div>
          <MethodPicker sector={sector} method={method} onMethod={onMethod} />
          <div className="sb2-legend">
            <span>{metric.scale === 'rank' ? '하위' : metric.scale === 'div' ? '상승' : '낮음'}</span>
            <div className={`lg-bar ${metric.scale}`} />
            <span>{metric.scale === 'rank' ? '상위' : metric.scale === 'div' ? '하락' : '높음'}</span>
          </div>
          {/* '민감 지역만' 스위치는 지도 오른쪽 아래에 하나만 둔다.
              효과가 보이는 자리에 조작을 놓아 조작–결과 거리를 없앤다. */}
          <div className="sb2-tip">
            민감 지역만 보기 스위치는 <b>지도 오른쪽 아래</b>에 있습니다
            {onlyHigh && <em> · 지금 켜짐</em>}
          </div>
        </div>
      </div>

      {/* ── 고정 발판: 현황 요약 + 이 화면의 주 행동 하나 ── */}
      <div className="sb2-foot">
        <div className="sb2-stat">
          <div><span>시군구</span><b>{s.n}</b></div>
          <div><span>평균 이동</span><b>{s.avg.toFixed(1)}</b></div>
          <div><span>10계단↑</span><b>{s.over10}</b></div>
          <div><span>민감</span><b>{s.high}</b></div>
        </div>
        <button className={`sb2-cta${compare ? ' on' : ''}`} onClick={() => onCompare(!compare)}>
          {compare ? '비교 끝내고 한 지도로' : '두 방식 나란히 비교하기'}
        </button>
      </div>
    </aside>
  )
}
