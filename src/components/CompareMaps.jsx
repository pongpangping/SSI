import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NationalMap from './NationalMap.jsx'
import {
  metricFor, methodOf, METHODS, SECTORS, SECTOR_KEYS, CAMP, CAMP_REPS,
  campOf, valuesOf, rowIndex, ROWS, ovSet, indsOf,
} from '../lib/ssi.js'
import { cfgOf, weightOf, TRANSFORMS } from '../lib/eda.js'

// 나란히 보기 — 좌우 지도를 각각 [부문 · 표준화 방법 · 변환 · 가중치]로 정한다.
//
//   변환 토글의 '현재'는 2단계에서 지표마다 정해 둔 설정 그대로라는 뜻이다.
//   '현재'를 누르면 그 설정이 실제로 무엇인지(지표별 변환·윈저·가중치)가
//   작은 표로 열린다. 없음·로그화·반로그화는 전 지표 일괄 적용이고,
//   [지표별] 단추로 지표마다 따로 정할 수도 있다.
//
//   두 지도가 그리는 값은 전국 순위 하나다. 지도 색은 각 지도의 범례
//   상자에서 바꾼다.

const trName = (k) => TRANSFORMS.find((t) => t.key === k)?.label || '변환 없음'
const TR_NAME = { none: '변환 없음', log: '로그화', rlog: '반로그화' }

// 지표 키가 그 부문·방법에 실제로 있는지 확인하고, 없으면 순위로 되돌린다.
const safeSector = (k) => (SECTOR_KEYS.includes(k) ? k : SECTOR_KEYS[0])

// 한쪽의 실효 변환 지도 — 지표별 세부(trMap)가 일괄 토글(tr)보다 우선한다
function effMap(side) {
  const m = {}
  indsOf(side.sector).forEach((e) => {
    const k = side.trMap?.[e.col] ?? side.tr
    if (k && k !== 'cur') m[e.col] = k
  })
  return m
}
const perCount = (side) => indsOf(side.sector)
  .filter((e) => (side.trMap?.[e.col] ?? 'cur') !== 'cur').length

// 이 쪽 지도가 그릴 순위 지표
function sideMetric(side) {
  const base = metricFor(side.sector, side.method, 'rank')
  const m = effMap(side)
  const touched = Object.keys(m).length > 0 || side.wt === 'equal'
  if (!touched) return base
  const pset = ovSet(side.sector, m, side.wt)
  if (!pset) return base
  return { ...base, get: (r, i) => pset.rank[side.method][i], label: `${base.label} · 전처리 변경` }
}
// 딱지에 붙일 전처리 요약
function ovName(side) {
  const parts = []
  const n = perCount(side)
  if (n > 0) parts.push(`지표별 변환 ${n}`)
  else if (side.tr && side.tr !== 'cur') parts.push(TR_NAME[side.tr])
  if (side.wt === 'equal') parts.push('동일가중')
  return parts.join(' · ')
}

// '현재'가 실제로 어떤 상태인지 — 지표별 변환·윈저·방향·가중치 표
function CurTable({ sector, align, onClose }) {
  const inds = indsOf(sector)
  return (
    <>
      <div className="mtp-veil" onClick={onClose} />
      <div className={`cvi-pop${align === 'right' ? ' right' : ''}`}>
        <div className="cvi-h">'현재'의 실제 설정 <em>2 · 4단계에서 정한 값</em></div>
        <div className="cvi-grid">
          <div className="cvi-row head"><b>지표</b><span>방향</span><span>변환</span><span>윈저</span><span>가중치</span></div>
          {inds.map((e) => {
            const c = cfgOf(e.col, e.dir)
            const w = weightOf(sector, e.col, inds.length)
            return (
              <div key={e.col} className="cvi-row">
                <b title={e.label}>{e.label}</b>
                <span>{c.dir === '+' ? 'P ▲' : 'N ▼'}{c.dir !== e.dir ? ' *' : ''}</span>
                <span className={c.transform !== 'none' ? 'hot' : ''}>{trName(c.transform)}</span>
                <span>{c.winsor?.on ? `${c.winsor.lo}~${c.winsor.hi}%` : '—'}</span>
                <span>{Math.round(w * 10) / 10}%</span>
              </div>
            )
          })}
        </div>
        <div className="cvi-f">* 는 기본 방향을 바꾼 지표 · 이 설정을 바꾸는 곳은 2단계(변환·윈저)와 4단계(가중치)입니다</div>
      </div>
    </>
  )
}

// 지표별 변환 세부 — 일괄 토글 대신 지표마다 따로 정한다
function PerIndTable({ side, align, onChange, onClose }) {
  const inds = indsOf(side.sector)
  return (
    <>
      <div className="mtp-veil" onClick={onClose} />
      <div className={`cvi-pop${align === 'right' ? ' right' : ''}`}>
        <div className="cvi-h">지표별 변환 <em>여기서 정한 것이 일괄 토글보다 우선합니다</em></div>
        <div className="cvi-grid">
          {inds.map((e) => {
            const c = cfgOf(e.col, e.dir)
            const cur = side.trMap?.[e.col] ?? 'cur'
            return (
              <div key={e.col} className="cvi-row seg">
                <b title={`'현재' = ${trName(c.transform)}${c.winsor?.on ? ` · 윈저 ${c.winsor.lo}~${c.winsor.hi}%` : ''}`}>{e.label}</b>
                <div className="cv-eda">
                  {[['cur', '현재'], ['none', '없음'], ['log', '로그화'], ['rlog', '반로그화']].map(([k, name]) => (
                    <button key={k} className={cur === k ? 'on' : ''}
                      onClick={() => onChange({ ...side, trMap: { ...side.trMap, [e.col]: k } })}>{name}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="cvi-f">'없음·로그화·반로그화'를 고른 지표는 윈저 없이 그 변환으로만 다시 계산합니다.
          모두 '현재'로 되돌리면 일괄 토글을 따릅니다.</div>
      </div>
    </>
  )
}

function SidePick({ side, onChange, align = 'left' }) {
  const [pop, setPop] = useState(null)          // null | 'cur' | 'per'
  const nPer = perCount(side)
  return (
    <div className="cv-pick">
      <select value={side.sector} title="부문"
        onChange={(e) => onChange({ ...side, sector: safeSector(e.target.value), trMap: {} })}>
        {SECTOR_KEYS.map((k) => <option key={k} value={k}>{SECTORS[k].name}</option>)}
      </select>
      <select value={side.method} title="표준화 방법"
        onChange={(e) => onChange({ ...side, method: e.target.value })}>
        {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select>
      {/* 변환 — '현재'는 2단계 설정 그대로라는 뜻. 누르면 그 실체가 표로 열린다. */}
      <div className="cv-ov" title="변환 · 현재 = 2단계에서 지표마다 정한 설정 그대로(누르면 내용 확인) · 없음/로그화/반로그화 = 전 지표 일괄 적용 · [지표별] = 지표마다 따로">
        <u>변환</u>
        <div className="cv-eda">
          {[['cur', '현재'], ['none', '없음'], ['log', '로그화'], ['rlog', '반로그화']].map(([k, name]) => (
            <button key={k} className={nPer === 0 && (side.tr || 'cur') === k ? 'on' : ''}
              onClick={() => {
                if (k === 'cur') { onChange({ ...side, tr: 'cur', trMap: {} }); setPop(pop === 'cur' ? null : 'cur') }
                else { onChange({ ...side, tr: k, trMap: {} }); setPop(null) }
              }}>{name}</button>
          ))}
          <button className={`per${nPer ? ' on' : ''}`}
            title="지표마다 변환을 따로 정합니다"
            onClick={() => setPop(pop === 'per' ? null : 'per')}>지표별{nPer ? ` ${nPer}` : ''}</button>
        </div>
        {pop === 'cur' && <CurTable sector={side.sector} align={align} onClose={() => setPop(null)} />}
        {pop === 'per' && <PerIndTable side={side} align={align} onChange={onChange} onClose={() => setPop(null)} />}
      </div>
      {/* 가중치 — 4단계 가중치 그대로 쓰거나 동일가중으로 되돌려 계산한다 */}
      <div className="cv-ov" title="가중치 · 현재 = 4단계에서 나눈 가중치 · 동일 = 모든 지표 같은 비중으로 다시 계산">
        <u>가중치</u>
        <div className="cv-eda">
          {[['cur', '현재'], ['equal', '동일']].map(([k, name]) => (
            <button key={k} className={(side.wt || 'cur') === k ? 'on' : ''}
              onClick={() => onChange({ ...side, wt: k })}>{name}</button>
          ))}
        </div>
      </div>
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

  // 처음 열 때는 지금 부문을 물려받고 표준화 방법만 두 진영 대표로 갈라 둔다.
  // 그 뒤로는 사람이 좌우를 직접 바꾼다.
  const [A, setA] = useState(() => ({ sector, method: CAMP_REPS[0], tr: 'cur', trMap: {}, wt: 'cur', hue: 'auto' }))
  const [B, setB] = useState(() => ({ sector, method: CAMP_REPS[1], tr: 'cur', trMap: {}, wt: 'cur', hue: 'auto' }))

  const mA = sideMetric(A)
  const mB = sideMetric(B)
  const cA = CAMP[campOf(A.method)]?.color || '#0B93EE'
  const cB = CAMP[campOf(B.method)]?.color || '#F5760D'

  const vA = useMemo(() => valuesOf(mA), [mA])
  const vB = useMemo(() => valuesOf(mB), [mB])
  const changed = useMemo(() => diffCount(mA, mB), [mA, mB])
  const big = useMemo(() => ROWS.filter((r) => r[A.sector]?.ssiCamp >= 10).length, [A.sector, ver])

  const nameA = ovName(A), nameB = ovName(B)
  const tagA = `${SECTORS[A.sector].name} · ${methodOf(A.method).label}${nameA ? ` · ${nameA}` : ''}`
  const tagB = `${SECTORS[B.sector].name} · ${methodOf(B.method).label}${nameB ? ` · ${nameB}` : ''}`

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
          hue={A.hue === 'auto' ? null : A.hue} onHue={(h) => setA({ ...A, hue: h })}
          onMapReady={register} onToolsReady={tools} ver={ver} />
        <NationalMap sector={B.sector} metric={mB} method={B.method} onlyHigh={onlyHigh}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact tips={false} title={methodOf(B.method).label} subtitle={mB.label}
          hue={B.hue === 'auto' ? null : B.hue} onHue={(h) => setB({ ...B, hue: h })}
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

// 두 지도의 색 구간(7단계)이 다른 시군구 수 — 값에서 직접 계산한다.
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
