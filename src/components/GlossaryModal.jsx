import { useEffect, useState } from 'react'
import { METHODS, CAMP, COLUMNS, META } from '../lib/ssi.js'

const TERMS = [
  { t: 'CI (부문지수, Composite Index)', d: '여러 지표를 표준화한 뒤 동일가중으로 합쳐 만든 값. 예: S1의 CI는 거점화율·거점부 인구집중도 2개 지표를 표준화해 평균 낸 값.' },
  { t: 'SSI (표준화 민감도 지수)', d: '같은 원자료라도 표준화 방법에 따라 시군구 순위가 얼마나 흔들리는지를 나타내는 지수. 클수록 방법 선택에 순위가 크게 달라진다.' },
  { t: 'camp (진영/계열)', d: '4개 표준화 방법이 실제로는 두 진영으로 갈린다: 값의 간격을 보존하는 간격보존형(MinMax·Distance·Logistic)과 등수만 보는 순위전용형(PctRank).' },
  { t: 'SSI_camp (최종 민감도)', d: '두 진영 대표값의 순위 차이. SSI_camp = |순위(MinMax) − 순위(PctRank)|. 4개 방법을 나열 비교하는 대신, 대립하는 두 진영의 차이로 간결하게 재정의한 최종 지표.' },
  { t: '민감구분 (high / low)', d: 'SSI_camp가 부문 내 80백분위 이상이면 high. 대시보드 경고 라벨 및 자동 플래그에 사용.' },
]

export default function GlossaryModal() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('term')
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  const byKind = COLUMNS.reduce((a, c) => { (a[c.kind] ||= []).push(c); return a }, {})

  return (
    <>
      <button className="src-btn" onClick={() => setOpen(true)}>ⓘ 용어 · 방법론</button>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>용어 · 표준화 방법론 · 컬럼사전</h3>
              <button onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="gl-tabs">
              {[['term', '핵심 용어'], ['method', '4개 표준화 방법'], ['col', `컬럼사전 (${COLUMNS.length})`]].map(([k, l]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
            <div className="modal-b">
              {tab === 'term' && <>
                {TERMS.map((x) => <div className="gl-item" key={x.t}><b>{x.t}</b><p>{x.d}</p></div>)}
                <div className="modal-sec">핵심 원리</div>
                <div className="gl-item"><p>
                  ① 지표 1개 단위 순위는 표준화 방법과 무관하게 항상 동일하다(단조변환, Spearman = 1.000).
                  ② 여러 지표를 합치는 CI 단계에서 방법 간 순위 차이가 발생한다 — 각 방법이 값 간격을 서로 다르게 압축·신장하기 때문.
                  전국 {META.n}개 중 약 16%가 방법 선택만으로 10순위 이상 변동했다.
                </p></div>
                <div className="modal-sec">방향 −1 지표의 처리</div>
                <div className="gl-item"><p>{META.reversal}</p></div>
              </>}

              {tab === 'method' && <>
                {Object.entries(CAMP).map(([name, c]) => (
                  <div key={name}>
                    <div className="modal-sec" style={{ color: c.color }}>{name} — {c.desc}</div>
                    {METHODS.filter((m) => m.camp === name).map((m) => (
                      <div className="gl-item" key={m.key}>
                        <b>{m.label}{m.key === c.rep ? ' · 진영 대표' : ''}</b>
                        <p><code>{m.formula}</code></p>
                        <p>범위: {m.range}</p>
                        <p>{m.note}</p>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="modal-sec">Min-Max를 대표로 채택한 근거</div>
                <div className="gl-item"><p>
                  ① 기준점(최솟값·최댓값)이 객관적이다 ② 0~100 전 구간을 써 시각화 대비가 가장 뚜렷하다
                  ③ “최하위 대비 몇 % 수준”이라는 정책 커뮤니케이션이 쉽다 ④ 원 방법론의 우선순위와 일치한다.
                  거리기반은 기준값이 임의적이고 상한이 없어(실측 7.6~241.9) 색 범례 고정이 어렵고,
                  로지스틱은 값이 18.8~80.8로 중간에 몰려 시각적 대비가 떨어진다.
                  LQ(입지지수)는 거리기반 × 100과 수학적으로 동일해 5개 중 제외했다.
                </p></div>
              </>}

              {tab === 'col' && <>
                {Object.entries(byKind).map(([kind, list]) => (
                  <div key={kind}>
                    <div className="modal-sec">{kind} ({list.length})</div>
                    {list.map((c) => (
                      <div className="gl-col" key={c.name}>
                        <b>{c.name}</b>
                        <p>{c.desc}</p>
                        <span>단위/범위 {c.unit} · 산출 {c.how}{c.note ? ` · 비고 ${c.note}` : ''}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>}
            </div>
            <div className="gl-note">
              출처: {META.guide} · CI/SSI_camp 용어설명 · {META.source}({META.sheets.join(' / ')}).
            </div>
          </div>
        </div>
      )}
    </>
  )
}
