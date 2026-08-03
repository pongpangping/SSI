import { useMemo } from 'react'
import { ROWS, rowKey, methodOf, CAMP_REPS } from '../lib/ssi.js'

// 순위 이동 상위 시군구.
//
// 예전에는 정렬 기준을 순위 이동 / 순위 폭 / 표준편차 셋 중에서 고르게 했다.
// 셋 다 '방법에 따라 순위가 흔들린다'는 같은 이야기를 조금씩 다르게 세는 값이라,
// 보는 사람에게는 구분이 되지 않고 어느 것이 결론인지도 흐려진다.
// 그래서 부문 민감도의 정의값 하나(SSI = 두 진영 대표 순위의 차)만 남겼다.
export default function SensitiveList({ sector, selected, onSelect, ver = 0 }) {
  const [repA, repB] = CAMP_REPS
  const ranked = useMemo(() =>
    [...ROWS].filter((r) => r[sector]?.ssiCamp != null)
      .sort((a, b) => b[sector].ssiCamp - a[sector].ssiCamp).slice(0, 15), [sector, ver])
  const maxV = ranked[0]?.[sector].ssiCamp || 1

  return (
    <div className="slist">
      <div className="sl-def">
        <b>순위 이동</b> = |{methodOf(repA).label} 순위 − {methodOf(repB).label} 순위|
        <span>값 간격을 쓰는 계열과 등수만 쓰는 계열에서 같은 지역이 몇 계단 옮겨
          앉는지. 클수록 표준화 방법 선택에 결과가 좌우된다.</span>
      </div>
      <div className="sl-head">
        <span>순서</span><span>시군구</span><span>이동 폭</span>
        <span>{methodOf(repA).label} → {methodOf(repB).label}</span>
        <span>계단</span>
      </div>
      {ranked.map((r, i) => {
        const d = r[sector]; const k = rowKey(r)
        return (
          <button key={k} className={`sl-row${k === selected ? ' on' : ''}`} onClick={() => onSelect(k)}
            title={`${r.sido} ${r.name} · ${methodOf(repA).label} ${d.rank[repA]}위 → ${methodOf(repB).label} ${d.rank[repB]}위`}>
            <span className="sl-rk">{i + 1}</span>
            <span className="sl-nm">{r.name}<em>{r.sido}</em></span>
            <span className="sl-bar"><i style={{ width: `${Math.round(d.ssiCamp / maxV * 100)}%` }} /></span>
            <span className="sl-mv">{d.rank[repA]}→{d.rank[repB]}위</span>
            <span className="sl-camp">{d.ssiCamp}</span>
          </button>
        )
      })}
    </div>
  )
}
