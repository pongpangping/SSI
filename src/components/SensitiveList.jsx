import { useMemo, useState } from 'react'
import { ROWS, rowKey } from '../lib/ssi.js'

const SORTS = [
  { key: 'ssiCamp', label: '순위 이동', tip: '|Min-Max 순위 − 백분위순위 순위| — 최종 민감도 지표' },
  { key: 'ssiRange', label: '순위 폭', tip: '4개 방법이 만든 순위의 최대−최소 (참고용)' },
  { key: 'ssiStd', label: '표준편차', tip: '4개 방법 순위의 표준편차 (참고용)' },
]

// 민감도 상위 시군구 — 정렬 기준을 3개 민감도 컬럼 사이에서 바꿀 수 있다.
export default function SensitiveList({ sector, selected, onSelect, ver = 0 }) {
  const [by, setBy] = useState('ssiCamp')
  const ranked = useMemo(() =>
    [...ROWS].filter((r) => r[sector]?.[by] != null)
      .sort((a, b) => b[sector][by] - a[sector][by]).slice(0, 15), [sector, by, ver])
  const maxV = ranked[0]?.[sector][by] || 1

  return (
    <div className="slist">
      <div className="sl-tabs">
        {SORTS.map((s) => (
          <button key={s.key} className={by === s.key ? 'on' : ''} title={s.tip}
            onClick={() => setBy(s.key)}>{s.label}</button>
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
    </div>
  )
}
