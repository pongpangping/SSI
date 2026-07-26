import { useState } from 'react'
import { METRICS, metricBy } from '../lib/metrics.js'
import { pct, downloadCsv } from '../lib/format.js'
import { COMPOSITE_INDICATORS } from '../lib/stats.js'

export default function Sidebar({
  rows, summary, metricKey, onMetric, avgFilter, onAvgFilter, avgValue, selected, onSelect,
  showGrid, onToggleGrid, weights, onWeights,
}) {
  const metric = metricBy(metricKey)
  const vals = rows.map((r) => r[metricKey]).filter((x) => x != null)
  const min = Math.min(...vals), max = Math.max(...vals)
  const ordered = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const nAbove = rows.filter((r) => r[metricKey] >= avgValue).length

  // 아코디언 상태: 전체 패널 열림/닫힘 + 펼쳐진 지표(하나만)
  const [panelOpen, setPanelOpen] = useState(true)
  const [openKey, setOpenKey] = useState(metricKey)

  const clickMetric = (k) => {
    if (openKey === k) { setOpenKey(null); return }   // 이미 열린 항목 다시 누르면 접힘
    onMetric(k); setOpenKey(k)                         // 선택 + 해당 항목만 펼침(나머지 접힘)
  }

  return (
    <aside className="sidebar">
      {/* ── 그룹 1 : 지도에 반영 (색 · 강조 · 격자) ── */}
      <div className="sb-group">
        <div className="sb-group-head"><i className="sg-dot map" />지도에 반영<em>색 · 강조 · 격자</em></div>

        {/* 지도 지표 — 아코디언 (선택 항목만 펼침 / 다시 누르면 접힘) */}
        <div className="acc">
          <button className="acc-head" onClick={() => setPanelOpen((o) => !o)}>
            <span className="acc-ic">◧</span><span className="acc-title">지도 지표 (색)</span>
            <span className="acc-minus">{panelOpen ? '–' : '+'}</span>
          </button>
          {panelOpen && (
            <div className="acc-body">
              {METRICS.map((m) => {
                const isOpen = openKey === m.key
                const isActive = metricKey === m.key
                return (
                  <div key={m.key} className={`acc-item${isActive ? ' active' : ''}${isOpen ? ' open' : ''}`}>
                    <button className="ai-head" onClick={() => clickMetric(m.key)}>
                      <span className="ai-name">{m.label}</span>
                      <span className="ai-chev">{isOpen ? '▾' : '▸'}</span>
                    </button>
                    {isOpen && (
                      <div className="ai-detail">
                        <div className="ai-desc">{m.desc}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 집중지수 가중치 — 지표 선택 박스와 분리해 아래 별도 패널로 */}
        {metricKey === 'composite' && (
          <div className="wpanel">
            <div className="wpanel-h"><span className="wpanel-t">집중지수 가중치</span></div>
            {COMPOSITE_INDICATORS.map((ind) => (
              <div className="wrow" key={ind.key}>
                <div className="wrow-top">
                  <span>{ind.label}{ind.invert ? ' (작을수록↑)' : ''}</span>
                  <b>{weights[ind.key]}</b>
                </div>
                <input type="range" min="0" max="3" step="1" value={weights[ind.key]}
                  onChange={(e) => onWeights({ ...weights, [ind.key]: Number(e.target.value) })} />
              </div>
            ))}
            <div className="wpanel-note">높을수록 1인·고령·소규모 가구 집중. 정규화(min-max) 후 가중 평균 → 0~100점.</div>
          </div>
        )}

        <div className="sb-legend">
          <span>{metric.fmt(min)}</span>
          <div className="lg-bar" />
          <span>{metric.fmt(max)}</span>
        </div>

        {/* 인천 평균 대비 강조 */}
        <div className="dd-sublabel">인천 평균 대비 강조 · {metric.fmt(avgValue)}</div>
        <div className="seg-toggle">
          <button className={!avgFilter ? 'active' : ''} onClick={() => onAvgFilter(null)}>전체</button>
          <button className={avgFilter === 'above' ? 'active' : ''}
            onClick={() => onAvgFilter(avgFilter === 'above' ? null : 'above')}>
            평균 이상<em>{nAbove}</em></button>
          <button className={avgFilter === 'below' ? 'active' : ''}
            onClick={() => onAvgFilter(avgFilter === 'below' ? null : 'below')}>
            평균 미만<em>{rows.length - nAbove}</em></button>
        </div>

        {/* 격자 밀집도 토글 */}
        <button className={`grid-toggle${showGrid ? ' on' : ''}`}
          onClick={() => onToggleGrid(!showGrid)}>
          <span className="gt-txt">
            <b>격자 밀집도</b>
            <em>구 확대 시 SGIS 1km 격자로 1인가구 밀도 표시</em>
          </span>
          <span className="gt-sw"><i /></span>
        </button>
      </div>

      {/* ── 그룹 2 : 표·상세에 반영 (선택 지역) ── */}
      <div className="sb-group">
        <div className="sb-group-head"><i className="sg-dot panel" />표·상세에 반영<em>선택 지역</em></div>
        <label className="dropdown">
          <span className="dd-label">시군구 선택</span>
          <span className="dd-value">{rows.find((r) => r.code === selected)?.name ?? '선택'}
            <span className="dd-caret">⌄</span></span>
          <select value={selected} onChange={(e) => onSelect(e.target.value)}>
            {ordered.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </label>
        <div className="sb-hint">고른 지역이 오른쪽 상세·순위·차트에 반영됩니다. 지도를 직접 클릭하면 그 지역으로 확대돼요.</div>
        <button className="csv-btn" onClick={() => downloadCsv(rows)}>⤓ 표 내보내기 (CSV)</button>
      </div>

      <div className="sb-summary">
        <div><span>1인가구</span><b>{pct(summary.onePersonRate)}</b></div>
        <div><span>세대당</span><b>{summary.avgHouseholdSize}명</b></div>
        <div><span>고령1인</span><b>{pct(summary.agedOneShareOfOne)}</b></div>
      </div>
    </aside>
  )
}
