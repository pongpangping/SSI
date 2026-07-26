import { useCallback, useRef } from 'react'
import NationalMap from './NationalMap.jsx'
import { metricFor, methodOf, binChangeCount, ROWS } from '../lib/ssi.js'

// 같은 지표를 간격보존형(MinMax) · 순위전용형(PctRank) 두 지도로 동시에 그린다.
// 두 지도의 시점(pan/zoom)은 동기화된다.
export default function CompareMaps({ sector, metricKey, onlyHigh, selected, hovered, onSelect, onHover }) {
  const maps = useRef([])
  const lock = useRef(false)

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

  const left = metricFor(sector, 'minmax', metricKey)
  const right = metricFor(sector, 'pctrank', metricKey)
  const changed = binChangeCount(sector, 'minmax', 'pctrank')
  const big = ROWS.filter((r) => r[sector].ssiCamp >= 10).length

  return (
    <div className="abm-wrap">
      <div className="abm-bar">
        <span className="abm-tag" style={{ background: '#0B93EE' }}>간격보존형 · Min-Max</span>
        <span className="abm-mid">
          같은 원자료 · 같은 지표 · 표준화 방법만 다름 —
          색 등급이 달라진 시군구 <b>{changed}개</b> · 순위 10계단 이상 이동 <b>{big}개</b>
        </span>
        <span className="abm-tag" style={{ background: '#F5760D' }}>순위전용형 · 백분위순위</span>
      </div>
      <div className="abm-maps">
        <NationalMap sector={sector} metric={left} onlyHigh={onlyHigh}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact title={methodOf('minmax').label} subtitle={left.label} onMapReady={register} />
        <NationalMap sector={sector} metric={right} onlyHigh={onlyHigh}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact title={methodOf('pctrank').label} subtitle={right.label} onMapReady={register} />
      </div>
      <div className="abm-note">
        두 지도의 확대·이동은 연동됩니다. 색이 크게 달라지는 지역이 곧 SSI_camp가 큰 지역입니다.
      </div>
    </div>
  )
}
