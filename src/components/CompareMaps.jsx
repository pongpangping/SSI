import { useCallback, useRef } from 'react'
import NationalMap from './NationalMap.jsx'
import { metricFor, methodOf, binChangeCount, ROWS, shortSido } from '../lib/ssi.js'

// 같은 지표를 간격보존형(MinMax) · 순위전용형(PctRank) 두 지도로 동시에 그린다.
// 두 지도의 시점(pan/zoom)은 동기화되고, 확대·축소는 아래 공용 도구막대 하나로 조작한다.
export default function CompareMaps({ sector, metricKey, onlyHigh, selected, hovered, onSelect, onHover, sido = null }) {
  const maps = useRef([])
  const lock = useRef(false)
  const api = useRef(null) // 왼쪽 지도의 조작 함수 묶음 (오른쪽은 동기화로 따라온다)

  const register = useCallback((m) => {
    if (!m || maps.current.includes(m)) return
    maps.current.push(m)
    m.on('move zoom', () => {
      if (lock.current) return
      lock.current = true
      maps.current.forEach((o) => { if (o !== m) o.setView(m.getCenter(), m.getZoom(), { animate: false }) })
      lock.current = false
    })
  }, [])

  const tools = useCallback((ref) => { if (!api.current) api.current = ref }, [])
  const run = (fn, ...a) => { const t = api.current?.current; if (t && t[fn]) t[fn](...a) }

  const left = metricFor(sector, 'minmax', metricKey)
  const right = metricFor(sector, 'pctrank', metricKey)
  const changed = binChangeCount(sector, 'minmax', 'pctrank')
  const big = ROWS.filter((r) => r[sector].ssiCamp >= 10).length

  return (
    <div className="abm-wrap">
      <div className="abm-bar">
        <span className="abm-tag" style={{ background: '#0B93EE' }}>간격보존형 · Min-Max</span>
        <span className="abm-mid" title="같은 원자료 · 같은 지표 · 표준화 방법만 다르다. 두 지도의 확대·이동은 연동된다">
          <em>색 바뀜</em><b>{changed}곳</b>
          <em>10계단↑ 이동</em><b>{big}곳</b>
        </span>
        <span className="abm-tag" style={{ background: '#F5760D' }}>순위전용형 · 백분위순위</span>
      </div>
      <div className="abm-maps">
        <NationalMap sector={sector} metric={left} onlyHigh={onlyHigh} sido={sido}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact title={methodOf('minmax').label} subtitle={left.label}
          onMapReady={register} onToolsReady={tools} />
        <NationalMap sector={sector} metric={right} onlyHigh={onlyHigh} sido={sido}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact title={methodOf('pctrank').label} subtitle={right.label}
          onMapReady={register} autoFit={false} />

        {/* 두 지도를 함께 조작하는 공용 도구막대 */}
        <div className="map-tools abm-tools" title="두 지도가 함께 움직입니다">
          <button onClick={() => run('zoomOut')} className="mt-z" title="축소">−</button>
          <button onClick={() => run('zoomIn')} className="mt-z" title="확대">＋</button>
          <i className="mt-sep" />
          <button onClick={() => run('fitAll')} title="전국이 한 화면에 들어오도록">전국</button>
          <button onClick={() => sido && run('fitSido', sido)} disabled={!sido}
            title="선택한 시·도로 이동">{sido ? shortSido(sido) : '시·도'}</button>
          <button onClick={() => run('fitSel')} disabled={!selected} title="선택한 시군구를 확대">선택 지역</button>
        </div>
      </div>
    </div>
  )
}
