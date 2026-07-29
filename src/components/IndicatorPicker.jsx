import { useEffect, useMemo, useState } from 'react'
import { SECTORS, ALL_SECTOR_KEYS, INDICATORS, IND, indicatorsOf, defaultPicks, latestYear } from '../lib/ssi.js'

// 지표 고르기 창 — 이 도구에서 '무엇을 계산할지' 정하는 유일한 자리.
//
// 부문이 열 개, 지표가 서른 개를 넘으므로 사이드바에 모두 늘어놓을 수 없다.
// 대신 여기서 메타데이터(정의·산식·출처·방향·연도)를 읽고 골라 담으면,
// 화면은 담긴 것만 계산해 보여준다.

const has = (picks, id, year) => picks.some((p) => p.id === id && p.year === year)

export default function IndicatorPicker({ sector, picksBy, onApply, onClose }) {
  const [cur, setCur] = useState(sector)
  const [draft, setDraft] = useState(() => ({ ...picksBy }))
  const [q, setQ] = useState('')

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const t = q.trim()
  const list = useMemo(() => {
    if (!t) return indicatorsOf(cur)
    return INDICATORS.filter((i) =>
      [i.label, i.desc, i.formula, i.source, i.note].some((x) => (x || '').includes(t)))
  }, [t, cur])

  const picks = draft[cur] || []
  const total = ALL_SECTOR_KEYS.reduce((n, k) => n + (draft[k]?.length || 0), 0)

  const toggle = (ind, year) => {
    const k = ind.sector
    setDraft((d) => {
      const cu = d[k] || []
      const next = has(cu, ind.id, year)
        ? cu.filter((p) => !(p.id === ind.id && p.year === year))
        : [...cu, { id: ind.id, year }]
      // 지표 번호 → 연도 순으로 정렬해 담은 차례가 뒤죽박죽되지 않게 한다
      next.sort((a, b) => (IND[a.id].no - IND[b.id].no) || (a.year - b.year))
      return { ...d, [k]: next }
    })
  }
  const clearOne = (p) => setDraft((d) => ({
    ...d, [cur]: (d[cur] || []).filter((x) => !(x.id === p.id && x.year === p.year)),
  }))
  const reset = () => setDraft((d) => ({ ...d, [cur]: defaultPicks(cur) }))
  const clearAll = () => setDraft((d) => ({ ...d, [cur]: [] }))

  const years = []
  picks.forEach((p) => { if (!years.includes(p.year)) years.push(p.year) })
  years.sort()

  // 자료 준비중인 부문을 들여다보다 닫아도, 화면은 원래 보던 부문에 그대로 남는다.
  const apply = () => { onApply(draft, SECTORS[cur].ready ? cur : sector); onClose() }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal ip" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>지표 고르기</h3>
          <input className="ip-q" placeholder="지표명 · 정의 · 산식 · 출처 검색 (부문을 넘어 찾습니다)"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={onClose}>✕</button>
        </div>

        <div className="ip-body">
          {/* ① 부문 열 개 */}
          <div className="ip-sect">
            {ALL_SECTOR_KEYS.map((k) => {
              const s = SECTORS[k]
              const n = draft[k]?.length || 0
              // 자료가 없는 부문도 눌러는 볼 수 있게 둔다.
              // 담을 지표는 없지만 어떤 지표가 들어올 예정인지는 보여줘야 한다.
              return (
                <button key={k}
                  className={`ip-sb${cur === k ? ' on' : ''}${s.ready ? '' : ' lock'}`}
                  onClick={() => { setCur(k); setQ('') }}
                  title={s.ready ? `${s.name} · 지표 ${s.inds.length}개` : `${s.name} · 자료 준비중 — 예정 지표만 볼 수 있습니다`}>
                  <i>{s.ready ? s.icon : '🔒'}</i>
                  <span><b>{s.name}</b><em>{k}</em></span>
                  {n > 0 && <u>{n}</u>}
                </button>
              )
            })}
          </div>

          {/* ② 지표 카드 */}
          <div className="ip-cards">
            {t && <div className="ip-hint">‘{t}’ 검색 결과 {list.length}개 — 부문을 넘어 찾았습니다</div>}
            {!t && !SECTORS[cur].ready && (
              <div className="ip-plan">
                <b>{SECTORS[cur].name} — 자료 준비중</b>
                <p>지표체계에 자리는 잡혀 있으나 원자료가 아직 들어오지 않았습니다. 예정 지표는 아래와 같습니다.</p>
                {(SECTORS[cur].planned || []).map((p) => (
                  <div className="ip-pl" key={p.no}>
                    <b>{p.no}. {p.label} <i className={p.dir === '+' ? 'up' : 'dn'}>{p.dir === '+' ? '▲' : '▼'}</i></b>
                    <span>{p.desc}</span>
                    {p.years && <u>예정 연도 {p.years}</u>}
                  </div>
                ))}
              </div>
            )}
            {list.map((ind) => {
              const mine = draft[ind.sector] || []
              const on = mine.some((p) => p.id === ind.id)
              return (
                <div className={`ip-card${on ? ' on' : ''}`} key={ind.id}>
                  <div className="ip-c1">
                    <button className="ip-name" onClick={() => toggle(ind, latestYear(ind))}
                      title="가장 최근 연도로 담기 / 빼기">
                      {ind.label}
                    </button>
                    <i className={ind.dir === '+' ? 'up' : 'dn'}>
                      {ind.dir === '+' ? '▲ 높을수록 좋음' : '▼ 낮을수록 좋음'}
                    </i>
                    {t && <b className="ip-from">{ind.sector} {SECTORS[ind.sector].name}</b>}
                  </div>
                  <p className="ip-desc">{ind.desc}</p>
                  <div className="ip-meta">
                    {ind.unit && <span>단위 {ind.unit}</span>}
                    {ind.formula && <span title={ind.formula}>산식 {ind.formula}</span>}
                    {ind.source && <span title={ind.source}>출처 {ind.source}</span>}
                    {ind.note && <span title={ind.note}>비고 {ind.note}</span>}
                  </div>
                  <div className="ip-yrs">
                    <em>연도</em>
                    {ind.years.map((y) => (
                      <button key={y} className={`ip-y${has(mine, ind.id, y) ? ' on' : ''}`}
                        onClick={() => toggle(ind, y)}>{y}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ③ 담은 목록 */}
          <div className="ip-bag">
            <div className="ip-bag-h">
              <b>{SECTORS[cur].icon} {SECTORS[cur].name}</b>
              <em>{cur}</em>
            </div>
            <div className="ip-bag-l">
              {picks.length === 0 && <div className="ip-empty">아직 담은 지표가 없습니다.<br />가운데 카드에서 연도를 누르면 담깁니다.</div>}
              {picks.map((p) => (
                <div className="ip-bi" key={`${p.id}-${p.year}`}>
                  <b>{IND[p.id].label}</b>
                  <em>{p.year}</em>
                  <button onClick={() => clearOne(p)} title="빼기">✕</button>
                </div>
              ))}
            </div>
            <div className="ip-bag-f">
              <span>{picks.length}개{years.length === 1 ? ` · ${years[0]}년` : years.length > 1 ? ` · ${years[0]}~${years[years.length - 1]}년` : ''}</span>
              <div className="ip-bag-b">
                <button onClick={reset}>기본 조합으로</button>
                <button onClick={clearAll} disabled={!picks.length}>모두 빼기</button>
              </div>
            </div>
          </div>
        </div>

        <div className="ip-foot">
          <span>
            담은 지표를 같은 비중으로 평균해 부문점수를 다시 계산합니다.
            {total > picks.length && ` 다른 부문에 담아 둔 것도 그대로 유지됩니다 (전체 ${total}개).`}
          </span>
          <button className="ip-go" disabled={!picks.length && SECTORS[cur].ready} onClick={apply}>
            {picks.length ? `${picks.length}개로 계산하고 닫기`
              : SECTORS[cur].ready ? '지표를 하나 이상 담아 주세요' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  )
}
