import { useMemo, useState } from 'react'
import { describe, winsorize, transform, TRANSFORMS } from '../lib/pipeline.js'
import { fmtRaw } from '../lib/ssi.js'
import { ShapeCompare } from './EdaHist.jsx'

// 2단계 — 변수 변환과 방향 정렬.
//
// 지표마다 세 가지를 정한다.
//   ① 방향  P(커질수록 좋음) / N(작을수록 좋음) — 기본값은 지표체계의 방향.
//   ② 윈저라이징  극단값을 경계 분위수로 눌러 담을지, 담는다면 몇 %에서 자를지.
//   ③ 변환  없음 / 로그화 / 반로그화.
//
// 순서는 윈저라이징 → 변환이다. 꼬리를 먼저 정리해야 로그가 꼬리 한둘에
// 끌려가지 않는다. 방향 뒤집기는 다음 단계(표준화) 직전에 적용되므로
// 여기 그림은 뒤집기 전 분포다.
//
// 그림은 변환 전(점선)과 후(실선)의 분포 '모양'을 겹친다. 눈금이 서로 달라
// 각자 0~1로 눌러 모양만 견준다.

function ExplainModal({ onClose }) {
  return (
    <div className="v3-modal" onClick={onClose}>
      <div className="v3-modal-body" onClick={(e) => e.stopPropagation()}>
        <div className="v3-modal-head">
          <b>로그화 · 반로그화는 언제 쓰나</b>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="ex-grid">
          <div className="ex-cell">
            <svg viewBox="0 0 120 54" className="ex-svg">
              <path d="M4,50 L4,8 Q14,8 22,26 Q34,44 116,49 L116,50 Z" fill="var(--acc)" opacity="0.5" />
            </svg>
            <b>오른쪽 꼬리가 길 때 → 로그화</b>
            <p>대부분 지역은 작은 값에 몰려 있고 소수 지역만 매우 큰 값(왜도 &gt; 0).
              사업체 수·재정 규모처럼 규모형 지표에서 흔하다. 로그화
              (ln(x − 최소 + 1))는 큰 값을 눌러 몰림을 푼다.</p>
          </div>
          <div className="ex-cell">
            <svg viewBox="0 0 120 54" className="ex-svg">
              <path d="M4,50 L4,49 Q86,44 98,26 Q106,8 116,8 L116,50 Z" fill="var(--acc)" opacity="0.5" />
            </svg>
            <b>왼쪽 꼬리가 길 때 → 반로그화</b>
            <p>대부분 지역은 큰 값에 몰려 있고 소수 지역만 매우 작은 값(왜도 &lt; 0).
              충족률·보급률처럼 상한에 붙는 지표에서 흔하다. 반로그화
              (ln(범위 + 1) − ln(최대 − x + 1))는 작은 쪽 꼬리를 눌러 준다.</p>
          </div>
        </div>
        <p className="ex-note">둘 다 순서(등수)는 바꾸지 않는다. 바뀌는 것은 값 사이 간격이므로,
          간격을 쓰는 표준화(Min-Max · 거리기반 · 로지스틱)에서만 결과가 달라지고
          백분위순위에서는 달라지지 않는다. 대칭에 가까운 분포(|왜도| &lt; 0.5)라면 변환 없이 두는 편이 읽기 쉽다.</p>
      </div>
    </div>
  )
}

function Row({ e, values, cfg, onCfg }) {
  const st0 = useMemo(() => describe(values), [values])
  const wz = useMemo(
    () => (cfg.winsor.on ? winsorize(values, cfg.winsor.lo, cfg.winsor.hi) : values),
    [values, cfg.winsor.on, cfg.winsor.lo, cfg.winsor.hi])
  const tr = useMemo(() => transform(wz, cfg.transform), [wz, cfg.transform])
  const st1 = useMemo(() => describe(tr), [tr])
  const changed = cfg.transform !== 'none' || cfg.winsor.on
  const set = (patch) => onCfg(e.col, { ...cfg, ...patch })

  return (
    <div className="g-card e2-row">
      <div className="e2-left">
        <div className="e2-name"><b>{e.label}</b>
          <span className="mono">{e.year}년{e.unit ? ` · ${e.unit}` : ''}</span></div>

        <div className="e2-block">
          <u className="e2-cap">① 방향</u>
          <div className="seg">
            <button className={cfg.dir === '+' ? 'on p' : ''} onClick={() => set({ dir: '+' })}>P 커질수록 좋음</button>
            <button className={cfg.dir === '-' ? 'on n' : ''} onClick={() => set({ dir: '-' })}>N 작을수록 좋음</button>
          </div>
          {cfg.dir !== e.dir && <div className="e2-note warn">지표체계 기본 방향({e.dir === '+' ? 'P' : 'N'})과 다르게 골랐습니다.</div>}
        </div>

        <div className="e2-block">
          <u className="e2-cap">② 윈저라이징</u>
          <div className="seg">
            <button className={!cfg.winsor.on ? 'on' : ''} onClick={() => set({ winsor: { ...cfg.winsor, on: false } })}>안 함</button>
            <button className={cfg.winsor.on ? 'on' : ''} onClick={() => set({ winsor: { ...cfg.winsor, on: true } })}>적용</button>
          </div>
          {cfg.winsor.on && (
            <div className="e2-winz mono">
              하위 <input type="number" min="0" max="25" step="0.5" value={cfg.winsor.lo}
                onChange={(ev) => set({ winsor: { ...cfg.winsor, lo: +ev.target.value } })} />%
              · 상위 <input type="number" min="75" max="100" step="0.5" value={cfg.winsor.hi}
                onChange={(ev) => set({ winsor: { ...cfg.winsor, hi: +ev.target.value } })} />%
              밖을 경계값으로 눌러 담음
            </div>
          )}
        </div>

        <div className="e2-block">
          <u className="e2-cap">③ 변환</u>
          <div className="seg">
            {TRANSFORMS.map((t) => (
              <button key={t.key} className={cfg.transform === t.key ? 'on' : ''}
                onClick={() => set({ transform: t.key })}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="e2-right">
        <ShapeCompare before={values} after={tr} changed={changed} color="var(--acc)" />
        <div className="e1-legend mono">
          <span><i className="lg-dash" />변환 전</span>
          {changed && <span><i className="lg-solid" />변환 후</span>}
          {!changed && <span className="dim">아직 그대로</span>}
        </div>
        <div className="e2-nums mono">
          <span>왜도 {st0?.skew == null ? '—' : st0.skew.toFixed(2)}
            {changed && st1?.skew != null && <b> → {st1.skew.toFixed(2)}</b>}</span>
          <span>범위 {st0 ? `${fmtRaw(st0.lo)} ~ ${fmtRaw(st0.hi)}` : '—'}
            {changed && st1 && <b> → {fmtRaw(st1.lo)} ~ {fmtRaw(st1.hi)}</b>}</span>
        </div>
      </div>
    </div>
  )
}

export default function Step2Transform({ entries, seriesOf, cfg, onCfg }) {
  const [help, setHelp] = useState(false)
  if (!entries.length) return <div className="v3-empty">0단계에서 지표를 먼저 골라 주세요.</div>
  return (
    <div className="e2-wrap">
      <div className="v3-lede">
        지표마다 방향(P/N) · 윈저라이징 · 변환을 정합니다. 점선이 변환 전, 실선이 변환 후 분포입니다.
        <button className="ghost-btn" onClick={() => setHelp(true)}>어떤 모양일 때 무엇을 쓰나 — 설명</button>
      </div>
      {entries.map((e) => (
        <Row key={e.col} e={e} values={seriesOf(e.col)} cfg={cfg[e.col]} onCfg={onCfg} />
      ))}
      {help && <ExplainModal onClose={() => setHelp(false)} />}
    </div>
  )
}
