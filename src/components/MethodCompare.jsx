import { METHODS, CAMP, CAMP_NAMES, CAMP_REPS, methodOf } from '../lib/ssi.js'

export default function MethodCompare({ row, sector, method, onMethod }) {
  if (!row) return <div className="empty-hint">지도에서 시군구 클릭</div>
  const d = row[sector]
  const camp = d.ssiCamp
  const [cA, cB] = CAMP_NAMES
  const [repA, repB] = CAMP_REPS
  const rMin = d.rank[repA], rPct = d.rank[repB]
  const worseInPct = rPct > rMin

  return (
    <div className="mc">
      <div className="mc-top">
        <div className="mc-name">{row.sido} {row.name}</div>
        <div className={`mc-badge ${d.flag === 'high' ? 'high' : ''}`}>
          순위 이동 <b>{camp}계단</b>{d.flag === 'high' && <span> · 민감</span>}
        </div>
      </div>

      {/* 두 진영 대표순위 비교 (SSI_camp = 두 순위 차) */}
      <div className="camp-cmp">
        <div className="camp-row">
          <span className="camp-tag" style={{ background: CAMP[cA].color }}>{cA}</span>
          <span className="camp-mth">대표 · {methodOf(repA).label}</span>
          <b className="camp-rank">{rMin}위</b>
        </div>
        <div className="camp-gap">
          <span className="gap-line" />
          <span className="gap-val">순위 차 {camp}계단{worseInPct ? ' ↓' : rPct < rMin ? ' ↑' : ''}</span>
        </div>
        <div className="camp-row">
          <span className="camp-tag" style={{ background: CAMP[cB].color }}>{cB}</span>
          <span className="camp-mth">대표 · {methodOf(repB).label}</span>
          <b className="camp-rank">{rPct}위</b>
        </div>
      </div>

      {/* 4개 방법 전체 — 클릭하면 지도가 그 방법으로 바뀐다 */}
      <div className="mtbl">
        <div className="mtbl-h"><span>표준화 방법</span><span>CI 점수</span><span>전국 순위</span></div>
        {METHODS.map((m) => (
          <button className={`mtbl-r${m.key === method ? ' on' : ''}`} key={m.key}
            onClick={() => onMethod?.(m.key)} title="클릭하면 지도가 이 방법으로 바뀝니다">
            <span className="mt-m"><i style={{ background: CAMP[m.camp].color }} />{m.label}</span>
            <span className="mt-ci">{d.ci[m.key] == null ? '—' : d.ci[m.key].toFixed(1)}</span>
            <span className="mt-rk">{d.rank[m.key]}위</span>
          </button>
        ))}
      </div>

      {/* 판정 · 보조 수치 — 문장 대신 배지와 칩으로 */}
      <div className="mc-flags">
        <span className={`mcf ${d.flag === 'high' ? 'high' : 'ok'}`}>
          {d.flag === 'high' ? '방법에 민감' : '방법에 안정'}
        </span>
        {d.tradeoff && <span className="mcf trade" title="부문 안 지표들의 백분위 순위 차가 30%p 초과">지표 엇갈림 30%p↑</span>}
      </div>

      <div className="mc-def">
        <b>순위 이동</b> = |{methodOf(repA).label} 순위 − {methodOf(repB).label} 순위|
        = |{rMin} − {rPct}| = <b>{camp}</b>
        <span>값 간격을 쓰는 계열과 등수만 쓰는 계열에서 이 시군구가 몇 계단 옮겨
          앉는지를 센다. 10계단 이상이면 민감으로 본다.</span>
      </div>
    </div>
  )
}
