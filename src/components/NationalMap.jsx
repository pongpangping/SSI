import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import rawGeo from '../data/sigungu_geo.json'
import { ROWS, rowKey, keyOf, rowIndex, colorFn, valuesOf, HEAT, BLUE, GREEN, DIV } from '../lib/ssi.js'

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
  sector, metric, onlyHigh, selected, hovered, onSelect, onHover,
  compact = false, title = null, subtitle = null, onMapReady = null,
}) {
  const geoRef = useRef(null)
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
    const dim = onlyHigh && !high
    return {
      fillColor: color(valOf(k)),
      fillOpacity: dim ? 0.06 : isSel ? 0.95 : isHov ? 0.88 : 0.82,
      color: isSel ? '#0F172A' : isHov ? '#334155' : (high && !dim) ? '#B91C1C' : '#ffffff',
      weight: isSel ? 2.4 : isHov ? 1.8 : (high && !dim) ? 1.1 : 0.5,
      opacity: dim ? 0.35 : 1,
    }
  }

  const tipHtml = (k, row) => `
    <div class="mpop">
      <div class="mpop-h">${row.sido} ${row.name}</div>
      <div class="mtip-row"><span>${metric.label}</span><b>${metric.fmt(valOf(k))}</b></div>
      <div class="mtip-row"><span>SSI_camp</span><b>${row[sector].ssiCamp}계단${row[sector].flag === 'high' ? ' · 민감' : ''}</b></div>
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

  const firstRef = useRef(true)
  useEffect(() => {
    if (!map) return
    onMapReady?.(map)
    if (!geoRef.current || !firstRef.current) return
    firstRef.current = false
    try { map.fitBounds(geoRef.current.getBounds(), { padding: [12, 12] }) } catch (e) { /* noop */ }
  }, [map])

  const ramp = RAMP[metric.scale] || BLUE
  const lowLab = metric.scale === 'rank' ? '하위(229위)'
    : metric.scale === 'div' ? '◀ 순위 상승' : '낮음'
  const hiLab = metric.scale === 'rank' ? '상위(1위)'
    : metric.scale === 'div' ? '순위 하락 ▶' : (metric.scale === 'heat' ? '높음(민감)' : '높음')

  return (
    <div className={`map-canvas${compact ? ' map-compact' : ''}`}>
      {title && <div className="map-cap"><b>{title}</b>{subtitle && <em>{subtitle}</em>}</div>}
      <MapContainer ref={setMap} center={[36.4, 127.8]} zoom={compact ? 6 : 7} zoomControl={false}
        preferCanvas={true} scrollWheelZoom={!compact} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO' subdomains="abcd" maxZoom={19}
          eventHandlers={{ load: () => setTilesReady(true) }} />
        <GeoJSON ref={geoRef} data={geo} style={styleFor} onEachFeature={onEach} />
        {!compact && <ZoomControl position="topright" />}
      </MapContainer>

      {!tilesReady && <div className="map-loading"><span className="spin" />지도 불러오는 중…</div>}

      <div className={`maplegend${compact ? ' lg-mini' : ''}`}>
        <h4>{metric.label}</h4>
        <div className="ml-scale">{ramp.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
        <div className="ml-ends"><span>{lowLab}</span><span>{hiLab}</span></div>
        {!compact && <div className="ml-note">
          {metric.scale === 'rank' ? '진할수록 상위. ' : ''}빨간 테두리 = 민감(high) 지역
        </div>}
      </div>
      {!compact && <div className="map-tip static">클릭 = 상세 진단 · 스크롤 = 확대 · 좌측에서 표준화 방법을 바꾸면 색이 바뀝니다</div>}
    </div>
  )
}
