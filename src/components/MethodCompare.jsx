import { METHODS, CAMP } from '../lib/ssi.js'

export default function MethodCompare({ row, sector, method, onMethod }) {
  if (!row) return <div className="empty-hint">지도에서 시군구를 클릭하면 표준화 방법별 계산 결과가 표시됩니다.</div>
  const d = row[sector]
  const camp = d.ssiCamp
  const rMin = d.rank.minmax, rPct = d.rank.pctrank
  const worseInPct = rPct > rMin

  return (
    <div className="mc">
      <div className="mc-top">
        <div className="mc-name">{row.sido} {row.name}</div>
        <div className={`mc-badge ${d.flag === 'high' ? 'high' : ''}`}>
          SSI_camp <b>{camp}계단</b>{d.flag === 'high' && <span> · 민감</span>}
        </div>
      </div>

      {/* 두 진영 대표순위 비교 (SSI_camp = 두 순위 차) */}
      <div className="camp-cmp">
        <div className="camp-row">
          <span className="camp-tag" style={{ background: CAMP['간격보존형'].color }}>간격보존형</span>
          <span className="camp-mth">MinMax 대표</span>
          <b className="camp-rank">{rMin}위</b>
        </div>
        <div className="camp-gap">
          <span className="gap-line" />
          <span className="gap-val">순위 차 {camp}계단{worseInPct ? ' ↓' : rPct < rMin ? ' ↑' : ''}</span>
        </div>
        <div className="camp-row">
          <span className="camp-tag" style={{ background: CAMP['순위전용형'].color }}>순위전용형</span>
          <span className="camp-mth">PctRank 대표</span>
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

      {/* 검산용 중복 컬럼 (메타데이터가 투명성 목적으로 유지한다고 명시) */}
      <div className="mc-verify">
        검산 · SSI_camp = |MinMax대표순위 {d.repMinmax} − PctRank대표순위 {d.repPctrank}| = <b>{Math.abs(d.repMinmax - d.repPctrank)}</b>
        {' '}(표기값 {camp}) · SSI_range {d.ssiRange} · SSI_std {d.ssiStd}
      </div>

      <div className="mc-note">
        {d.flag === 'high'
          ? '⚠ 이 지역은 표준화 방법 선택에 따라 순위가 크게 달라집니다 — 해석 시 어떤 방법을 썼는지 반드시 함께 밝혀야 합니다.'
          : '표준화 방법을 바꿔도 순위가 비교적 안정적인 지역입니다.'}
        {sector === 'S1' && d.tradeoff && <div className="mc-trade">↔ 트레이드오프: 부문 내 두 지표의 백분위 순위 차가 30%p를 초과합니다(한쪽 앞서고 한쪽 뒤처짐) — SSI_camp가 커지는 원인.</div>}
      </div>
    </div>
  )
}
