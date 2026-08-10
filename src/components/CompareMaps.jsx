import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NationalMap from './NationalMap.jsx'
import { MetricPicker, HueDots } from './ResultChrome.jsx'
import {
  metricFor, metricsFor, methodOf, otherMethodOf, METHODS, SECTORS, SECTOR_KEYS, CAMP, CAMP_REPS,
  campOf, valuesOf, rowIndex, ROWS, plainSet, pctOf,
} from '../lib/ssi.js'

// 나란히 보기 — 왼쪽·오른쪽 지도를 각각 '부문 · 방법 · 지표'로 정한다.
// 추천 조합(방법 비교·부문 비교·지표 비교) 세 가지를 두었었지만, 결국 무엇을
// 비교하는지는 사람이 알고 들어오는 일이라 고르는 단계가 한 겹 더 늘 뿐이었다.
// 지금은 좌우를 각각 직접 고르는 자유 조합 하나만 둔다.
// 마우스를 올리면 커서를 따라다니는 팝업이 두 지도의 값을 한 번에 보여 준다.

// 지표 키가 그 부문·방법에 실제로 있는지 확인하고, 없으면 순위로 되돌린다.
const safeKey = (sector, method, key) => {
  const list = metricsFor(sector, method)
  return list.some((m) => m.key === key) ? key : (list.find((m) => m.key === 'rank') || list[0]).key
}

// ── 전처리 없음 계산(41차) ──────────────────────────────────────────────
// 2단계(로그화·반로그화·윈저)와 4단계(가중치)를 무시하고 다시 계산한 값.
// 한쪽을 '현재 설정', 다른쪽을 '전처리 없음'으로 두면 로그화나 가중치가
// 결과를 얼마나 움직였는지 지도로 비교할 수 있다. 부문 종합 값(점수·순위·
// T·백분위·순위 변화)에만 있다 — 지표 하나짜리 값은 비교 대상이 아니다.
const PLAIN_KEYS = ['ci', 'rank', 'ciT', 'pct', 'shift']
function plainMetric(sector, method, key) {
  const k = PLAIN_KEYS.includes(key) ? key : 'rank'
  const base = metricFor(sector, method, k)
  const pset = plainSet(sector)
  if (!pset) return base
  const other = otherMethodOf(method)
  const get = {
    ci: (r, i) => pset.ci[method][i],
    rank: (r, i) => pset.rank[method][i],
    ciT: (r, i) => pset.ciT[method][i],
    pct: (r, i) => pctOf(pset.rank[method][i]),
    shift: (r, i) => (pset.rank[other]?.[i] != null && pset.rank[method]?.[i] != null
      ? pset.rank[other][i] - pset.rank[method][i] : null),
  }[k]
  return { ...base, key: k, get, label: `${base.label} · 전처리 없음` }
}
const sideMetric = (side) => (side.eda === 'plain'
  ? plainMetric(side.sector, side.method, side.metricKey)
  : metricFor(side.sector, side.method, side.metricKey))

// 두 지도의 색 구간(7단계)이 다른 시군구 수 — 부문·지표가 달라도 셀 수 있게 값에서 직접 계산한다.
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

function SidePick({ side, onChange, align = 'left' }) {
  const plain = side.eda === 'plain'
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
      {/* 전처리 — 현재 설정(2단계 변환·윈저 + 4단계 가중치) 그대로 쓸지,
          다 걷어내고 계산할지. 좌우를 달리 두면 로그화·가중치의 효과가 지도로 보인다. */}
      <div className="cv-eda" title="현재 = 2단계 변환·윈저와 4단계 가중치를 반영한 계산 · 전처리 없음 = 변환 없이 동일가중으로 계산">
        <button className={plain ? '' : 'on'}
          onClick={() => onChange({ ...side, eda: 'cur' })}>현재 전처리</button>
        <button className={plain ? 'on' : ''}
          onClick={() => onChange({ ...side, eda: 'plain', metricKey: safeKey(side.sector, side.method, PLAIN_KEYS.includes(side.metricKey) ? side.metricKey : 'rank') })}>전처리 없음</button>
      </div>
      {/* 보는 항목 — 명령바와 같은 두 층 고르기 판(39차). 긴 목록이 접힌다.
          전처리 없음일 때는 부문 종합 값만 고를 수 있다. */}
      <MetricPicker sector={side.sector} method={side.method} value={side.metricKey}
        onChange={(k) => onChange({ ...side, metricKey: k })} align={align} small
        totalOnly={plain} />
      {/* 지도 색 — 좌우가 각자 고른다(40차) */}
      <HueDots small hue={side.hue || 'auto'} onHue={(h) => onChange({ ...side, hue: h })} />
    </div>
  )
}

export default function CompareMaps({
  sector, method = 'minmax', metricKey, onlyHigh, selected, hovered,
  onSelect, onHover, onlyHighToggle = null, ver = 0,
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

  // 처음 열 때만 조작부에서 고른 부문·지표를 그대로 물려받고, 표준화 방법만
  // 두 계열의 대표(간격보존형 · 순위전용형)로 갈라 둔다. 그 뒤로는 사람이
  // 좌우를 직접 바꾼다 — 조작부를 건드릴 때마다 되돌아가면 오히려 방해가 된다.
  const [A, setA] = useState(() => ({ sector, method: CAMP_REPS[0], metricKey: safeKey(sector, CAMP_REPS[0], metricKey), hue: 'auto', eda: 'cur' }))
  const [B, setB] = useState(() => ({ sector, method: CAMP_REPS[1], metricKey: safeKey(sector, CAMP_REPS[1], metricKey), hue: 'auto', eda: 'cur' }))

  const mA = sideMetric(A)
  const mB = sideMetric(B)
  const cA = CAMP[campOf(A.method)]?.color || '#0B93EE'
  const cB = CAMP[campOf(B.method)]?.color || '#F5760D'

  const vA = useMemo(() => valuesOf(mA), [mA])
  const vB = useMemo(() => valuesOf(mB), [mB])
  const changed = useMemo(() => diffCount(mA, mB), [mA, mB])
  const big = useMemo(() => ROWS.filter((r) => r[A.sector]?.ssiCamp >= 10).length, [A.sector, ver])

  const tagA = `${SECTORS[A.sector].name} · ${methodOf(A.method).label}${A.eda === 'plain' ? ' · 전처리 없음' : ''}`
  const tagB = `${SECTORS[B.sector].name} · ${methodOf(B.method).label}${B.eda === 'plain' ? ' · 전처리 없음' : ''}`

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
      {/* 좌우 두 조합을 각각 직접 고른다 */}
      <div className="cv-free">
        <SidePick side={A} onChange={setA} />
        <span className="cv-vs">대비</span>
        <SidePick side={B} onChange={setB} align="right" />
      </div>

      <div className="abm-bar">
        <span className="abm-tag" style={{ background: cA }}>{tagA}</span>
        <span className="abm-mid" title="두 지도의 확대·이동은 함께 움직입니다">
          <em>색 구간 다른 곳</em><b>{changed}곳</b>
          <em>10계단↑ 이동</em><b>{big}곳</b>
        </span>
        <span className="abm-tag" style={{ background: cB }}>{tagB}</span>
      </div>

      <div className="abm-maps">
        <NationalMap sector={A.sector} metric={mA} method={A.method} onlyHigh={onlyHigh}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact tips={false} title={methodOf(A.method).label} subtitle={mA.label}
          hue={A.hue === 'auto' ? null : A.hue}
          onMapReady={register} onToolsReady={tools} ver={ver} />
        <NationalMap sector={B.sector} metric={mB} method={B.method} onlyHigh={onlyHigh}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact tips={false} title={methodOf(B.method).label} subtitle={mB.label}
          hue={B.hue === 'auto' ? null : B.hue}
          onMapReady={register} autoFit={false} ver={ver} />

        <div className="mapz abm-mapz" title="두 지도가 함께 움직입니다">
          <button onClick={() => run('zoomIn')} title="확대" aria-label="확대">＋</button>
          <button onClick={() => run('zoomOut')} title="축소" aria-label="축소">－</button>
          <span className="mapz-sep" />
          <button onClick={() => run('fitAll')} title="전국이 한 화면에 들어오도록" aria-label="전국 보기">↺</button>
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
            순위 이동 {hRow[A.sector]?.ssiCamp ?? '—'}계단
            {hRow[A.sector]?.flag === 'high' && <em>민감</em>}
          </div>
        </div>
      )}
    </div>
  )
}
