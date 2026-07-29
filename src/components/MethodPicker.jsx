import { CAMP, CAMP_NAMES, methodOf } from '../lib/ssi.js'

// 표준화 방법 선택 — 고르는 일만 한다.
//
// 네 방법은 '단계'가 아니라 '갈래'다. 그래서 축·슬라이더 대신 계열(간격보존형 /
// 순위전용형)로 묶은 라디오 목록으로 둔다.
//
// 수식·범위·눈금띠와 '방법을 바꾸면 지도가 얼마나 달라지나'는 여기서 뺐다.
// 조작부에 설명이 함께 있으면 지금 무엇을 고른 상태인지가 묻힌다.
// 그 내용은 통계창 B단의 [선택한 표준화 방법] 카드로 옮겼다.
const CAMPS = CAMP_NAMES
const CAMP_NOTE = { 간격보존형: '값 간격 유지', 순위전용형: '등수만 사용' }
// 한 줄 요약 — 목록에서 바로 고를 수 있게 방법마다 성격을 한 문장으로.
// 목록에 없는 방법(예: 나중에 들어올 LQ)은 데이터의 note를 그대로 쓴다.
const ONELINE = {
  minmax: '가장 낮은 곳 0점, 가장 높은 곳 100점',
  distance: '전국 평균이 100점',
  logistic: '평균 근처를 넓게, 양극단을 좁게',
  pctrank: '등수를 그대로 0~100점으로',
  lq: '전국 평균 대비 특화 정도(=1이 평균)',
}

export default function MethodPicker({ method, onMethod }) {
  const m = methodOf(method)

  return (
    <div className="mp2">
      <div className="mgrp">
        {CAMPS.filter((c) => CAMP[c].methods.length).map((camp) => (
          <div key={camp} className="mg" style={{ '--c': CAMP[camp].color }}>
            <div className="mg-h">
              <span className="mg-dotc" />
              <b>{camp}</b>
              <em>{CAMP_NOTE[camp]}</em>
            </div>
            {CAMP[camp].methods.map((k) => {
              const x = methodOf(k)
              const on = k === method
              return (
                <button key={k} className={`mg-op${on ? ' on' : ''}`} onClick={() => onMethod(k)}
                  role="radio" aria-checked={on} title={x.note} data-mk={k}>
                  <span className="mg-rd" />
                  <span className="mg-tx"><b>{x.label}</b><em>{ONELINE[k] || x.note}</em></span>
                  {on && <span className="mg-on">선택</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mp2-where">
        지금 <b>{m.label}</b> · 수식과 범위는 통계창 <em>B. 표준화 방법 비교</em>에 있습니다
      </div>
    </div>
  )
}
