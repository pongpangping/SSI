import { SECTORS, ALL_SECTOR_KEYS, indsOf } from '../lib/ssi.js'
import SectorIcon from './SectorIcon.jsx'

// 조작부 1번 — "지금 무엇을 계산하고 있는가"를 한 칸에 적어 둔다.
//
// 위 격자는 '고르는 자리'(부문 10개), 아래 카드는 '고른 결과'다. 둘이 같은 톤이면
// 무엇을 선택한 상태인지 눈에 들어오지 않아, 아래 카드에만 강조색 띠와 [선택] 표시를
// 둬서 결과 쪽이 먼저 읽히게 했다. 지표를 고르는 일 자체는 [지표 고르기] 창이 맡는다.
export default function PickedSummary({ sector, onSector, picksBy, onOpen }) {
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
      {/* 부문 열 개 — 자료가 없는 넷은 자리만 두고 잠가 둔다 */}
      <div className="ps-cap">부문 선택</div>
      <div className="ps-grid">
        {ALL_SECTOR_KEYS.map((k) => {
          const t = SECTORS[k]
          const n = (picksBy[k] || []).length
          return (
            <button key={k} disabled={!t.ready}
              className={`ps-s${sector === k ? ' on' : ''}${t.ready ? '' : ' lock'}`}
              onClick={() => onSector(k)}
              title={t.ready ? `${t.name} · 선택 지표 ${n}개` : `${t.name} · 자료 준비중`}>
              <SectorIcon k={k} state={!t.ready ? 'lock' : sector === k ? 'on' : ''} size={14} />
              <b>{t.name}</b>
              {t.ready && n > 0 && <u>{n}</u>}
            </button>
          )
        })}
      </div>

      {/* 고른 결과 — 여기가 이 칸의 결론이라 강조색 띠를 두른다 */}
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
