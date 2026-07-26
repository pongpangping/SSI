import { SECTORS, metricsFor, sectorSummary } from '../lib/ssi.js'
import MethodPicker from './MethodPicker.jsx'
import RegionPicker from './RegionPicker.jsx'

const SECTOR_KEYS = ['S1', 'S8']

function Step({ n, title, plain, children }) {
  return (
    <div className="sb-step">
      <div className="sb-step-head">
        <span className="sb-step-n">{n}</span>
        <span className="sb-step-t">{title}<em>{plain}</em></span>
      </div>
      <div className="sb-step-body">{children}</div>
    </div>
  )
}

export default function Sidebar({
  sector, onSector, method, onMethod, metric, metricKey, onMetric,
  onlyHigh, onOnlyHigh, compare, onCompare,
  sido, onSido, selected, onSelect,
}) {
  const metrics = metricsFor(sector, method)
  const s = sectorSummary(sector)
  const groups = metrics.reduce((a, m) => { (a[m.group] ||= []).push(m); return a }, {})

  return (
    <aside className="sidebar">
      <Step n="1" title="어디를 볼까" plain="행정구역">
        <RegionPicker sido={sido} onSido={onSido} selected={selected} onSelect={onSelect} />
      </Step>

      <Step n="2" title="무엇을 진단할까" plain="부문">
        <div className="seg-sector">
          {SECTOR_KEYS.map((k) => (
            <button key={k} className={sector === k ? 'active' : ''} onClick={() => onSector(k)}>
              <b>{k}</b><span>{SECTORS[k].name}</span>
            </button>
          ))}
        </div>
        <div className="chip-row">
          {SECTORS[sector].inds.map((i) => <span key={i.label} className="chip">{i.label}</span>)}
        </div>
      </Step>

      <Step n="3" title="점수를 어떻게 매길까" plain="표준화 방법">
        <MethodPicker sector={sector} method={method} onMethod={onMethod} />
      </Step>

      <Step n="4" title="지도를 무엇으로 칠할까" plain="지도 색 기준">
        <div className="mlist">
          {Object.entries(groups).map(([g, items]) => (
            <div key={g} className="mgrp">
              <div className="mgrp-h">{g}</div>
              {items.map((m) => (
                <button key={m.key} className={`mitem${metricKey === m.key ? ' active' : ''}`}
                  onClick={() => onMetric(m.key)} title={m.desc}>
                  <span className="mi-name">{m.label}{m.dynamic && <i className="mi-dyn" title="점수 매기는 방식을 바꾸면 지도가 바뀜">◆</i>}</span>
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
      </Step>

      <Step n="5" title="어떻게 보여줄까" plain="보기 옵션">
        <button className={`grid-toggle${compare ? ' on' : ''}`} onClick={() => onCompare(!compare)}>
          <span className="gt-txt"><b>두 방식 지도 나란히</b><em>Min-Max ↔ 백분위순위</em></span>
          <span className="gt-sw"><i /></span>
        </button>
        <button className={`grid-toggle${onlyHigh ? ' on' : ''}`} onClick={() => onOnlyHigh(!onlyHigh)}>
          <span className="gt-txt"><b>민감 지역만</b><em>순위가 크게 흔들리는 상위 20%</em></span>
          <span className="gt-sw"><i /></span>
        </button>
      </Step>

      <div className="sb-summary">
        <div><span>시군구</span><b>{s.n}</b></div>
        <div><span>평균 이동</span><b>{s.avg.toFixed(1)}계단</b></div>
        <div><span>10계단↑</span><b>{s.over10}</b></div>
        <div><span>민감</span><b>{s.high}</b></div>
      </div>
    </aside>
  )
}
