import { useState } from 'react'
import { standardizeSeries } from '../lib/compute.js'
import { SERIES, METHODS, methodOf, indsOf, fmtRaw, SECTORS } from '../lib/ssi.js'
import {
  describe, preprocess, TRANSFORMS,
  cfgOf, setCfg, weightsOf, setWeights, clearWeights,
} from '../lib/eda.js'
import { HistBars, ShapeCompare } from './EdaCharts.jsx'

// 준비 단계 페이지 0~4 — 여정 바에서 열리는 전폭 화면.
//
// 30차에서는 이 내용이 조작부에서 여는 모달이었다. 31차 IA 개편으로 단계마다
// 온전한 페이지 하나를 준다: 페이지 머리(단계 번호·이름·이 단계의 결정 한 줄),
// 본문(한 화면 한 결정), 아래 이동줄(← 이전 · 다음 →). 지도는 여기 없다 —
// 자료를 만지는 동안에는 자료가 주인공이고, 지도는 결과 화면에서 만난다.

const f2 = (v) => (v == null ? '—' : v.toFixed(2))

function PageShell({ no, title, desc, children, nav }) {
  return (
    <div className="stp">
      <div className="stp-head">
        <span className="stp-no">STEP {no} / 5</span>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      <div className="stp-body">{children}</div>
      <div className="stp-nav">{nav}</div>
    </div>
  )
}

export function NavBtns({ onPrev, onNext, nextLabel = '다음 단계 →', prevLabel = '← 이전 단계', nextDisabled = false }) {
  return (
    <>
      {onPrev ? <button className="stp-prev" onClick={onPrev}>{prevLabel}</button> : <span />}
      {onNext && <button className="stp-next" disabled={nextDisabled} onClick={onNext}>{nextLabel}</button>}
    </>
  )
}

/* ══ 0. 지표 선택 ══════════════════════════════════════════════════════════ */
export function Step0Page({ sector, onOpenPicker, onRemovePick, onNext }) {
  const inds = indsOf(sector)
  const years = []
  inds.forEach((e) => { if (!years.includes(e.year)) years.push(e.year) })
  years.sort()
  const yr = years.length === 0 ? '' : years.length === 1 ? `${years[0]}년` : `${years[0]}~${years[years.length - 1]}년`
  return (
    <PageShell no={0} title="지표 선택"
      desc={`${SECTORS[sector].name} 부문에서 계산에 넣을 지표와 연도를 정합니다. 연도가 다른 같은 지표를 함께 담아 비교할 수도 있습니다.`}
      nav={<NavBtns onNext={onNext} nextDisabled={!inds.length}
        nextLabel={inds.length ? '이 지표로 계산 시작 · 지표 탐색 →' : '지표를 골라 주세요'} />}>
      <div className="s0-bar">
        <div className="s0-sum">
          <b>담긴 지표 {inds.length}개</b>
          {yr && <em>{yr}</em>}
        </div>
        <span className="s0-note">카드의 ✕ 로 빼고, 추가·연도 변경은 [＋] 카드에서 합니다.</span>
      </div>
      <div className="stp-cards">
        {inds.map((e, i) => (
          <div key={e.col} className="s0-card">
            <div className="s0-top">
              <u>{i + 1}</u>
              <b>{e.label}</b>
              <em className={`dirb ${e.dir === '+' ? 'p' : 'n'}`}>{e.dir === '+' ? '▲ 높을수록 좋음' : '▼ 낮을수록 좋음'}</em>
              <button className="s0-x" title="이 지표를 조합에서 뺍니다"
                onClick={() => onRemovePick(e.id, e.year)}>✕</button>
            </div>
            <div className="s0-meta">
              <span>{e.year}년</span>
              {e.unit && <span>{e.unit}</span>}
              {e.source && <span className="s0-src" title={e.source}>{e.source}</span>}
            </div>
            {e.desc && <p>{e.desc}</p>}
          </div>
        ))}
        <button className="stp-add" onClick={onOpenPicker}>
          <i>＋</i><b>지표 추가 · 변경</b><span>정의 · 산식 · 출처 · 연도를 보고 골라 담습니다</span>
        </button>
      </div>
    </PageShell>
  )
}

/* ══ 1. 지표 탐색 ══════════════════════════════════════════════════════════ */
export function Step1Page({ sector, onPrev, onNext }) {
  const inds = indsOf(sector)
  return (
    <PageShell no={1} title="지표 탐색"
      desc="지표마다 기술통계와 분포를 보고, 이대로 표준화해도 되는 모양인지 확인합니다. 쏠림이 심하면 다음 단계에서 로그화·반로그화를 겁니다."
      nav={<NavBtns onPrev={onPrev} onNext={onNext} nextLabel="다음 단계 · 변환과 방향 →" />}>
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
                  <em className={`dirb ${e.dir === '+' ? 'p' : 'n'}`}>{e.dir === '+' ? '▲' : '▼'}</em>
                </span>
              </div>
              {e.desc && <p className="e1-desc">{e.desc}</p>}
              <HistBars values={v} h={58}
                marks={[{ v: st.mean, color: '#E8850C' }, { v: st.med, color: '#334155', dash: true }]} />
              <div className="e1-legend"><span><i className="lg-a" />평균 {fmtRaw(st.mean)}</span>
                <span><i className="lg-b" />중위 {fmtRaw(st.med)}</span></div>
              <div className="e1-stats">
                {[['평균', fmtRaw(st.mean)], ['중위', fmtRaw(st.med)], ['최소', fmtRaw(st.lo)], ['최대', fmtRaw(st.hi)],
                  ['표준편차', fmtRaw(st.sd)], ['왜도', f2(st.skew)], ['첨도', f2(st.kurt)],
                  ['결측', st.miss ? `${st.miss}곳` : '없음']].map(([k, v2]) => (
                  <div key={k} className="e1-stat"><u>{k}</u><b>{v2}</b></div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </PageShell>
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

// 변환 선택지에 붙는 작은 모양 그림 — 어떤 분포일 때 쓰는지 말 대신 모양으로
const RX_GLYPH = {
  none: <path d="M3,21 Q14,21 20,8 Q26,-3 32,8 Q38,21 49,21 Z" />,
  log: <path d="M3,21 L3,4 Q8,4 12,12 Q18,21 49,21 Z" />,
  rlog: <path d="M3,21 Q34,21 40,12 Q44,4 49,4 L49,21 Z" />,
}
const RX_DESC = {
  none: '지금 분포 그대로 표준화합니다',
  log: '오른쪽 긴 꼬리를 눌러 몰림을 풉니다',
  rlog: '왼쪽 긴 꼬리를 눌러 몰림을 풉니다',
}

export function Step2Page({ sector, onRecalc, onPrev, onNext }) {
  const inds = indsOf(sector)
  const [help, setHelp] = useState(false)
  const [, setTick] = useState(0)
  const upd = (col, c) => { setCfg(col, c); setTick((t) => t + 1); onRecalc() }

  return (
    <PageShell no={2} title="변환 · 방향"
      desc="지표마다 방향(P/N)을 정하고, 분포 모양을 보며 로그화·반로그화와 윈저라이징을 겁니다. 바꾸는 즉시 그림이 겹쳐 보이고 계산도 다시 됩니다."
      nav={<NavBtns onPrev={onPrev} onNext={onNext} nextLabel="다음 단계 · 표준화 →" />}>
      {inds.map((e, idx) => {
        const c = cfgOf(e.col, e.dir)
        const raw = SERIES[e.col] || []
        const after = preprocess(raw, c)
        const changed = c.transform !== 'none' || c.winsor?.on
        const st0 = describe(raw), st1 = describe(after)
        return (
          <div key={e.col} className="s2-card">
            {/* 머리줄 — 이름 · 메타, 오른쪽에 방향(분포 모양과 무관한 뜻의 문제라 따로) */}
            <div className="s2-head">
              <u>{idx + 1}</u>
              <div className="s2-title">
                <b>{e.label}</b>
                <span>{e.year}년{e.unit ? ` · ${e.unit}` : ''} · 지표체계 방향 {e.dir === '+' ? 'P(▲)' : 'N(▼)'}</span>
              </div>
              <div className="s2-dir">
                <em>방향</em>
                <div className="s2-dirseg">
                  <button className={c.dir === '+' ? 'on p' : ''}
                    onClick={() => upd(e.col, { ...c, dir: '+' })}>P · 커질수록 좋음</button>
                  <button className={c.dir === '-' ? 'on n' : ''}
                    onClick={() => upd(e.col, { ...c, dir: '-' })}>N · 작을수록 좋음</button>
                </div>
                {c.dir !== e.dir && <i className="s2-dirwarn">기본 방향과 다르게 골랐습니다</i>}
              </div>
            </div>

            <div className="s2-body">
              {/* 왼쪽 — 큰 분포 그림이 주인공. 전(점선)/후(실선) 겹침 + 변화량 */}
              <div className="s2-chart">
                <div className="s2-lg">
                  <span><i className="lg-b" />변환 전</span>
                  {changed && <span><i className="lg-a2" />변환 후</span>}
                </div>
                <ShapeCompare before={raw} after={after} changed={changed} W={520} h={104} bins={36} />
                <div className="s2-delta">
                  {changed ? (
                    <>
                      <span>왜도 <b>{f2(st0?.skew)}</b> <i>→</i> <b className="acc">{f2(st1?.skew)}</b></span>
                      <span>범위 <b>{fmtRaw(st0?.lo)}~{fmtRaw(st0?.hi)}</b> <i>→</i> <b className="acc">{fmtRaw(st1?.lo)}~{fmtRaw(st1?.hi)}</b></span>
                    </>
                  ) : (
                    <>
                      <span>왜도 <b>{f2(st0?.skew)}</b></span>
                      <span>범위 <b>{fmtRaw(st0?.lo)} ~ {fmtRaw(st0?.hi)}</b></span>
                      <span className="dim">오른쪽에서 변환을 고르면 바뀐 분포가 파란 실선으로 겹쳐집니다</span>
                    </>
                  )}
                </div>
              </div>

              {/* 오른쪽 — 처방. 변환은 모양 그림이 달린 선택 카드, 윈저는 스위치 한 줄 */}
              <div className="s2-rx">
                <div className="s2-cap">변환
                  <button className="s2-help" onClick={() => setHelp(true)} title="어떤 모양일 때 무엇을 쓰나">? 설명</button>
                </div>
                <div className="s2-opts">
                  {TRANSFORMS.map((t) => (
                    <button key={t.key} className={`s2-opt${c.transform === t.key ? ' on' : ''}`}
                      onClick={() => upd(e.col, { ...c, transform: t.key })}>
                      <svg viewBox="0 0 52 24" className="s2-glyph">{RX_GLYPH[t.key]}</svg>
                      <span><b>{t.label}</b><em>{RX_DESC[t.key]}</em></span>
                      <i className="s2-radio" />
                    </button>
                  ))}
                </div>
                <div className="s2-cap s2-cap2">극단값</div>
                <label className={`s2-wz${c.winsor.on ? ' on' : ''}`}>
                  <input type="checkbox" checked={c.winsor.on}
                    onChange={(ev) => upd(e.col, { ...c, winsor: { ...c.winsor, on: ev.target.checked } })} />
                  <span><b>윈저라이징</b><em>경계 밖 값을 경계값으로 눌러 담습니다</em></span>
                </label>
                {c.winsor.on && (
                  <div className="s2-winz">
                    하위 <input type="number" min="0" max="25" step="0.5" value={c.winsor.lo}
                      onChange={(ev) => upd(e.col, { ...c, winsor: { ...c.winsor, lo: +ev.target.value } })} />%
                    <i>·</i> 상위 <input type="number" min="75" max="100" step="0.5" value={c.winsor.hi}
                      onChange={(ev) => upd(e.col, { ...c, winsor: { ...c.winsor, hi: +ev.target.value } })} />%
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {help && <TransformHelp onClose={() => setHelp(false)} />}
    </PageShell>
  )
}

/* ══ 3. 표준화 ═════════════════════════════════════════════════════════════ */
export function Step3Page({ sector, method, onMethod, onPrev, onNext }) {
  const inds = indsOf(sector)
  const m = methodOf(method)
  return (
    <PageShell no={3} title="표준화"
      desc="변환이 끝난 지표에 네 가지 표준화 방식을 적용해 229개 시군구 표준화값의 분포를 비교합니다. 여기서는 합성하지 않습니다."
      nav={<NavBtns onPrev={onPrev} onNext={onNext} nextLabel="다음 단계 · 가중치 →" />}>
      <p className="stp-lede">열 하나가 방법 하나입니다. 열 머리를 누르면 그 방법이 선택됩니다.
        지금 방법: <b>{m.label}</b> · {m.formula} · 범위 {m.range}</p>
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
    </PageShell>
  )
}

/* ══ 4. 가중치 ═════════════════════════════════════════════════════════════ */
export function Step4Page({ sector, onRecalc, onPrev, onNext }) {
  const inds = indsOf(sector)
  const cols = inds.map((e) => e.col)
  const [, setTick] = useState(0)
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
    <PageShell no={4} title="가중치"
      desc="기본은 동일 가중입니다. 슬라이더로 나누면 나머지 지표가 남은 몫을 비율대로 가져가 합이 항상 100으로 유지됩니다."
      nav={<NavBtns onPrev={onPrev} onNext={onNext} nextLabel="종합점수 보기 · 지도 →" />}>
      <p className="stp-lede">
        <button className="eda-link" onClick={reset}>동일 가중으로 되돌리기</button>
      </p>
      <div className="stp-wbox">
        <div className="e4-head"><span>합계 <b className={Math.abs(total - 100) < 0.5 ? 'ok' : 'warn'}>{r1(total)}</b> / 100</span>
          <span>{w0 ? '사용자 가중 적용 중' : '동일 가중 (현상 유지)'}</span></div>
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
        <p className="eda-note">빈칸(자료 없음)인 지표가 있는 지역은 남은 지표의 가중치를 다시 100으로 맞춰 평균합니다.</p>
      </div>
    </PageShell>
  )
}
