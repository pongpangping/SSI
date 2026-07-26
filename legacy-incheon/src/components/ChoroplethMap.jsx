import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { metricBy } from '../lib/metrics.js'
import { comma, pct } from '../lib/format.js'
import rawGeo from '../data/incheonGeo.json'
import rawGrid from '../data/incheonGrid.json'

const SEQ = ['#E6F3FF', '#C7E6FF', '#9AD3FF', '#66BCFF', '#33A8FF', '#0B93EE', '#008AE0', '#006BB0']
// 격자 밀집도 — 따뜻한 계열(단계구분도 파랑과 구분)
const HEAT = ['#FFF0D4', '#FFD9A0', '#FFB866', '#FF9433', '#F5760D', '#D65A00', '#A63F00']
const GRID_ZOOM = 11  // 이 줌 이상에서 격자 표시(구 확대 시)

const okRing = (r) =>
  Array.isArray(r) && r.length >= 4 &&
  r.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
function cleanGeometry(g) {
  if (!g) return null
  if (g.type === 'Polygon') {
    const rings = (g.coordinates || []).filter(okRing)
    return rings.length ? { type: 'Polygon', coordinates: rings } : null
  }
  if (g.type === 'MultiPolygon') {
    const polys = (g.coordinates || []).map((p) => (p || []).filter(okRing)).filter((p) => p.length)
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null
  }
  return null
}
const codeOf = (f) =>
  String(f.properties?.SIG_CD ?? f.properties?.sig_cd ?? f.properties?.code ?? '').slice(0, 5)

// 라벨 위치: 가장 큰 폴리곤의 무게중심(면적 가중) → 바다·구석에 찍히지 않게
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1]
    const f = x0 * y1 - x1 * y0
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
  }
  a *= 0.5
  if (Math.abs(a) < 1e-12) {
    const m = ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0])
    return [m[0] / ring.length, m[1] / ring.length]
  }
  return [cx / (6 * a), cy / (6 * a)]  // [lng, lat]
}
function ringArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1]
    a += x0 * y1 - x1 * y0
  }
  return Math.abs(a / 2)
}
function labelAnchor(geom) {
  if (!geom) return null
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  let best = null, bestA = -1
  for (const poly of polys) {
    const ring = poly && poly[0]
    if (!ring || ring.length < 4) continue
    const a = ringArea(ring)
    if (a > bestA) { bestA = a; best = ring }
  }
  if (!best) return null
  const [lng, lat] = ringCentroid(best)
  return [lat, lng]  // Leaflet 순서
}

export default function ChoroplethMap({ rows, selected, hovered, onSelect, onHover, metricKey, avgFilter, avgValue, showGrid }) {
  const geoRef = useRef(null)
  const mapRef = useRef(null)
  const [map, setMap] = useState(null)
  const [zoom, setZoom] = useState(10)
  const [tilesReady, setTilesReady] = useState(false)   // 타일 로딩 상태 (회색 깜빡임 방지)
  const [tip, setTip] = useState(true)                  // 첫 진입 사용법 힌트
  // 지도는 전용 영역(가운데 열)에 있으므로 여백 보정 불필요
  const viewOpts = () => ({ padding: [24, 24] })

  const { geo, status } = useMemo(() => {
    const features = ((rawGeo && rawGeo.features) || [])
      .map((f) => ({ ...f, geometry: cleanGeometry(f.geometry) }))
      .filter((f) => f.geometry)
    return features.length
      ? { geo: { type: 'FeatureCollection', features }, status: 'ok' }
      : { geo: null, status: 'missing' }
  }, [])

  const metric = metricBy(metricKey)
  const byCode = useMemo(() => Object.fromEntries(rows.map((r) => [r.code, r])), [rows])
  const anchorByCode = useMemo(() => {
    const m = {}
    for (const f of (geo?.features || [])) { const a = labelAnchor(f.geometry); if (a) m[codeOf(f)] = a }
    return m
  }, [geo])
  const [min, max] = useMemo(() => {
    const v = rows.map((r) => r[metric.key]).filter((x) => x != null)
    return [Math.min(...v), Math.max(...v)]
  }, [rows, metric.key])

  const fillFor = (v) => {
    if (v == null || max === min) return 'rgba(20,30,60,0.10)'
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)))
    return SEQ[Math.round(t * (SEQ.length - 1))]
  }
  const matchAvg = (row) => {
    if (!avgFilter || row?.[metric.key] == null) return true
    return avgFilter === 'above' ? row[metric.key] >= avgValue : row[metric.key] < avgValue
  }

  // ── 격자 밀집도 ──
  const gridActive = showGrid && zoom >= GRID_ZOOM
  const gridGeo = useMemo(() => ({
    type: 'FeatureCollection',
    features: (rawGrid.cells || []).map((c) => ({ type: 'Feature', properties: { v: c.v }, geometry: c.geometry })),
  }), [])
  const gridMax = useMemo(() => {
    const vs = (rawGrid.cells || []).map((c) => c.v)
    // 상위값이 색을 다 먹지 않도록 95퍼센타일 기준
    if (!vs.length) return 1
    const s = [...vs].sort((a, b) => a - b)
    return s[Math.floor(s.length * 0.95)] || s[s.length - 1]
  }, [])
  const gridColor = (v) => {
    const t = Math.max(0, Math.min(1, v / gridMax))
    return HEAT[Math.min(HEAT.length - 1, Math.round(t * (HEAT.length - 1)))]
  }
  const gridStyle = (f) => ({
    fillColor: gridColor(f.properties.v), fillOpacity: 0.72, stroke: false,
  })

  const styleFor = (f) => {
    const code = codeOf(f); const row = byCode[code]
    const isSel = code === selected, isHov = code === hovered
    const matches = matchAvg(row)
    // 격자가 켜지면 시군구는 채움을 거의 없애고 외곽선만 남김
    const baseFill = !matches ? 0.12 : (selected && !isSel) || (hovered && !isHov) ? 0.6 : 0.92
    return {
      fillColor: fillFor(row?.[metric.key]),
      fillOpacity: gridActive ? (isSel ? 0.04 : 0.0) : baseFill,
      color: isSel ? '#0F172A' : isHov ? '#334155' : gridActive ? '#94A3B8' : '#ffffff',
      weight: isSel ? 3 : isHov ? 2.2 : gridActive ? 1.6 : 1.2,
      opacity: !matches && !gridActive ? 0.4 : 1,
    }
  }
  // 지도 위 상시 라벨 — 지역명 + 선택 지표값 (지도가 1차 정보면)
  const labelHtml = (row) => `
    <div class="dl-name">${row.name}</div>
    <div class="dl-val">${metric.fmt(row[metric.key])}</div>`
  const popupCard = (row) => `
    <div class="mpop">
      <div class="mpop-h">${row.name}</div>
      <div class="mtip-row"><span>1인가구 비율</span><b>${pct(row.onePersonRate)}</b></div>
      <div class="mtip-row"><span>고령 1인가구 비중</span><b>${pct(row.agedOneShareOfOne)}</b></div>
      <div class="mtip-row"><span>세대당 인구</span><b>${row.avgHouseholdSize}명</b></div>
      <div class="mtip-row"><span>인구 / 세대</span><b>${comma(row.population)} / ${comma(row.households)}</b></div>
    </div>`

  const onEachFeature = (feature, layer) => {
    const row = byCode[codeOf(feature)]
    if (row) {
      layer.bindTooltip(labelHtml(row), { permanent: true, direction: 'center', opacity: 1, className: 'district-label', interactive: false })
      layer.bindPopup(popupCard(row), { closeButton: true, className: 'm-popup', offset: [0, -4] })
    }
    layer.on({
      // 클릭은 선택·강조·팝업만. 확대는 강제하지 않음(더블클릭/스크롤/±로 사용자가 직접).
      click: () => { onSelect(codeOf(feature)); layer.openPopup() },
      mouseover: () => onHover?.(codeOf(feature)),
      mouseout: () => onHover?.(null),
    })
  }

  useEffect(() => {
    if (!geoRef.current) return
    geoRef.current.setStyle(styleFor)
    geoRef.current.eachLayer((l) => {
      const row = byCode[codeOf(l.feature)]
      if (row && l.getTooltip()) l.setTooltipContent(labelHtml(row))
      if (row && l.getPopup()) l.setPopupContent(popupCard(row))
    })
  })

  // 라벨을 대표 지점(가장 큰 폴리곤 중심)으로 이동 — 연수구·옹진군이 바다/구석에 찍히지 않게
  useEffect(() => {
    if (!map || !geoRef.current) return
    geoRef.current.eachLayer((l) => {
      const a = anchorByCode[codeOf(l.feature)]
      const tt = l.getTooltip && l.getTooltip()
      if (a && tt) tt.setLatLng(a)
    })
  }, [map, anchorByCode])

  // 초기 1회: 인천 전체 개요를 (패널을 피해) 우측 지도 영역 중앙에 맞춤. 선택만으론 줌하지 않음.
  const firstRef = useRef(true)
  useEffect(() => {
    if (!map || !geoRef.current || !firstRef.current) return
    firstRef.current = false
    try { map.fitBounds(geoRef.current.getBounds(), viewOpts()) } catch (e) { /* noop */ }
  }, [map])

  // 줌 레벨 추적 (격자 표시 여부 판단용)
  useEffect(() => {
    if (!map) return
    const onZoom = () => setZoom(map.getZoom())
    map.on('zoomend', onZoom); setZoom(map.getZoom())
    return () => map.off('zoomend', onZoom)
  }, [map])

  // 범례 버킷 (연속 → 5구간)
  const buckets = useMemo(() => {
    if (max === min) return []
    const steps = [0, 0.2, 0.4, 0.6, 0.8, 1]
    return steps.slice(0, -1).map((s, i) => {
      const lo = min + (max - min) * s
      const hi = min + (max - min) * steps[i + 1]
      return { color: SEQ[Math.round(((s + steps[i + 1]) / 2) * (SEQ.length - 1))], lo, hi }
    })
  }, [min, max])

  if (status === 'missing') {
    return (
      <div className="map-canvas map-empty">
        <div>🗺️ 경계 데이터가 없습니다 — <code>python scripts/extract.py</code> 후 빌드하세요.</div>
      </div>
    )
  }

  return (
    <div className={`map-canvas${gridActive ? ' labels-off' : ''}`}>
      <MapContainer ref={(m) => { setMap(m); mapRef.current = m }} center={[37.45, 126.55]} zoom={10} zoomControl={false}
        preferCanvas={true} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO' subdomains="abcd" maxZoom={19}
          eventHandlers={{ load: () => setTilesReady(true) }} />
        {geo && <GeoJSON ref={geoRef} data={geo} style={styleFor} onEachFeature={onEachFeature} />}
        {gridActive && (
          <GeoJSON key="grid" data={gridGeo} style={gridStyle} interactive={false} />
        )}
        <ZoomControl position="topright" />
      </MapContainer>

      {!tilesReady && (
        <div className="map-loading"><span className="spin" />지도 불러오는 중…</div>
      )}
      {tip && (
        <div className="map-tip">
          <b>구 클릭</b> = 상세 · <b>더블클릭 / 스크롤</b> = 확대(격자)
          <button onClick={() => setTip(false)} aria-label="닫기">✕</button>
        </div>
      )}

      {!gridActive && (
        <div className="maplegend">
          <h4>{metric.label}</h4>
          {buckets.map((b, i) => (
            <div className="ml-row" key={i}>
              <i style={{ background: b.color }} />
              {metric.fmt(Math.round(b.lo * 10) / 10)} ~ {metric.fmt(Math.round(b.hi * 10) / 10)}
            </div>
          ))}
        </div>
      )}

      {gridActive && (
        <div className="maplegend">
          <h4>1인가구 밀도 ({rawGrid.cellKm >= 1 ? '1km' : '500m'} 격자){rawGrid.sample ? ' · 표본' : ''}</h4>
          <div className="ml-scale">
            {HEAT.map((c, i) => <i key={i} style={{ background: c }} />)}
          </div>
          <div className="ml-ends"><span>0</span><span>{gridMax.toLocaleString()}명</span></div>
          <div className="ml-note">{rawGrid.sample ? '추정 ' : 'SGIS '}셀당 1인가구 수{rawGrid.sample ? '' : ' (2024)'}</div>
        </div>
      )}
    </div>
  )
}
