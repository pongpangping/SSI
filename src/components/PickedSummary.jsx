import { SECTORS, ALL_SECTOR_KEYS, indsOf } from '../lib/ssi.js'

// 조작부 1번 — "지금 무엇을 계산하고 있는가"를 한 칸에 적어 둔다.
//
// 예전에는 부문 아코디언을 펼쳐 지표 이름을 늘어놓았지만, 부문이 열 개로 늘면서
// 그 방식은 화면을 다 먹는다. 여기서는 부문을 고르고 담은 지표를 요약만 보여준 뒤,
// 고르는 일 자체는 [지표 고르기] 창에 맡긴다.
export default function PickedSummary({ sector, onSector, picksBy, onOpen }) {
  const s = SECTORS[sector]
  const inds = indsOf(sector)

  const years = []
  inds.forEach((e) => { if (!years.includes(e.year)) years.push(e.year) })
  years.sort()
  const yearText = years.length === 0 ? ''
    : years.length === 1 ? `${years[0]}년`
      : `${years[0]}~${years[years.length - 1]}년 섞음`

  return (
    <div className="ps">
      {/* 부문 열 개 — 자료가 없는 넷은 자리만 두고 잠가 둔다 */}
      <div className="ps-grid">
        {ALL_SECTOR_KEYS.map((k) => {
          const t = SECTORS[k]
          const n = (picksBy[k] || []).length
          return (
            <button key={k} disabled={!t.ready}
              className={`ps-s${sector === k ? ' on' : ''}${t.ready ? '' : ' lock'}`}
              onClick={() => onSector(k)}
              title={t.ready ? `${t.name} · 담은 지표 ${n}개` : `${t.name} · 자료 준비중`}>
              <i>{t.ready ? t.icon : '🔒'}</i>
              <b>{t.name}</b>
              {t.ready && n > 0 && <u>{n}</u>}
            </button>
          )
        })}
      </div>

      {/* 담은 조합 요약 */}
      <div className="ps-bag">
        <div className="ps-bag-h">
          <b>{s.icon} {s.name}</b>
          <em>{inds.length}개{yearText && ` · ${yearText}`}</em>
        </div>
        <div className="ps-chips">
          {inds.length === 0 && <span className="ps-none">담은 지표가 없습니다</span>}
          {inds.map((e) => (
            <span key={e.label} title={`${e.desc}${e.source ? `\n출처: ${e.source}` : ''}`}>
              {e.name}
              <i className={e.dir === '+' ? 'up' : 'dn'}>{e.dir === '+' ? '▲' : '▼'}</i>
              {years.length > 1 && <em>{e.year}</em>}
            </span>
          ))}
        </div>
        <button className="ps-open" onClick={onOpen}>지표 고르기 · 연도 바꾸기</button>
      </div>
    </div>
  )
}
