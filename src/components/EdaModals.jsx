import { useEffect, useMemo, useState } from 'react'
import { standardizeSeries } from '../lib/compute.js'
import { SERIES, METHODS, methodOf, indsOf, fmtRaw, SECTORS } from '../lib/ssi.js'
import {
  describe, histogram, preprocess, TRANSFORMS,
  cfgOf, setCfg, weightsOf, setWeights, clearWeights,
} from '../lib/eda.js'

// EDA 단계 모달 넷 — 작업요령의 1~4단계를 21차 구조 위에 얹는다.
//
//   지표 탐색     기술통계 + 분포 히스토그램 (지표 전부 한 화면)
//   변환·방향     P/N · 윈저라이징 · 로그화/반로그화, 전(점선)/후(실선) 분포
//   방법별 분포   지표 × 4방법 표준화값 분포 격자 — 열 머리를 눌러 방법 선택
//   가중치       합 100 분할 (기본 동일 가중)
//
// 어느 모달에서 무엇을 바꾸든 즉시 다시 계산되어(onRecalc) 지도·통계창·
// 데이터표·내려받기가 전부 같은 값을 쓴다.

const num = (x) => x != null && Number.isFinite(x)
const f1 = (v) => (v == null ? '—' : v.toFixed(1))
const f2 = (v) => (v == null ? '—' : v.toFixed(2))

function Shell({ title, sub, onClose, wide = false, children }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="eda-veil" onClick={onClose}>
      <div className={`eda-box${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="eda-head">
          <div><b>{title}</b>{sub && <em>{sub}</em>}</div>
          <button className="eda-x" onClick={onClose} title="닫기 (Esc)">✕</button>
        </div>
        <div className="eda-body">{children}</div>
      </div>
    </div>
  )
}

// ── 분포 그림 ───────────────────────────────────────────────────────────────
function HistBars({ values, bins = 26, h = 80, marks = [] }) {
  const H = useMemo(() => histogram(values, bins), [values, bins])
  if (!H.bins.length || !H.max) return <div className="eda-empty">자료 없음</div>
  const W = 260, bw = W / bins, d = (H.hi - H.lo) || 1
  return (
    <svg className="eda-hist" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
      {H.bins.map((c, i) => (c ? (
        <rect key={i} x={i * bw + 0.7} y={h - Math.max(1.5, (c / H.max) * (h - 6))}
          width={bw - 1.4} height={Math.max(1.5, (c / H.max) * (h - 6))}
          rx="1" fill="#0B93EE" opacity={0.32 + 0.68 * (c / H.max)} />
      ) : null))}
      {marks.map((m, i) => (num(m.v) ? (
        <line key={`m${i}`} x1={((m.v - H.lo) / d) * W} x2={((m.v - H.lo) / d) * W} y1={2} y2={h}
          stroke={m.color || '#0F172A'} strokeWidth="1" strokeDasharray={m.dash ? '3 3' : 'none'} opacity="0.85" />
      ) : null))}
    </svg>
  )
}

function shapePath(values, bins, W, h) {
  const H = histogram(values, bins)
  if (!H.max) return null
  const pts = H.bins.map((c, i) =>
    `${(((i + 0.5) / bins) * W).toFixed(1)},${(h - 3 - (c / H.max) * (h - 10)).toFixed(1)}`)
  return `M0,${h - 3} L${pts.join(' L')} L${W},${h - 3}`
}
function ShapeCompare({ before, after, changed }) {
  const W = 300, h = 92
  const pb = useMemo(() => shapePath(before, 30, W, h), [before])
  const pa = useMemo(() => (changed ? shapePath(after, 30, W, h) : null), [after, changed])
  if (!pb) return <div className="eda-empty">자료 없음</div>
  return (
    <svg className="eda-hist" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
      <line x1="0" x2={W} y1={h - 3} y2={h - 3} stroke="rgba(15,23,42,0.18)" strokeWidth="1" />
      <path d={pb} fill="rgba(15,23,42,0.05)" stroke="rgba(15,23,42,0.5)" strokeWidth="1.3" strokeDasharray="4 3" />
      {pa && <path d={pa} fill="rgba(11,147,238,0.13)" stroke="#0B93EE" strokeWidth="1.8" />}
    </svg>
  )
}

/* ══ 1. 지표 탐색 ══════════════════════════════════════════════════════════ */
export function ExploreModal({ sector, onClose }) {
  const inds = indsOf(sector)
  return (
    <Shell title="지표 탐색" wide onClose={onClose}
      sub={`${SECTORS[sector].name} · 지표 ${inds.length}개 · 기술통계와 분포`}>
      <p className="eda-lede">여기서 읽을 것은 하나입니다 — 이 지표, 이대로 표준화해도 되는 분포인가.
        쏠림이 심하면 다음 칸(변환·방향)에서 로그화·반로그화를 겁니다.</p>
      <div className="e1-grid">
        {inds.map((e) => {
          const v = SERIES[e.col] || []
          const st = describe(v)
          if (!st) return null
          return (
            <div key={e.col} className="e1-card">
              <div className="e1-head">
                <b>{e.label}</b>
                <span className="e1-tags">
                  <em>{e.year}년</em>{e.unit && <em>{e.unit}</em>}
                  <em className={`dirb ${e.dir === '+' ? 'p' : 'n'}`}>{e.dir === '+' ? '▲ 높을수록' : '▼ 낮을수록'}</em>
                </span>
              </div>
              {e.desc && <p className="e1-desc">{e.desc}</p>}
              <HistBars values={v}
                marks={[{ v: st.mean, color: '#E8850C' }, { v: st.med, color: '#334155', dash: true }]} />
              <div className="e1-legend"><span><i className="lg-a" />평균 {fmtRaw(st.mean)}</span>
                <span><i className="lg-b" />중위 {fmtRaw(st.med)}</span></div>
              <div className="e1-stats">
                {[['평균', fmtRaw(st.mean)], ['중위', fmtRaw(st.med)], ['최소', fmtRaw(st.lo)], ['최대', fmtRaw(st.hi)],
                  ['표준편차', fmtRaw(st.sd)], ['왜도', f2(st.skew)], ['첨도', f2(st.kurt)],
                  ['결측', st.miss ? `${st.miss}곳` : '없음']].map(([k2, v2]) => (
                  <div key={k2} className="e1-stat"><u>{k2}</u><b>{v2}</b></div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

/* ══ 2. 변환 · 방향 ════════════════════════════════════════════════════════ */
function TransformHelp({ onClose }) {
  return (
    <div className="eda-veil deep" onClick={onClose}>
      <div className="eda-box" onClick={(e) => e.stopPropagation()}>
        <div className="eda-head"><div><b>로그화 · 반로그화는 언제 쓰나</b></div>
          <button className="eda-x" onClick={onClose}>✕</button></div>
        <div className="eda-body">
          <div className="ex-grid">
            <div className="ex-cell">
              <svg viewBox="0 0 120 54" className="ex-svg">
                <path d="M4,50 L4,8 Q14,8 22,26 Q34,44 116,49 L116,50 Z" fill="#0B93EE" opacity="0.5" /></svg>
              <b>오른쪽 꼬리가 길 때 → 로그화</b>
              <p>대부분 지역은 작은 값에 몰려 있고 소수 지역만 매우 큰 값(왜도 &gt; 0).
                규모형 지표에서 흔합니다. 로그화(ln(x − 최소 + 1))가 큰 값을 눌러 몰림을 풉니다.</p>
            </div>
            <div className="ex-cell">
              <svg viewBox="0 0 120 54" className="ex-svg">
                <path d="M4,50 L4,49 Q86,44 98,26 Q106,8 116,8 L116,50 Z" fill="#0B93EE" opacity="0.5" /></svg>
              <b>왼쪽 꼬리가 길 때 → 반로그화</b>
              <p>대부분 지역은 큰 값에 몰려 있고 소수 지역만 매우 작은 값(왜도 &lt; 0).
                충족률·보급률처럼 상한에 붙는 지표에서 흔합니다. 반로그화가 작은 쪽 꼬리를 눌러 줍니다.</p>
            </div>
          </div>
          <p className="eda-note">둘 다 순서(등수)는 바꾸지 않습니다. 간격을 쓰는 방법(Min-Max · 거리기반 ·
            로지스틱)에서만 결과가 달라지고 백분위순위는 그대로입니다. |왜도| &lt; 0.5면 변환 없이 두는 편이 읽기 쉽습니다.</p>
        </div>
      </div>
    </div>
  )
}

export function TransformModal({ sector, onRecalc, onClose }) {
  const inds = indsOf(sector)
  const [help, setHelp] = useState(false)
  const [tick, setTick] = useState(0)          // 저장소 변경 후 다시 그리기
  const upd = (col, c) => { setCfg(col, c); setTick((t) => t + 1); onRecalc() }

  return (
    <Shell title="변환 · 방향" wide onClose={onClose}
      sub={`${SECTORS[sector].name} · 지표마다 방향(P/N) · 윈저라이징 · 로그화/반로그화`}>
      <p className="eda-lede">점선이 변환 전, 실선이 변환 후 분포입니다. 바꾸는 즉시 지도와 통계가 다시 계산됩니다.
        <button className="eda-link" onClick={() => setHelp(true)}>어떤 모양일 때 무엇을 쓰나 — 설명</button></p>
      {inds.map((e) => {
        const c = cfgOf(e.col, e.dir)
        const raw = SERIES[e.col] || []
        const after = preprocess(raw, c)
        const changed = c.transform !== 'none' || c.winsor?.on
        const st0 = describe(raw), st1 = describe(after)
        return (
          <div key={e.col} className="e2-row" data-tick={tick}>
            <div className="e2-left">
              <div className="e2-name"><b>{e.label}</b>
                <span>{e.year}년{e.unit ? ` · ${e.unit}` : ''} · 지표체계 방향 {e.dir === '+' ? 'P' : 'N'}</span></div>
              <div className="e2-block">
                <u className="e2-cap">① 방향</u>
                <div className="seg">
                  <button className={c.dir === '+' ? 'on p' : ''}
                    onClick={() => upd(e.col, { ...c, dir: '+' })}>P 커질수록 좋음</button>
                  <button className={c.dir === '-' ? 'on n' : ''}
                    onClick={() => upd(e.col, { ...c, dir: '-' })}>N 작을수록 좋음</button>
                </div>
                {c.dir !== e.dir && <div className="e2-note warn">지표체계 기본 방향과 다르게 골랐습니다.</div>}
              </div>
              <div className="e2-block">
                <u className="e2-cap">② 윈저라이징 — 극단값 눌러 담기</u>
                <div className="seg">
                  <button className={!c.winsor.on ? 'on' : ''}
                    onClick={() => upd(e.col, { ...c, winsor: { ...c.winsor, on: false } })}>안 함</button>
                  <button className={c.winsor.on ? 'on' : ''}
                    onClick={() => upd(e.col, { ...c, winsor: { ...c.winsor, on: true } })}>적용</button>
                </div>
                {c.winsor.on && (
                  <div className="e2-winz">
                    하위 <input type="number" min="0" max="25" step="0.5" value={c.winsor.lo}
                      onChange={(ev) => upd(e.col, { ...c, winsor: { ...c.winsor, lo: +ev.target.value } })} />%
                    · 상위 <input type="number" min="75" max="100" step="0.5" value={c.winsor.hi}
                      onChange={(ev) => upd(e.col, { ...c, winsor: { ...c.winsor, hi: +ev.target.value } })} />%
                    밖을 경계값으로
                  </div>
                )}
              </div>
              <div className="e2-block">
                <u className="e2-cap">③ 변환</u>
                <div className="seg">
                  {TRANSFORMS.map((t) => (
                    <button key={t.key} className={c.transform === t.key ? 'on' : ''}
                      onClick={() => upd(e.col, { ...c, transform: t.key })}>{t.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="e2-right">
              <ShapeCompare before={raw} after={after} changed={changed} />
              <div className="e1-legend"><span><i className="lg-b" />변환 전</span>
                {changed ? <span><i className="lg-a2" />변환 후</span> : <span className="dim">아직 그대로</span>}</div>
              <div className="e2-nums">
                <span>왜도 {f2(st0?.skew)}{changed && st1 && <b> → {f2(st1.skew)}</b>}</span>
                <span>범위 {st0 ? `${fmtRaw(st0.lo)} ~ ${fmtRaw(st0.hi)}` : '—'}
                  {changed && st1 && <b> → {fmtRaw(st1.lo)} ~ {fmtRaw(st1.hi)}</b>}</span>
              </div>
            </div>
          </div>
        )
      })}
      {help && <TransformHelp onClose={() => setHelp(false)} />}
    </Shell>
  )
}

/* ══ 3. 방법별 분포 비교 ═══════════════════════════════════════════════════ */
export function StdCompareModal({ sector, method, onMethod, onClose }) {
  const inds = indsOf(sector)
  const m = methodOf(method)
  return (
    <Shell title="표준화 — 방법별 분포 비교" wide onClose={onClose}
      sub={`${SECTORS[sector].name} · 229개 시군구 표준화값 분포 · 지표 × 4방법 (합성 전)`}>
      <p className="eda-lede">열 하나가 방법 하나입니다. 열 머리를 누르면 그 방법이 선택되고
        지도·통계가 곧바로 따라 바뀝니다. 지금 방법: <b>{m.label}</b> · {m.formula}</p>
      <div className="e3-grid" style={{ '--mcols': METHODS.length }}>
        <div className="e3-hrow">
          <div className="e3-hname">지표</div>
          {METHODS.map((mm) => (
            <button key={mm.key} className={`e3-hcell${method === mm.key ? ' cur' : ''}`}
              onClick={() => onMethod(mm.key)} title={`${mm.formula} · 범위 ${mm.range}`}>
              <i className="e3-dot" /><b>{mm.label}</b><span>{mm.range}</span>
            </button>
          ))}
        </div>
        {inds.map((e) => {
          const c = cfgOf(e.col, e.dir)
          const pre = preprocess(SERIES[e.col] || [], c)
          return (
            <div key={e.col} className="e3-row">
              <div className="e3-name">
                <b>{e.label}</b>
                <span>
                  {c.transform !== 'none' && <em>{c.transform === 'log' ? '로그화' : '반로그화'}</em>}
                  {c.winsor?.on && <em>윈저 {c.winsor.lo}·{c.winsor.hi}%</em>}
                  <em className={c.dir === '+' ? 'p' : 'n'}>{c.dir === '+' ? 'P' : 'N'}</em>
                </span>
              </div>
              {METHODS.map((mm) => (
                <div key={mm.key} className={`e3-cell${method === mm.key ? ' cur' : ''}`}>
                  <HistBars values={standardizeSeries(pre, c.dir, mm.key)} bins={22} h={54} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

/* ══ 4. 가중치 ═════════════════════════════════════════════════════════════ */
export function WeightModal({ sector, onRecalc, onClose }) {
  const inds = indsOf(sector)
  const cols = inds.map((e) => e.col)
  const [tick, setTick] = useState(0)
  const w0 = weightsOf(sector)
  const cur = cols.map((c) => (w0 && Number.isFinite(w0[c]) ? w0[c] : 100 / (cols.length || 1)))
  const total = cur.reduce((a, b) => a + b, 0)
  const r1 = (x) => Math.round(x * 10) / 10

  const setOne = (idx, v) => {
    const val = Math.max(0, Math.min(100, v))
    const restSum = cur.reduce((a, b, i) => (i === idx ? a : a + b), 0)
    const next = {}
    cols.forEach((c, i) => {
      next[c] = i === idx ? r1(val)
        : r1(restSum > 0 ? cur[i] * (100 - val) / restSum : (100 - val) / (cols.length - 1))
    })
    setWeights(sector, next)
    setTick((t) => t + 1)
    onRecalc()
  }
  const reset = () => { clearWeights(sector); setTick((t) => t + 1); onRecalc() }

  return (
    <Shell title="가중치" onClose={onClose}
      sub={`${SECTORS[sector].name} · 기본 동일 가중 · 합은 항상 100`}>
      <p className="eda-lede" data-tick={tick}>슬라이더를 움직이면 나머지 지표가 남은 몫을 비율대로 나눠 가집니다.
        <button className="eda-link" onClick={reset}>동일 가중으로 되돌리기</button></p>
      <div className="e4-head"><span>합계 <b className={Math.abs(total - 100) < 0.5 ? 'ok' : 'warn'}>{r1(total)}</b> / 100</span>
        <span>{w0 ? '사용자 가중' : '동일 가중 (현상 유지)'}</span></div>
      {inds.map((e, i) => (
        <div key={e.col} className="e4-row">
          <div className="e4-name"><b>{e.label}</b><span>{e.year}년</span></div>
          <input type="range" min="0" max="100" step="0.5" value={cur[i]}
            onChange={(ev) => setOne(i, +ev.target.value)} />
          <label className="e4-num">
            <input type="number" min="0" max="100" step="0.5" value={r1(cur[i])}
              onChange={(ev) => setOne(i, +ev.target.value)} />%
          </label>
        </div>
      ))}
      <p className="eda-note">빈칸(자료 없음)인 지표가 있는 지역은 남은 지표의 가중치를 다시 100으로 맞춰 평균합니다.
        가중치를 바꾸면 부문지수·순위·민감도가 모두 다시 계산됩니다.</p>
    </Shell>
  )
}
