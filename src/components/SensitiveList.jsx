import { useMemo, useState } from 'react'
import { ROWS, rowKey } from '../lib/ssi.js'

const SORTS = [
  { key: 'ssiCamp', label: 'SSI_camp' },
  { key: 'ssiRange', label: 'SSI_range' },
  { key: 'ssiStd', label: 'SSI_std' },
]

// 민감도 상위 시군구 — 정렬 기준을 3개 민감도 컬럼 사이에서 바꿀 수 있다.
export default function SensitiveList({ sector, selected, onSelect }) {
  const [by, setBy] = useState('ssiCamp')
  const ranked = useMemo(() =>
    [...ROWS].filter((r) => r[sector][by] != null)
      .sort((a, b) => b[sector][by] - a[sector][by]).slice(0, 15), [sector, by])
  const maxV = ranked[0]?.[sector][by] || 1

  return (
    <div className="slist">
      <div className="sl-tabs">
        {SORTS.map((s) => (
          <button key={s.key} className={by === s.key ? 'on' : ''} onClick={() => setBy(s.key)}>{s.label}</button>
        ))}
      </div>
      {ranked.map((r, i) => {
        const d = r[sector]; const k = rowKey(r)
        return (
          <button key={k} className={`sl-row${k === selected ? ' on' : ''}`} onClick={() => onSelect(k)}>
            <span className="sl-rk">{i + 1}</span>
            <span className="sl-nm">{r.name}<em>{r.sido}</em></span>
            <span className="sl-bar"><i style={{ width: `${Math.round(d[by] / maxV * 100)}%` }} /></span>
            <span className="sl-mv">{d.rank.minmax}→{d.rank.pctrank}위</span>
            <span className="sl-camp">{by === 'ssiStd' ? d[by].toFixed(1) : d[by]}</span>
          </button>
        )
      })}
      <div className="ri-note">
        SSI_camp = |MinMax 순위 − PctRank 순위| (최종 지표) · SSI_range = 4개 방법 순위 폭 · SSI_std = 4개 방법 순위 표준편차 (둘 다 참고용).
      </div>
    </div>
  )
}
