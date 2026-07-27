import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NationalMap from './NationalMap.jsx'
import {
  metricFor, metricsFor, methodOf, METHODS, SECTORS, SECTOR_KEYS, CAMP, CAMP_REPS,
  campOf, valuesOf, rowIndex, ROWS, shortSido,
} from '../lib/ssi.js'

// 나란히 보기 — 왼쪽·오른쪽 지도를 각각 '부문 · 방법 · 지표'로 정한다.
// 처음에는 가장 자주 쓰는 조합(방법 비교)을 추천으로 걸어 두고,
// 필요하면 자유 조합으로 넘어가 좌우를 완전히 따로 고를 수 있게 한다.
// 마우스를 올리면 커서를 따라다니는 팝업이 두 지도의 값을 한 번에 보여 준다.

const PRESETS = [
  { key: 'method', label: '방법 비교', desc: '같은 부문 · 같은 지표, 표준화 방법만 다르게' },
  { key: 'sector', label: '부문 비교', desc: '같은 방법 · 같은 항목, 부문만 다르게' },
  { key: 'metric', label: '지표 비교', desc: '같은 부문 · 같은 방법, 보는 항목만 다르게' },
  { key: 'free', label: '자유 조합', desc: '좌우를 각각 따로 고른다' },
]

// 지표 키가 그 부문·방법에 실제로 있는지 확인하고, 없으면 순위로 되돌린다.
const safeKey = (sector, method, key) => {
  const list = metricsFor(sector, method)
  return list.some((m) => m.key === key) ? key : (list.find((m) => m.key === 'rank') || list[0]).key
}
const otherKey = (sector, method, key) => {
  const list = metricsFor(sector, method)
  const pref = ['ci', 'rank', 'pct', 'ciT']
  return (pref.find((p) => p !== key && list.some((m) => m.key === p))
    || list.find((m) => m.key !== key)?.key || key)
}
const nextSector = (s) => SECTOR_KEYS[(SECTOR_KEYS.indexOf(s) + 1) % SECTOR_KEYS.length]

// 두 지도의 색 등급(7단계)이 다른 시군구 수 — 부문·지표가 달라도 셀 수 있게 값에서 직접 계산한다.
function binsOf(metric) {
  const v = valuesOf(metric)
  const f = v.filter((x) => x != null && !Number.isNaN(x))
  const lo = Math.min(...f), hi = Math.max(...f), d = (hi - lo) || 1
  return v.map((x) => (x == null ? -1 : Math.min(6, Math.floor(((x - lo) / d) * 7))))
}
function diffCount(mA, mB) {
  const a = binsOf(mA), b = binsOf(mB)
  return a.reduce((n, x, i) => n + (x !== b[i] ? 1 : 0), 0)
}

function SidePick({ side, on, onChange }) {
  const list = metricsFor(side.sector, side.method)
  const groups = []
  list.forEach((m) => {
    const g = groups.find((x) => x.g === m.group)
    if (g) g.items.push(m); else groups.push({ g: m.group, items: [m] })
  })
  return (
    <div className="cv-pick">
      <select value={side.sector} title="부문"
        onChange={(e) => onChange({ ...side, sector: e.target.value, metricKey: safeKey(e.target.value, side.method, side.metricKey) })}>
        {SECTOR_KEYS.map((k) => <option key={k} value={k}>{SECTORS[k].name}</option>)}
      </select>
      <select value={side.method} title="표준화 방법"
        onChange={(e) => onChange({ ...side, method: e.target.value, metricKey: safeKey(side.sector, e.target.value, side.metricKey) })}>
        {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select>
      <select value={side.metricKey} title="보는 항목"
        onChange={(e) => onChange({ ...side, metricKey: e.target.value })}>
        {groups.map((g) => (
          <optgroup key={g.g} label={g.g}>
            {g.items.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

export default function CompareMaps({
  sector, method = 'minmax', metricKey, onlyHigh, selected, hovered,
  onSelect, onHover, sido = null, onlyHighToggle = null,
}) {
  const maps = useRef([])
  const lock = useRef(false)
  const api = useRef(null)

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

  const [preset, setPreset] = useState('method')
  const [A, setA] = useState({ sector, method: CAMP_REPS[0], metricKey })
  const [B, setB] = useState({ sector, method: CAMP_REPS[1], metricKey })

  // 추천 조합일 때는 왼쪽 조작부(부문·방법·지표)를 그대로 따라간다.
  useEffect(() => {
    if (preset === 'free') return
    if (preset === 'method') {
      const k = safeKey(sector, CAMP_REPS[0], metricKey)
      setA({ sector, method: CAMP_REPS[0], metricKey: k })
      setB({ sector, method: CAMP_REPS[1], metricKey: safeKey(sector, CAMP_REPS[1], k) })
    } else if (preset === 'sector') {
      const s2 = nextSector(sector)
      setA({ sector, method, metricKey: safeKey(sector, method, metricKey) })
      setB({ sector: s2, method, metricKey: safeKey(s2, method, metricKey) })
    } else {
      const k = safeKey(sector, method, metricKey)
      setA({ sector, method, metricKey: k })
      setB({ sector, method, metricKey: otherKey(sector, method, k) })
    }
  }, [preset, sector, method, metricKey])

  const mA = metricFor(A.sector, A.method, A.metricKey)
  const mB = metricFor(B.sector, B.method, B.metricKey)
  const cA = CAMP[campOf(A.method)]?.color || '#0B93EE'
  const cB = CAMP[campOf(B.method)]?.color || '#F5760D'

  const vA = useMemo(() => valuesOf(mA), [mA])
  const vB = useMemo(() => valuesOf(mB), [mB])
  const changed = useMemo(() => diffCount(mA, mB), [mA, mB])
  const big = useMemo(() => ROWS.filter((r) => r[A.sector].ssiCamp >= 10).length, [A.sector])

  const tagA = `${SECTORS[A.sector].name} · ${methodOf(A.method).label}`
  const tagB = `${SECTORS[B.sector].name} · ${methodOf(B.method).label}`

  // ── 커서를 따라다니는 팝업 ───────────────────────────────────────────
  const [pos, setPos] = useState(null)
  const onMove = (e) => setPos({ x: e.clientX, y: e.clientY })
  useEffect(() => { if (!hovered) setPos(null) }, [hovered])

  const hi = hovered != null ? rowIndex(hovered) : null
  const hRow = hi != null ? ROWS[hi] : null
  const popStyle = pos ? {
    left: Math.min(pos.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1600) - 250),
    top: Math.min(pos.y + 16, (typeof window !== 'undefined' ? window.innerHeight : 900) - 150),
  } : null

  return (
    <div className="abm-wrap" onMouseMove={onMove}>
      {/* 무엇과 무엇을 견줄지 고르는 줄 */}
      <div className="cv-bar">
        <div className="cv-seg">
          {PRESETS.map((p) => (
            <button key={p.key} className={`cv-sg${preset === p.key ? ' on' : ''}`}
              onClick={() => setPreset(p.key)} title={p.desc}>{p.label}</button>
          ))}
        </div>
        <span className="cv-desc">{PRESETS.find((p) => p.key === preset)?.desc}</span>
      </div>

      {preset === 'free' && (
        <div className="cv-free">
          <SidePick side={A} onChange={setA} />
          <span className="cv-vs">견줌</span>
          <SidePick side={B} onChange={setB} />
        </div>
      )}

      <div className="abm-bar">
        <span className="abm-tag" style={{ background: cA }}>{tagA}</span>
        <span className="abm-mid" title="두 지도의 확대·이동은 함께 움직입니다">
          <em>색 등급 다른 곳</em><b>{changed}곳</b>
          <em>10계단↑ 이동</em><b>{big}곳</b>
        </span>
        <span className="abm-tag" style={{ background: cB }}>{tagB}</span>
      </div>

      <div className="abm-maps">
        <NationalMap sector={A.sector} metric={mA} onlyHigh={onlyHigh} sido={sido}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact tips={false} title={methodOf(A.method).label} subtitle={mA.label}
          onMapReady={register} onToolsReady={tools} />
        <NationalMap sector={B.sector} metric={mB} onlyHigh={onlyHigh} sido={sido}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact tips={false} title={methodOf(B.method).label} subtitle={mB.label}
          onMapReady={register} autoFit={false} />

        <div className="mapz abm-mapz" title="두 지도가 함께 움직입니다">
          <button onClick={() => run('zoomIn')} title="확대" aria-label="확대">＋</button>
          <button onClick={() => run('zoomOut')} title="축소" aria-label="축소">－</button>
          <span className="mapz-sep" />
          <button onClick={() => run('fitAll')} title="전국이 한 화면에 들어오도록" aria-label="전국 보기">↺</button>
          <button onClick={() => sido && run('fitSido', sido)} disabled={!sido}
            title={sido ? `${shortSido(sido)}로 이동` : '시·도를 고르면 사용'}
            aria-label="선택한 시·도로 이동">◎</button>
          <button onClick={() => run('fitSel')} disabled={!selected} title="선택한 시군구를 확대"
            aria-label="선택 지역 확대">⤢</button>
        </div>

        {onlyHighToggle && (
          <div className="mapsw abm-mapsw">
            <button className={`msw-t${onlyHigh ? ' on' : ''}`} onClick={onlyHighToggle}
              aria-pressed={onlyHigh} title="순위 이동이 큰 상위 20%만 남기고 나머지는 흐리게">
              <i /><span>{onlyHigh ? 'ON' : 'OFF'} · 민감 지역만</span>
            </button>
            <button className="msw-r" onClick={() => run('fitAll')} title="지도 위치를 처음으로">초기화</button>
          </div>
        )}
      </div>

      {/* 커서 따라다니는 비교 팝업 — 두 지도의 값을 한 자리에서 */}
      {hRow && popStyle && (
        <div className="cv-pop" style={popStyle}>
          <div className="cp-h">{hRow.sido} {hRow.name}</div>
          <div className="cp-r" style={{ '--c': cA }}>
            <i /><span>{mA.label}</span><b>{mA.fmt(vA[hi])}</b>
          </div>
          <div className="cp-r" style={{ '--c': cB }}>
            <i /><span>{mB.label}</span><b>{mB.fmt(vB[hi])}</b>
          </div>
          <div className="cp-f">
            순위 이동 {hRow[A.sector].ssiCamp}계단
            {hRow[A.sector].flag === 'high' && <em>민감</em>}
          </div>
        </div>
      )}
    </div>
  )
}
