import { SECTORS, rawSeries } from '../lib/ssi.js'

// 부문 내 원자료 지표: 선택 시군구 값 + 전국 대비 위치(백분위)
export default function RawIndicators({ row, sector }) {
  if (!row) return <div className="empty-hint">시군구를 선택하면 부문 내 지표 원자료를 보여줍니다.</div>
  const inds = SECTORS[sector].inds

  return (
    <div className="rawind">
      {inds.map((ind) => {
        const v = row[sector].raw[ind.label]
        const all = rawSeries(sector, ind.label).filter((x) => x != null).slice().sort((a, b) => a - b)
        let pctile = null
        if (v != null && all.length) {
          const below = all.filter((x) => x <= v).length / all.length
          pctile = ind.dir === '+' ? below : 1 - below
        }
        const good = pctile != null && pctile >= 0.6
        const bad = pctile != null && pctile <= 0.4
        return (
          <div className="ri-row" key={ind.label}>
            <div className="ri-top">
              <span className="ri-name">{ind.label}
                <em className="ri-dir">{ind.dir === '+' ? '↑좋음' : '↓좋음'}</em>
                {ind.year && <em className="ri-yr">{ind.year}년</em>}
              </span>
              <b className="ri-val">{v == null ? '—' : v}<small>{ind.unit}</small></b>
            </div>
            {pctile != null && (
              <div className="ri-bar">
                <i style={{ width: `${Math.round(pctile * 100)}%`, background: good ? '#16A34A' : bad ? '#DC2626' : '#0B93EE' }} />
                <span className="ri-pct">전국 상위 {Math.max(1, Math.round((1 - pctile) * 100))}%</span>
              </div>
            )}
          </div>
        )
      })}
      <div className="ri-note">방향(↑/↓)은 지표가 좋음을 뜻하는 쪽. CI 계산 시 x′ = max + min − x 로 반전 적용됩니다.</div>
    </div>
  )
}
