import { useEffect, useState } from 'react'
import { METHODS, CAMP, META, N } from '../lib/ssi.js'
import { Cross } from './Glyph.jsx'

// 지표 사전 탭은 뺐다 — 지표의 정의·산식·출처는 머리줄의 '데이터 설명'이
// 지금 고른 지표 기준으로 이미 보여 준다. 같은 정보가 두 곳에 있으면
// 어느 쪽이 맞는지부터 의심하게 된다. 여기는 용어와 방법론만 남는다.

const TERMS = [
  { t: 'CI (부문지수, Composite Index)', d: '선택 지표들을 표준화한 뒤 같은 비중으로 평균해 만든 값. 선택 지표를 바꾸면 CI도 바뀐다.' },
  { t: 'SSI (표준화 민감도 지수)', d: '같은 원자료라도 표준화 방법에 따라 시군구 순위가 얼마나 흔들리는지를 나타내는 지수. 클수록 방법 선택에 순위가 크게 달라진다.' },
  { t: 'camp (진영)', d: '4개 표준화 방법이 실제로는 두 진영으로 갈린다: 값의 간격을 보존하는 간격보존형(Min-Max·거리기반·로지스틱)과 등수만 보는 순위전용형(백분위순위).' },
  { t: 'SSI_camp (최종 민감도)', d: '두 진영 대표값의 순위 차이. SSI_camp = |순위(Min-Max) − 순위(백분위순위)|. 4개 방법을 나열 비교하는 대신, 대립하는 두 진영의 차이로 간결하게 재정의한 최종 지표.' },
  { t: '민감구분 (high / mid / low)', d: '순위가 10계단 넘게 흔들리면 high, 5계단 이상이면 mid. 지도의 “민감 지역만 보기”가 high를 고른다.' },
  { t: '표준점수 (T점수)', d: '전국 평균이 50, 표준편차가 10이 되도록 맞춘 점수. 50이 한가운데이고 눈금 한 칸이 10점이다. 0~100 점수가 아니다.' },
  { t: '백분위', d: '나보다 점수가 낮은 지역의 비율(%). 100에 가까울수록 상위. 9등급 표기는 백분위를 아홉 칸으로 자른 것에 지나지 않아 두지 않았다.' },
  { t: '방향 (▲ / ▼)', d: '값이 클수록 좋은 지표는 ▲, 작을수록 좋은 지표는 ▼. ▼ 지표는 표준화 전에 뒤집는다.' },
]

export default function GlossaryModal() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('term')
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <>
      <button className="src-btn" onClick={() => setOpen(true)}>ⓘ 용어 · 방법론</button>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>용어 · 표준화 방법론</h3>
              <button onClick={() => setOpen(false)} title="닫기"><Cross size={12} /></button>
            </div>
            <div className="gl-tabs">
              {[['term', '핵심 용어'], ['method', `${METHODS.length}개 표준화 방법`]].map(([k, l]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
            <div className="modal-b">
              {tab === 'term' && <>
                {TERMS.map((x) => <div className="gl-item" key={x.t}><b>{x.t}</b><p>{x.d}</p></div>)}
                <div className="modal-sec">핵심 원리</div>
                <div className="gl-item"><p>
                  ① 지표 1개 단위 순위는 표준화 방법과 무관하게 항상 같다(단조변환, Spearman = 1.000).
                  ② 여러 지표를 합치는 CI 단계에서는 방법 간 순위 차이가 생긴다. 각 방법이 값 간격을 서로 다르게 압축·신장하기 때문이다.
                  전국 {META.n}개 시군구 중 상당수가 방법 선택만으로 10순위 넘게 움직인다.
                </p></div>
                <div className="modal-sec">방향 ▼ 지표의 처리</div>
                <div className="gl-item"><p>{META.reversal}</p></div>
                <div className="modal-sec">빈칸 처리</div>
                <div className="gl-item"><p>
                  값이 없는 칸은 0이나 평균으로 메우지 않는다. 표준화할 때 계산에서 빼고, 부문점수는
                  값이 있는 지표만으로 평균한다. 한 지표도 없으면 그 지역은 빈칸으로 남는다.
                </p></div>
              </>}

              {tab === 'method' && <>
                {Object.entries(CAMP).map(([name, c]) => (
                  <div key={name}>
                    <div className="modal-sec" style={{ color: c.color }}>{name} · {c.desc}</div>
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
                  ③ “최하위 대비 몇 % 수준”이라는 정책 설명이 쉽다 ④ 원 방법론의 우선순위와 일치한다.
                  거리기반은 기준이 전국평균이라 상한이 없어 색 범례를 고정하기 어렵고,
                  로지스틱은 값이 가운데로 몰려 시각적 대비가 떨어진다.
                  LQ(입지지수)는 거리기반 × 100과 수학적으로 같아 따로 두지 않았다.
                </p></div>
              </>}

            </div>
            <div className="gl-note">
              {META.source} · 시군구 {N}개 · 표준화·부문점수·순위는 선택 조합에 맞춰 화면에서 계산합니다.
              지표의 정의·산식·출처는 머리줄의 <b>데이터 설명</b>에서 봅니다.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
