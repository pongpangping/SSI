import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NationalMap from './NationalMap.jsx'
import { MetricPicker, HueDots } from './ResultChrome.jsx'
import {
  metricFor, metricsFor, methodOf, otherMethodOf, METHODS, SECTORS, SECTOR_KEYS, CAMP, CAMP_REPS,
  campOf, valuesOf, rowIndex, ROWS, ovSet, pctOf,
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

// ── 전처리 덮어쓰기 계산(41차→44차) ─────────────────────────────────────
// 좌우 지도를 서로 다른 전처리로 계산한다.
//   변환(tr)  현재 = 2단계에서 지표마다 정한 변환·윈저 그대로
//             없음 · 로그화 · 반로그화 = 모든 지표에 일괄 적용(윈저 없음)
//   가중치(wt) 현재 = 4단계 가중치 그대로 · 동일 = 동일가중
// 한쪽을 '로그화', 다른쪽을 '없음'으로 두면 로그화가 순위를 얼마나
// 움직였는지, '현재 대 동일'로 두면 가중치의 효과가 지도로 보인다.
// 덮어쓴 쪽은 부문 종합 값(점수·순위·T·백분위·순위 변화)만 볼 수 있다.
const PLAIN_KEYS = ['ci', 'rank', 'ciT', 'pct', 'shift']
const TR_NAME = { none: '변환 없음', log: '로그화', rlog: '반로그화' }
const ovOn = (side) => (side.tr || 'cur') !== 'cur' || (side.wt || 'cur') !== 'cur'
const ovName = (side) => [
  side.tr !== 'cur' ? TR_NAME[side.tr] : null,
  side.wt === 'equal' ? '동일가중' : null,
].filter(Boolean).join(' · ')
function ovMetric(sector, method, key, tr, wt) {
  const k = PLAIN_KEYS.includes(key) ? key : 'rank'
  const base = metricFor(sector, method, k)
  const pset = ovSet(sector, tr, wt)
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
  const name = ovName({ tr, wt })
  return { ...base, key: k, get, label: `${base.label}${name ? ` · ${name}` : ''}` }
}
const sideMetric = (side) => (ovOn(side)
  ? ovMetric(side.sector, side.method, side.metricKey, side.tr || 'cur', side.wt || 'cur')
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
  const on = ovOn(side)
  // 덮어쓰기를 켜거나 끌 때 — 켜지면 부문 종합 값만 남으므로 키를 맞춰 둔다
  const setOv = (patch) => {
    const next = { ...side, ...patch }
    const key = ovOn(next) && !PLAIN_KEYS.includes(next.metricKey) ? 'rank' : next.metricKey
    onChange({ ...next, metricKey: safeKey(next.sector, next.method, key) })
  }
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
      {/* 변환 — 2단계 설정 그대로 쓰거나, 없음·로그화·반로그화를 전 지표에 일괄
          적용해 계산한다(일괄일 때 윈저 없음). 좌우를 달리 두면 변환의 효과가
          지도로 보인다. */}
      <div className="cv-eda" title="변환 · 현재 = 2단계에서 지표마다 정한 변환·윈저 그대로 · 없음/로그화/반로그화 = 모든 지표에 일괄 적용해 다시 계산">
        <u>변환</u>
        {[['cur', '현재'], ['none', '없음'], ['log', '로그화'], ['rlog', '반로그화']].map(([k, name]) => (
          <button key={k} className={(side.tr || 'cur') === k ? 'on' : ''}
            onClick={() => setOv({ tr: k })}>{name}</button>
        ))}
      </div>
      {/* 가중치 — 4단계 가중치 그대로 쓰거나 동일가중으로 되돌려 계산한다 */}
      <div className="cv-eda" title="가중치 · 현재 = 4단계에서 나눈 가중치 · 동일 = 모든 지표 같은 비중으로 다시 계산">
        <u>가중치</u>
        {[['cur', '현재'], ['equal', '동일']].map(([k, name]) => (
          <button key={k} className={(side.wt || 'cur') === k ? 'on' : ''}
            onClick={() => setOv({ wt: k })}>{name}</button>
        ))}
      </div>
      {/* 보는 항목 — 명령바와 같은 두 층 고르기 판(39차). 긴 목록이 접힌다.
          전처리를 덮어쓴 쪽은 부문 종합 값만 고를 수 있다. */}
      <MetricPicker sector={side.sector} method={side.method} value={side.metricKey}
        onChange={(k) => onChange({ ...side, metricKey: k })} align={align} small
        totalOnly={on} />
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
  const [A, setA] = useState(() => ({ sector, method: CAMP_REPS[0], metricKey: safeKey(sector, CAMP_REPS[0], metricKey), hue: 'auto', tr: 'cur', wt: 'cur' }))
  const [B, setB] = useState(() => ({ sector, method: CAMP_REPS[1], metricKey: safeKey(sector, CAMP_REPS[1], metricKey), hue: 'auto', tr: 'cur', wt: 'cur' }))

  const mA = sideMetric(A)
  const mB = sideMetric(B)
  const cA = CAMP[campOf(A.method)]?.color || '#0B93EE'
  const cB = CAMP[campOf(B.method)]?.color || '#F5760D'

  const vA = useMemo(() => valuesOf(mA), [mA])
  const vB = useMemo(() => valuesOf(mB), [mB])
  const changed = useMemo(() => diffCount(mA, mB), [mA, mB])
  const big = useMemo(() => ROWS.filter((r) => r[A.sector]?.ssiCamp >= 10).length, [A.sector, ver])

  const tagA = `${SECTORS[A.sector].name} · ${methodOf(A.method).label}${ovOn(A) ? ` · ${ovName(A)}` : ''}`
  const tagB = `${SECTORS[B.sector].name} · ${methodOf(B.method).label}${ovOn(B) ? ` · ${ovName(B)}` : ''}`

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
