import { useState } from 'react'
import { SECTORS, metricsFor, sectorSummary } from '../lib/ssi.js'
import MethodPicker from './MethodPicker.jsx'
import RegionPicker from './RegionPicker.jsx'
import PickedSummary from './PickedSummary.jsx'

// 조작부 = 제품의 조작 패널. 접히지 않고 늘 열려 있다.
//
// 예전에는 1번 칸이 부문 아코디언이었다. 부문마다 지표 이름과 색 기준을 모두
// 펼쳐 놓다 보니 부문이 열 개가 된 지금은 조작부가 아니라 목록이 되어 버린다.
// 그래서 셋으로 나눴다.
//   1 지표 고르기 — 부문을 고르고, 담은 조합을 요약하고, 자세한 선택은 창으로 넘긴다
//   2 지도 색 기준 — 지금 부문의 것만 평평하게 편다 (다른 부문 것을 볼 이유가 없다)
//   3 조건 선택   — 지역 범위와 표준화 방법
export default function Sidebar({
  sector, onSector, method, onMethod, metric, metricKey, onMetric,
  onlyHigh, compare, onCompare,
  sido, onSido, selected, onSelect,
  picksBy, onOpenPicker,
}) {
  // 묶음(표준화 결과 / 민감도 / 원자료 지표 …)은 각각 접힌다.
  // 기록이 없으면 '지금 보고 있는 지표가 들어 있는 묶음'만 펼친 상태로 둔다.
  const [openGrp, setOpenGrp] = useState({})
  const s = sectorSummary(sector)

  const items = metricsFor(sector, method)
  const groups = items.reduce((a, m) => { (a[m.group] ||= []).push(m); return a }, {})

  const grpOpen = (id, hasCur) => (openGrp[id] === undefined ? hasCur : openGrp[id])
  const toggleGrp = (id, hasCur) => setOpenGrp((o) => ({ ...o, [id]: !grpOpen(id, hasCur) }))

  return (
    <aside className="sidebar sb2">
      <div className="sb2-scroll">
        {/* ── 1. 지표 고르기 ── */}
        <div className="sb2-cap"><b>1</b>지표 고르기<em>부문 · 담은 조합</em></div>
        <PickedSummary sector={sector} onSector={onSector} picksBy={picksBy} onOpen={onOpenPicker} />

        {/* ── 2. 지도 색 기준 — 지금 부문의 것만 ── */}
        <div className="sb2-cap"><b>2</b>지도 색 기준<em>{SECTORS[sector].name}</em></div>
        <div className="sb2-block sb2-metrics">
          {items.length === 0 && <div className="sb2-tip">담은 지표가 없어 그릴 값이 없습니다.</div>}
          {Object.entries(groups).map(([g, list]) => {
            const id = `${sector}|${g}`
            const hasCur = list.some((m) => m.key === metricKey)
            const gon = grpOpen(id, hasCur)
            return (
              <div key={g} className={`acc2-grp gbox${gon ? ' open' : ''}${hasCur ? ' cur' : ''}`}>
                <button className="acc2-grp-h" onClick={() => toggleGrp(id, hasCur)}
                  aria-expanded={gon} data-grp={g}>
                  <span className="gb-t">{g}</span>
                  <span className="gb-n">{list.length}</span>
                  <span className="gb-sign">{gon ? '−' : '+'}</span>
                </button>
                {gon && (
                  <div className="gb-body">
                    {list.map((m) => (
                      <button key={m.key}
                        className={`acc2-item${metricKey === m.key ? ' on' : ''}`}
                        onClick={() => onMetric(m.key)} title={m.desc}>
                        {m.label}
                        {m.dynamic && <i title="표준화 방법을 바꾸면 지도가 바뀜">◆</i>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── 3. 조건 선택 — 늘 보이는 조작 줄 ── */}
        <div className="sb2-cap"><b>3</b>조건 선택<em>지역 범위 · 표준화 방법</em></div>
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
