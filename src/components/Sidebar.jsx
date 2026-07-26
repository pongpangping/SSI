import { SECTORS, metricsFor, sectorSummary } from '../lib/ssi.js'
import MethodPicker from './MethodPicker.jsx'

const SECTOR_KEYS = ['S1', 'S8']

export default function Sidebar({
  sector, onSector, method, onMethod, metric, metricKey, onMetric,
  onlyHigh, onOnlyHigh, compare, onCompare,
}) {
  const metrics = metricsFor(sector, method)
  const s = sectorSummary(sector)
  const groups = metrics.reduce((a, m) => { (a[m.group] ||= []).push(m); return a }, {})

  return (
    <aside className="sidebar">
      {/* 부문 선택 */}
      <div className="sb-group">
        <div className="sb-group-head"><i className="sg-dot map" />부문 선택<em>진단 대상</em></div>
        <div className="seg-sector">
          {SECTOR_KEYS.map((k) => (
            <button key={k} className={sector === k ? 'active' : ''} onClick={() => onSector(k)}>
              <b>{k}</b><span>{SECTORS[k].name}</span>
            </button>
          ))}
        </div>
        <div className="sb-hint">
          지표 {SECTORS[sector].inds.length}개 · {SECTORS[sector].inds.map((i) => i.label).join(' · ')}
        </div>
      </div>

      {/* ★ 표준화 방법 */}
      <div className="sb-group">
        <div className="sb-group-head"><i className="sg-dot std" />표준화 방법<em>지도·차트가 바뀜</em></div>
        <MethodPicker sector={sector} method={method} onMethod={onMethod} />
      </div>

      {/* 두 진영 비교 지도 */}
      <div className="sb-group">
        <div className="sb-group-head"><i className="sg-dot panel" />비교 보기<em>A/B</em></div>
        <button className={`grid-toggle${compare ? ' on' : ''}`} onClick={() => onCompare(!compare)}>
          <span className="gt-txt">
            <b>간격보존형 ↔ 순위전용형 나란히</b>
            <em>같은 지표를 MinMax·PctRank 두 지도로 동시에 그려 차이를 눈으로 확인</em>
          </span>
          <span className="gt-sw"><i /></span>
        </button>
      </div>

      {/* 지도 지표 */}
      <div className="sb-group">
        <div className="sb-group-head"><i className="sg-dot metric" />지도에 그릴 값<em>색으로 표시</em></div>
        <div className="mlist">
          {Object.entries(groups).map(([g, items]) => (
            <div key={g} className="mgrp">
              <div className="mgrp-h">{g}</div>
              {items.map((m) => (
                <button key={m.key} className={`mitem${metricKey === m.key ? ' active' : ''}`}
                  onClick={() => onMetric(m.key)}>
                  <span className="mi-name">{m.label}{m.dynamic && <i className="mi-dyn" title="표준화 방법에 따라 값이 바뀜">◆</i>}</span>
                  {metricKey === m.key && <span className="mi-desc">{m.desc}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="sb-legend">
          <span>{metric.scale === 'rank' ? '하위' : metric.scale === 'div' ? '상승' : '낮음'}</span>
          <div className={`lg-bar ${metric.scale}`} />
          <span>{metric.scale === 'rank' ? '상위' : metric.scale === 'div' ? '하락' : '높음'}</span>
        </div>
        <div className="sb-hint">◆ 표시는 표준화 방법을 바꾸면 지도가 바뀌는 항목입니다.</div>
      </div>

      {/* 민감 지역 필터 */}
      <div className="sb-group">
        <div className="sb-group-head"><i className="sg-dot warn" />민감 지역<em>경고 대상</em></div>
        <button className={`grid-toggle${onlyHigh ? ' on' : ''}`} onClick={() => onOnlyHigh(!onlyHigh)}>
          <span className="gt-txt">
            <b>민감(high) 지역만</b>
            <em>SSI_camp 부문 상위 20% — 방법 선택에 순위가 크게 흔들림</em>
          </span>
          <span className="gt-sw"><i /></span>
        </button>
      </div>

      <div className="sb-summary">
        <div><span>시군구</span><b>{s.n}개</b></div>
        <div><span>SSI 평균</span><b>{s.avg.toFixed(1)}</b></div>
        <div><span>10계단↑</span><b>{s.over10}개</b></div>
        <div><span>민감(high)</span><b>{s.high}개</b></div>
      </div>
    </aside>
  )
}
