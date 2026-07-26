import { useMemo } from 'react'
import { typologyGroups, classifyType } from '../lib/stats.js'
import { pct } from '../lib/format.js'

// 규칙기반 유형화 — 인천 평균 기준으로 시군구를 유형으로 나눠 보여준다.
// (군집분석 대신: 시군구 10개엔 k-means가 부적절해 명시적 규칙으로 대체)
export default function TypologyCard({ rows, summary, selected, onSelect }) {
  const ax = summary.onePersonRate
  const ay = summary.agedOneShareOfOne
  const groups = useMemo(() => typologyGroups(rows, ax, ay), [rows, ax, ay])
  const selType = classifyType(rows.find((r) => r.code === selected), ax, ay)

  return (
    <div className="clusters">
      <div className="cl-note">
        기준: 인천 평균 1인가구율 {pct(ax)} · 고령1인 비중 {pct(ay)}. 두 지표의 평균 초과 여부로 나눈 규칙기반 유형(산점도 ④와 동일).
      </div>
      {groups.map((g) => (
        <div className={`cl${g.key === selType ? ' on' : ''}`} key={g.key} style={{ borderColor: g.key === selType ? g.color : undefined }}>
          <div className="cl-head">
            <i style={{ background: g.color }} /><b>{g.name}</b><span>{g.members.length}개 시군구</span>
          </div>
          <div className="cl-rule">{g.rule}</div>
          <div className="cl-mem">
            {g.members.map((m) => (
              <button key={m.code} className={m.code === selected ? 'sel' : ''} onClick={() => onSelect(m.code)}>{m.name}</button>
            ))}
          </div>
          <div className="cl-avg">평균 · 1인 {pct(g.avg.onePersonRate)} · 고령 {pct(g.avg.agedOneShareOfOne)} · 세대당 {g.avg.avgHouseholdSize.toFixed(2)}명</div>
        </div>
      ))}
    </div>
  )
}
