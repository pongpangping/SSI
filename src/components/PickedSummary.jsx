import { SECTORS, indsOf } from '../lib/ssi.js'
import SectorIcon from './SectorIcon.jsx'

// 조작부 1번 — "지금 무엇을 계산하고 있는가"를 한 칸에 적어 둔다.
//
// 부문 열 개를 고르던 격자는 시작 화면으로 옮겼다. 부문은 화면에 들어오기 전에
// 한 번 정하는 것이지, 지표·표준화 방법과 나란히 놓고 계속 만지는 것이 아니다.
// 여기 남은 것은 고른 결과와, 지표를 바꾸러 가는 단추 하나뿐이다.
export default function PickedSummary({ sector, onOpen }) {
  const s = SECTORS[sector]
  const inds = indsOf(sector)

  const years = []
  inds.forEach((e) => { if (!years.includes(e.year)) years.push(e.year) })
  years.sort()
  const yearText = years.length === 0 ? ''
    : years.length === 1 ? `${years[0]}년`
      : `${years[0]}~${years[years.length - 1]}년`

  return (
    <div className="ps">
      <div className="ps-bag">
        <div className="ps-bag-h">
          <span className="ps-tag">선택</span>
          <b><SectorIcon k={sector} state="on" size={15} />{s.name}</b>
          <em>지표 {inds.length}개{yearText && ` · ${yearText}`}</em>
        </div>
        <div className="ps-chips">
          {inds.length === 0 && <span className="ps-none">선택한 지표가 없습니다</span>}
          {inds.map((e) => (
            <span key={e.label} title={`${e.desc}${e.source ? `\n출처: ${e.source}` : ''}`}>
              {e.name}
              <i className={e.dir === '+' ? 'up' : 'dn'}>{e.dir === '+' ? '▲' : '▼'}</i>
              {years.length > 1 && <em>{e.year}</em>}
            </span>
          ))}
        </div>
        <button className="ps-open" onClick={onOpen}>지표 선택 · 연도 변경</button>
      </div>
    </div>
  )
}
