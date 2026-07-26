import { METHODS, CAMP, SECTORS, stdSeries, indRank, rowIndex, rowKey } from '../lib/ssi.js'

// 원자료 → (방향반전) → 표준화 → 동일가중 평균 → CI → 순위
// 지표 1개 단위 순위는 4개 방법이 모두 같고, CI 단계에서만 갈린다는 점을 표로 증명한다.
export default function StdTransform({ row, sector, method, onMethod }) {
  if (!row) return <div className="empty-hint">시군구를 선택하세요</div>
  const i = rowIndex(rowKey(row))
  const inds = SECTORS[sector].inds
  const d = row[sector]

  return (
    <div className="stt">
      <table className="stt-tbl">
        <thead>
          <tr>
            <th className="stt-l">지표 · 원자료</th>
            {METHODS.map((m) => (
              <th key={m.key} className={m.key === method ? 'on' : ''}
                title={`${m.label} — ${m.formula}`}
                onClick={() => onMethod?.(m.key)}>
                <i style={{ background: CAMP[m.camp].color }} />{m.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inds.map((ind) => {
            const ranks = METHODS.map((m) => indRank(sector, ind.label, m.key)[i])
            const same = ranks.every((r) => r === ranks[0])
            return (
              <tr key={ind.label}>
                <td className="stt-l">
                  <b>{ind.label}<em className={ind.dir === '+' ? 'up' : 'dn'}>{ind.dir === '+' ? '↑좋음' : '↓좋음'}</em></b>
                  <span>
                    원자료 <u>{d.raw[ind.label]}{ind.unit}</u>
                    <i className={same ? 'same' : ''}>지표순위 {ranks[0]}위{same ? ' · 4방법 동일' : ''}</i>
                  </span>
                </td>
                {METHODS.map((m) => (
                  <td key={m.key} className={m.key === method ? 'on' : ''}>
                    {stdSeries(sector, ind.label, m.key)[i].toFixed(1)}
                  </td>
                ))}
              </tr>
            )
          })}
          <tr className="stt-ci">
            <td className="stt-l"><b>CI = 지표 표준화값 평균</b></td>
            {METHODS.map((m) => (
              <td key={m.key} className={m.key === method ? 'on' : ''}>{d.ci[m.key]?.toFixed(1)}</td>
            ))}
          </tr>
          <tr className="stt-rank">
            <td className="stt-l"><b>전국 순위 (229개 중)</b></td>
            {METHODS.map((m) => (
              <td key={m.key} className={m.key === method ? 'on' : ''}>{d.rank[m.key]}위</td>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="fact-row">
        <span className="fact" title="표준화는 값의 순서를 바꾸지 않으므로 지표 1개 순위는 4개 방법이 항상 같다">
          지표 순위<b>4방법 동일</b>
        </span>
        <span className="fact hot" title="각 방법이 값 간격을 다르게 압축·신장하므로 지표를 합칠 때 차이가 생긴다">
          갈리는 지점<b>CI 합산</b>
        </span>
        <span className="fact" title="방향 −1(낮을수록 좋음) 지표는 x′ = max + min − x 로 반전한 뒤 표준화">
          ↓좋음 지표<b>반전 후 표준화</b>
        </span>
      </div>
    </div>
  )
}
