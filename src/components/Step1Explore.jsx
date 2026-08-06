import { useMemo } from 'react'
import { describe } from '../lib/pipeline.js'
import { fmtRaw } from '../lib/ssi.js'
import { HistBars } from './EdaHist.jsx'

// 1단계 — 부문 내 지표 탐색 (EDA).
//
// 고른 지표 전부를 한 화면에 카드로 늘어놓는다. 카드마다 기술통계와 분포
// 히스토그램을 함께 둔다 — 통계값만 있으면 쏠림이 눈에 안 들어오고, 그림만
// 있으면 수치를 못 옮겨 적기 때문이다.
//
// 여기서 읽어야 할 것은 하나다: "이 지표, 이대로 표준화해도 되는 분포인가."
// 왜도가 크면 카드가 스스로 말을 얹는다(→ 2단계에서 로그화·반로그화).

const SK = (s) => {
  if (s == null) return { t: '왜도 계산 불가', cls: '' }
  if (s >= 1) return { t: `오른쪽 꼬리가 길다 (왜도 +${s.toFixed(2)}) → 로그화 고려`, cls: 'warn' }
  if (s <= -1) return { t: `왼쪽 꼬리가 길다 (왜도 ${s.toFixed(2)}) → 반로그화 고려`, cls: 'warn' }
  if (Math.abs(s) >= 0.5) return { t: `약한 쏠림 (왜도 ${s > 0 ? '+' : ''}${s.toFixed(2)})`, cls: 'mild' }
  return { t: `대칭에 가까움 (왜도 ${s > 0 ? '+' : ''}${s.toFixed(2)})`, cls: 'ok' }
}

function Card({ e, values }) {
  const st = useMemo(() => describe(values), [values])
  if (!st) return null
  const sk = SK(st.skew)
  const rows = [
    ['평균', fmtRaw(st.mean)], ['중위', fmtRaw(st.med)],
    ['최소', fmtRaw(st.lo)], ['최대', fmtRaw(st.hi)],
    ['표준편차', fmtRaw(st.sd)], ['왜도', st.skew == null ? '—' : st.skew.toFixed(2)],
    ['첨도', st.kurt == null ? '—' : st.kurt.toFixed(2)], ['결측', st.miss ? `${st.miss}곳` : '없음'],
  ]
  return (
    <div className="g-card e1-card">
      <div className="e1-head">
        <b>{e.label}</b>
        <span className="e1-tags">
          <em className="mono">{e.year}년</em>
          {e.unit && <em className="mono">{e.unit}</em>}
          <em className={`dirb ${e.dir === '+' ? 'p' : 'n'}`}>{e.dir === '+' ? 'P 높을수록 좋음' : 'N 낮을수록 좋음'}</em>
        </span>
      </div>
      {e.desc && <p className="e1-desc">{e.desc}</p>}
      <HistBars values={values} color="var(--acc)"
        marks={[{ v: st.mean, color: 'var(--acc2)' }, { v: st.med, color: '#ffffff', dash: true }]} />
      <div className="e1-legend mono">
        <span><i className="lg-solid" />평균 {fmtRaw(st.mean)}</span>
        <span><i className="lg-dash" />중위 {fmtRaw(st.med)}</span>
      </div>
      <div className="e1-stats">
        {rows.map(([k, v]) => (
          <div key={k} className="e1-stat"><u>{k}</u><b className="mono">{v}</b></div>
        ))}
      </div>
      <div className={`e1-skew ${sk.cls}`}>{sk.t}</div>
    </div>
  )
}

export default function Step1Explore({ entries, seriesOf }) {
  if (!entries.length) return <div className="v3-empty">0단계에서 지표를 먼저 골라 주세요.</div>
  return (
    <div className="e1-wrap">
      <div className="v3-lede">
        지표 {entries.length}개의 분포를 그대로 펼쳐 놓았습니다. 통계값과 히스토그램을 보고,
        쏠림이 심한 지표는 다음 단계에서 변환(로그화·반로그화)을 걸지 정합니다.
      </div>
      <div className="e1-grid">
        {entries.map((e) => <Card key={e.col} e={e} values={seriesOf(e.col)} />)}
      </div>
    </div>
  )
}
