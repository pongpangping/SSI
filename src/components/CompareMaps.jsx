import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NationalMap from './NationalMap.jsx'
import {
  metricFor, methodOf, METHODS, SECTORS, CAMP, CAMP_REPS,
  campOf, valuesOf, rowIndex, ROWS, ovSet, indsOf,
} from '../lib/ssi.js'
import { cfgOf, weightOf, TRANSFORMS } from '../lib/eda.js'

// 나란히 보기.
//
// 왼쪽은 기준 — 지금 화면의 부문·표준화 방법·전처리(2단계 변환·윈저,
// 4단계 가중치)를 그대로 쓴 계산이다. 고정 비교대상이므로 바꿀 것이 없고,
// [지금 설정 보기]로 지표마다 어떤 변환이 걸려 있는지 확인만 한다.
//
// 오른쪽은 실험 — 표준화 방법을 고르고, [전처리 바꿔 계산]에서 지표마다
// 변환(지금 그대로 · 없음 · 로그화 · 반로그화)을 따로 정해 다시 계산한다.
// 가중치도 지금 것 그대로 쓸지 동일가중으로 되돌릴지 고른다.
//
// 두 지도가 그리는 값은 전국 순위 하나로 고정한다 — 비교의 관심은
// "설정을 바꾸면 순위가 어떻게 움직이는가"이고, 값의 종류까지 좌우가
// 다르면 색 차이가 무엇 때문인지 읽을 수 없다.
// 지도 색은 각 지도의 범례 상자에서 바꾼다.

const trName = (k) => TRANSFORMS.find((t) => t.key === k)?.label || '변환 없음'

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

// 실험 쪽 순위 지표 — 지표별 변환 덮어쓰기·가중치를 반영해 다시 계산한 순위
function expMetric(sector, method, trMap, wt) {
  const base = metricFor(sector, method, 'rank')
  const touched = wt === 'equal' || Object.values(trMap || {}).some((v) => v && v !== 'cur')
  if (!touched) return base
  const pset = ovSet(sector, cleanMap(trMap), wt)
  if (!pset) return base
  return { ...base, get: (r, i) => pset.rank[method][i], label: `${base.label} · 전처리 변경` }
}
const cleanMap = (m) => Object.fromEntries(Object.entries(m || {}).filter(([, v]) => v && v !== 'cur'))

// 왼쪽 — 지금 설정 요약 팝업
function CurInfo({ sector, method }) {
  const [open, setOpen] = useState(false)
  const inds = indsOf(sector)
  return (
    <div className="cvi-wrap">
      <button className={`cvi-btn${open ? ' on' : ''}`} onClick={() => setOpen(!open)}>지금 설정 보기</button>
      {open && (
        <>
          <div className="mtp-veil" onClick={() => setOpen(false)} />
          <div className="cvi-pop">
            <div className="cvi-h">기준 지도가 쓰는 설정 <em>{methodOf(method).label}</em></div>
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
            <div className="cvi-f">* 는 기본 방향을 바꾼 지표 · 이 설정은 2 · 4단계에서 바꿉니다</div>
          </div>
        </>
      )}
    </div>
  )
}

// 오른쪽 — 지표별 전처리 바꿔 계산 팝업
function PrepEditor({ sector, trMap, wt, onChange }) {
  const [open, setOpen] = useState(false)
  const inds = indsOf(sector)
  const nCh = Object.values(cleanMap(trMap)).length + (wt === 'equal' ? 1 : 0)
  return (
    <div className="cvi-wrap">
      <button className={`cvi-btn${nCh ? ' hot' : ''}${open ? ' on' : ''}`} onClick={() => setOpen(!open)}>
        전처리 바꿔 계산{nCh ? ` · ${nCh}` : ''}
      </button>
      {open && (
        <>
          <div className="mtp-veil" onClick={() => setOpen(false)} />
          <div className="cvi-pop">
            <div className="cvi-h">실험 지도의 전처리 <em>지표마다 따로 정합니다</em></div>
            <div className="cvi-grid">
              {inds.map((e) => {
                const cur = trMap?.[e.col] || 'cur'
                const c = cfgOf(e.col, e.dir)
                return (
                  <div key={e.col} className="cvi-row seg">
                    <b title={`지금 설정: ${trName(c.transform)}${c.winsor?.on ? ` · 윈저 ${c.winsor.lo}~${c.winsor.hi}%` : ''}`}>{e.label}</b>
                    <div className="cv-eda">
                      {[['cur', '지금 그대로'], ['none', '없음'], ['log', '로그화'], ['rlog', '반로그화']].map(([k, name]) => (
                        <button key={k} className={cur === k ? 'on' : ''}
                          onClick={() => onChange({ trMap: { ...trMap, [e.col]: k }, wt })}>{name}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="cvi-row seg">
                <b>가중치</b>
                <div className="cv-eda">
                  {[['cur', '지금 그대로'], ['equal', '동일가중']].map(([k, name]) => (
                    <button key={k} className={(wt || 'cur') === k ? 'on' : ''}
                      onClick={() => onChange({ trMap, wt: k })}>{name}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cvi-f">'없음·로그화·반로그화'를 고른 지표는 윈저 없이 그 변환으로만 다시 계산합니다.
              모두 '지금 그대로'면 왼쪽과 같은 계산입니다.</div>
          </div>
        </>
      )}
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

  // 왼쪽은 지금 방법 그대로(기준). 오른쪽은 처음에 다른 진영 대표로 갈라 두고,
  // 그 뒤로는 사람이 방법·전처리를 바꾼다.
  const [expMethod, setExpMethod] = useState(() =>
    (method === CAMP_REPS[0] ? CAMP_REPS[1] : CAMP_REPS[0]))
  const [trMap, setTrMap] = useState({})
  const [wt, setWt] = useState('cur')
  const [hueA, setHueA] = useState('auto')
  const [hueB, setHueB] = useState('auto')

  const mA = metricFor(sector, method, 'rank')
  const mB = expMetric(sector, expMethod, trMap, wt)
  const cA = CAMP[campOf(method)]?.color || '#0B93EE'
  const cB = CAMP[campOf(expMethod)]?.color || '#F5760D'

  const vA = useMemo(() => valuesOf(mA), [mA])
  const vB = useMemo(() => valuesOf(mB), [mB])
  const changed = useMemo(() => diffCount(mA, mB), [mA, mB])
  const big = useMemo(() => ROWS.filter((r) => r[sector]?.ssiCamp >= 10).length, [sector, ver])

  const nCh = Object.values(cleanMap(trMap)).length
  const tagA = `기준 · ${methodOf(method).label} · 지금 설정`
  const tagB = `실험 · ${methodOf(expMethod).label}${nCh ? ` · 변환 바꾼 지표 ${nCh}` : ''}${wt === 'equal' ? ' · 동일가중' : ''}`

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
      {/* 왼쪽 = 기준(고정) · 오른쪽 = 실험(방법·전처리) */}
      <div className="cv-free">
        <div className="cv-pick">
          <span className="cv-fix"><b>기준</b>{SECTORS[sector].name} · {methodOf(method).label}</span>
          <CurInfo sector={sector} method={method} />
        </div>
        <span className="cv-vs">대비</span>
        <div className="cv-pick">
          <span className="cv-fix exp"><b>실험</b>표준화 방법</span>
          <select value={expMethod} title="실험 지도의 표준화 방법"
            onChange={(e) => setExpMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <PrepEditor sector={sector} trMap={trMap} wt={wt}
            onChange={({ trMap: t, wt: w }) => { setTrMap(t); setWt(w) }} />
        </div>
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
        <NationalMap sector={sector} metric={mA} method={method} onlyHigh={onlyHigh}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact tips={false} title={`기준 · ${methodOf(method).label}`} subtitle={mA.label}
          hue={hueA === 'auto' ? null : hueA} onHue={setHueA}
          onMapReady={register} onToolsReady={tools} ver={ver} />
        <NationalMap sector={sector} metric={mB} method={expMethod} onlyHigh={onlyHigh}
          selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover}
          compact tips={false} title={`실험 · ${methodOf(expMethod).label}`} subtitle={mB.label}
          hue={hueB === 'auto' ? null : hueB} onHue={setHueB}
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
            <i /><span>기준 순위</span><b>{mA.fmt(vA[hi])}</b>
          </div>
          <div className="cp-r" style={{ '--c': cB }}>
            <i /><span>실험 순위</span><b>{mB.fmt(vB[hi])}</b>
          </div>
          <div className="cp-f">
            순위 이동 {hRow[sector]?.ssiCamp ?? '—'}계단
            {hRow[sector]?.flag === 'high' && <em>민감</em>}
          </div>
        </div>
      )}
    </div>
  )
}
