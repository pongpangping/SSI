import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import rawGeo from '../data/sigungu_geo.json'
import { ROWS, rowKey, keyOf, rowIndex, colorFn, valuesOf, shortSido, HEAT, BLUE, GREEN, DIV } from '../lib/ssi.js'

const okRing = (r) => Array.isArray(r) && r.length >= 4 &&
  r.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
function cleanGeometry(g) {
  if (!g) return null
  if (g.type === 'Polygon') { const rings = (g.coordinates || []).filter(okRing); return rings.length ? { type: 'Polygon', coordinates: rings } : null }
  if (g.type === 'MultiPolygon') { const polys = (g.coordinates || []).map((p) => (p || []).filter(okRing)).filter((p) => p.length); return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null }
  return null
}
export const featKey = (f) => keyOf(f.properties?.sido, f.properties?.name)

let GEO = null
export function geoData() {
  if (!GEO) GEO = {
    type: 'FeatureCollection',
    features: (rawGeo.features || []).map((f) => ({ ...f, geometry: cleanGeometry(f.geometry) })).filter((f) => f.geometry),
  }
  return GEO
}
const RAMP = { heat: HEAT, blue: BLUE, green: GREEN, rank: BLUE, div: DIV }

export default function NationalMap({
  sector, metric, onlyHigh, selected, hovered, onSelect, onHover, sido = null,
  compact = false, title = null, subtitle = null, onMapReady = null, onToolsReady = null,
  autoFit = true,
}) {
  const geoRef = useRef(null)
  const wrapRef = useRef(null)
  const [map, setMap] = useState(null)
  const [tilesReady, setTilesReady] = useState(false)

  const geo = useMemo(geoData, [])
  const byKey = useMemo(() => Object.fromEntries(ROWS.map((r) => [rowKey(r), r])), [])

  const vals = useMemo(() => valuesOf(metric), [metric])
  const [min, max] = useMemo(() => {
    const v = vals.filter((x) => x != null && !Number.isNaN(x))
    return [Math.min(...v), Math.max(...v)]
  }, [vals])
  const color = useMemo(() => colorFn(metric.scale, min, max), [metric.scale, min, max])
  const valOf = (k) => { const i = rowIndex(k); return i == null ? null : vals[i] }

  const styleFor = (f) => {
    const k = featKey(f)
    const row = byKey[k]
    const isSel = k === selected, isHov = k === hovered
    const high = row && row[sector].flag === 'high'
    const outSido = sido && row && row.sido !== sido
    const dim = (onlyHigh && !high) || outSido
    return {
      fillColor: color(valOf(k)),
      fillOpacity: dim ? 0.06 : isSel ? 0.95 : isHov ? 0.88 : 0.82,
      color: isSel ? '#0F172A' : isHov ? '#334155' : (high && !dim) ? '#B91C1C' : '#ffffff',
      weight: isSel ? 2.6 : isHov ? 1.8 : (high && !dim) ? 1.1 : 0.5,
      opacity: dim ? 0.3 : 1,
    }
  }

  const tipHtml = (k, row) => `
    <div class="mpop">
      <div class="mpop-h">${row.sido} ${row.name}</div>
      <div class="mtip-row"><span>${metric.label}</span><b>${metric.fmt(valOf(k))}</b></div>
      <div class="mtip-row"><span>순위 이동</span><b>${row[sector].ssiCamp}계단${row[sector].flag === 'high' ? ' · 민감' : ''}</b></div>
    </div>`

  const onEach = (f, layer) => {
    const k = featKey(f); const row = byKey[k]
    if (row) layer.bindTooltip(tipHtml(k, row), { sticky: true, direction: 'top', opacity: 1, className: 'm-tip' })
    layer.on({
      click: () => onSelect(k),
      mouseover: () => onHover?.(k),
      mouseout: () => onHover?.(null),
    })
  }

  useEffect(() => {
    if (!geoRef.current) return
    geoRef.current.setStyle(styleFor)
    geoRef.current.eachLayer((l) => {
      const k = featKey(l.feature); const row = byKey[k]
      if (row && l.getTooltip()) l.setTooltipContent(tipHtml(k, row))
    })
  })

  // ── 지도 이동 조작 ──────────────────────────────────────────────────────
  const boundsOf = (pred) => {
    if (!geoRef.current) return null
    let b = null
    geoRef.current.eachLayer((l) => {
      if (!pred(featKey(l.feature))) return
      b = b ? b.extend(l.getBounds()) : l.getBounds()
    })
    return b && b.isValid() ? b : null
  }
  const fitAll = () => { const b = boundsOf(() => true); if (b && map) map.flyToBounds(b, { padding: [12, 12], duration: 0.6 }) }
  const fitSido = (s) => { const b = boundsOf((k) => byKey[k]?.sido === s); if (b && map) map.flyToBounds(b, { padding: [24, 24], duration: 0.7 }) }
  const fitSel = () => { const b = boundsOf((k) => k === selected); if (b && map) map.flyToBounds(b, { padding: [70, 70], duration: 0.7 }) }

  // 조작 함수 묶음 — 나란히 보기(듀얼)에서 부모가 공용 도구막대로 쓴다.
  const apiRef = useRef({})
  apiRef.current = {
    fitAll, fitSido, fitSel,
    zoomIn: () => map && map.zoomIn(),
    zoomOut: () => map && map.zoomOut(),
  }

  const firstRef = useRef(true)
  useEffect(() => {
    if (!map) return
    onMapReady?.(map)
    onToolsReady?.(apiRef)
    if (!geoRef.current || !firstRef.current) return
    firstRef.current = false
    try { map.fitBounds(geoRef.current.getBounds(), { padding: [12, 12] }) } catch (e) { /* noop */ }
  }, [map])

  // 시도를 고르면 그 권역으로, 전국으로 되돌리면 전국으로 이동
  const sidoRef = useRef(sido)
  useEffect(() => {
    if (!map || !autoFit || sidoRef.current === sido) return
    sidoRef.current = sido
    try { sido ? fitSido(sido) : fitAll() } catch (e) { /* noop */ }
  }, [sido, map])

  // 통계창 접기/펼치기·창 크기 변화로 지도 폭이 바뀌면 Leaflet에 알린다
  useEffect(() => {
    if (!map || !wrapRef.current || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { try { map.invalidateSize({ animate: false }) } catch (e) { /* noop */ } })
    })
    ro.observe(wrapRef.current)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [map])

  const ramp = RAMP[metric.scale] || BLUE
  const lowLab = metric.scale === 'rank' ? '하위(229위)'
    : metric.scale === 'div' ? '◀ 순위 상승' : '낮음'
  const hiLab = metric.scale === 'rank' ? '상위(1위)'
    : metric.scale === 'div' ? '순위 하락 ▶' : (metric.scale === 'heat' ? '높음(민감)' : '높음')

  const selRow = selected ? byKey[selected] : null
  const hovRow = hovered ? byKey[hovered] : null
  const shown = hovRow || selRow

  return (
    <div ref={wrapRef} className={`map-canvas${compact ? ' map-compact' : ''}`}>
      {title && <div className="map-cap"><b>{title}</b>{subtitle && <em>{subtitle}</em>}</div>}
      <MapContainer ref={setMap} center={[36.4, 127.8]} zoom={compact ? 6 : 7} zoomControl={false}
        preferCanvas={true} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO' subdomains="abcd" maxZoom={19}
          eventHandlers={{ load: () => setTilesReady(true) }} />
        <GeoJSON ref={geoRef} data={geo} style={styleFor} onEachFeature={onEach} />
        {!compact && <ZoomControl position="topright" />}
      </MapContainer>

      {/* 지도 조작 도구 */}
      {!compact && (
        <div className="map-tools">
          <button onClick={fitAll} title="전국이 한 화면에 들어오도록">전국</button>
          <button onClick={() => sido && fitSido(sido)} disabled={!sido}
            title="선택한 시·도로 이동">{sido ? shortSido(sido) : '시·도'}</button>
          <button onClick={fitSel} disabled={!selected} title="선택한 시군구를 확대">확대</button>
        </div>
      )}

      {/* 커서 아래 / 선택 지역 실시간 표시 — 지도와 통계창을 잇는 고리 */}
      {!compact && shown && (
        <div className={`map-live${hovRow ? ' hov' : ''}`}>
          <b>{shown.sido} {shown.name}</b>
          <span>{metric.label}<i>{metric.fmt(valOf(rowKey(shown)))}</i></span>
          <span>순위 이동<i>{shown[sector].ssiCamp}계단</i></span>
          {shown[sector].flag === 'high' && <em className="ml-high">민감</em>}
        </div>
      )}

      {!tilesReady && <div className="map-loading"><span className="spin" />지도 불러오는 중…</div>}

      <div className={`maplegend${compact ? ' lg-mini' : ''}`}>
        <h4>{metric.label}</h4>
        <div className="ml-scale">{ramp.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
        <div className="ml-ends"><span>{lowLab}</span><span>{hiLab}</span></div>
      </div>
    </div>
  )
}
