import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
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
  autoFit = true, onlyHighToggle = null, padLeft = 0,
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
  // 지도가 화면 전체에 깔리고 조작·통계 패널이 그 위에 떠 있으므로,
  // '보이는 영역'은 패널 폭(padLeft)만큼 오른쪽으로 밀린 사각형이다.
  // 지도를 맞출 때 그 폭을 여백으로 넣어야 국토가 패널 뒤로 숨지 않는다.
  const pad = (g) => ({ paddingTopLeft: [padLeft + g, g], paddingBottomRight: [g, g] })

  // 사람이 실제로 들여다보는 덩어리 — 본토와 제주.
  // 전체 경계에는 백령도·독도까지 들어가 있어 그대로 가운데를 잡으면
  // 정작 보고 싶은 곳이 한쪽으로 밀린다. 그래서 '맞추는 건 전체, 가운데는 본토'로 나눈다.
  const CORE = L.latLngBounds([33.10, 126.10], [38.62, 129.62])

  // 여백을 뺀 '보이는 상자' 한가운데에 경계를 놓는다.
  // core=true 면 가로 위치만 본토 기준으로 다시 잡되,
  // 그러다 도서가 화면 밖으로 나가지 않도록 안전 범위 안에서만 움직인다.
  const fitTo = (b, g, { core = false, keepIn = null, duration = 0.6 } = {}) => {
    if (!map || !b) return
    const tl = L.point(padLeft + g, g), br = L.point(g, g)
    const size = map.getSize()
    const z = map.getBoundsZoom(b, false, tl.add(br))
    const off = br.subtract(tl).divideBy(2)
    const sw = map.project(b.getSouthWest(), z), ne = map.project(b.getNorthEast(), z)
    const c = sw.add(ne).divideBy(2).add(off)
    if (core) {
      c.x = map.project(CORE.getCenter(), z).x + off.x        // 가로는 본토 기준으로 가운데
      const k = keepIn || b
      const ksw = map.project(k.getSouthWest(), z), kne = map.project(k.getNorthEast(), z)
      const lo = kne.x - size.x / 2 + br.x     // 이보다 왼쪽이면 동쪽 끝(독도)이 잘린다
      const hi = ksw.x + size.x / 2 - tl.x     // 이보다 오른쪽이면 서쪽 끝(백령도)이 잘린다
      if (lo <= hi) c.x = Math.min(hi, Math.max(lo, c.x))     // 다 담을 수 있을 때만 도서를 지킨다
    }
    map.flyTo(map.unproject(c, z), z, { duration })
  }

  // 전국 보기 — 도서까지 담느라 지도가 눈에 띄게 작아지면(9% 이상) 본토 기준으로 맞춘다.
  // 백령도·독도 때문에 경도 폭이 본토의 두 배가 되어, 좁은 화면에서 국토가 손톱만 해지기 때문이다.
  const fitAll = (duration = 0.6) => {
    const all = boundsOf(() => true)
    if (!map || !all) return
    const g = 8, p = L.point(padLeft + g, g).add(L.point(g, g))
    const zAll = map.getBoundsZoom(all, false, p), zCore = map.getBoundsZoom(CORE, false, p)
    fitTo(zCore - zAll > 0.12 ? CORE : all, g, { core: true, keepIn: all, duration })
  }
  const fitSido = (s) => fitTo(boundsOf((k) => byKey[k]?.sido === s), 28, { duration: 0.7 })
  const fitSel = () => fitTo(boundsOf((k) => k === selected), 70, { duration: 0.7 })

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
    if (!compact && typeof window !== 'undefined') window.__map = map   // 자동 검증용 손잡이
    if (!geoRef.current || !firstRef.current) return
    firstRef.current = false
    try { fitAll(0) } catch (e) { /* noop */ }
  }, [map])

  // 통계창을 접거나 펴면 '가려지지 않은 영역'의 한가운데가 옆으로 움직인다.
  // 확대 배율은 그대로 두고 그 이동분의 절반만큼 지도를 밀어, 보이는 자리에 국토가 계속 가운데 오게 한다.
  const padRef = useRef(padLeft)
  useEffect(() => {
    const d = padRef.current - padLeft
    padRef.current = padLeft
    if (!map || !d) return
    const t = setTimeout(() => { try { map.panBy([d / 2, 0], { animate: true, duration: 0.4 }) } catch (e) { /* noop */ } }, 20)
    return () => clearTimeout(t)
  }, [padLeft, map])

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
      {/* zoomSnap=0 — 확대 단계를 정수로 끊지 않는다.
          정수로 끊으면 화면이 남아도 한 단계 낮은 배율로 내려가 지도가 작아 보인다. */}
      <MapContainer ref={setMap} center={[36.4, 127.8]} zoom={compact ? 6 : 7} zoomControl={false}
        zoomSnap={0} zoomDelta={0.5} wheelPxPerZoomLevel={90}
        preferCanvas={true} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO' subdomains="abcd" maxZoom={19}
          eventHandlers={{ load: () => setTilesReady(true) }} />
        <GeoJSON ref={geoRef} data={geo} style={styleFor} onEachFeature={onEach} />
      </MapContainer>

      {/* 지도 조작 도구 — 오른쪽 위 세로 스택(＋ − ↺ ⤢) */}
      {!compact && (
        <div className="mapz">
          <button onClick={() => map && map.zoomIn()} title="확대" aria-label="확대">＋</button>
          <button onClick={() => map && map.zoomOut()} title="축소" aria-label="축소">－</button>
          <span className="mapz-sep" />
          <button onClick={fitAll} title="전국이 한 화면에 들어오도록" aria-label="전국 보기">↺</button>
          <button onClick={() => sido && fitSido(sido)} disabled={!sido}
            title={sido ? `${shortSido(sido)}로 이동` : '시·도를 고르면 사용'}
            aria-label="선택한 시·도로 이동">◎</button>
          <button onClick={fitSel} disabled={!selected} title="선택한 시군구를 확대"
            aria-label="선택 지역 확대">⤢</button>
        </div>
      )}

      {/* 보기 옵션 — 오른쪽 아래. 지도를 보는 중에도 손이 닿는 자리 */}
      {!compact && onlyHighToggle && (
        <div className="mapsw">
          <button className={`msw-t${onlyHigh ? ' on' : ''}`} onClick={onlyHighToggle}
            aria-pressed={onlyHigh} title="순위 이동이 큰 상위 20%만 남기고 나머지는 흐리게">
            <i /><span>{onlyHigh ? 'ON' : 'OFF'} · 민감 지역만</span>
          </button>
          <button className="msw-r" onClick={fitAll} title="지도 위치를 처음으로">초기화</button>
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
