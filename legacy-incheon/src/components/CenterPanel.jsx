import DistrictPanel from './DistrictPanel.jsx'
import RankList from './RankList.jsx'
import AgeStructure from './AgeStructure.jsx'
import ScatterAgedOne from './ScatterAgedOne.jsx'
import TrendChart from './TrendChart.jsx'
import TypologyCard from './TypologyCard.jsx'
import { metricBy } from '../lib/metrics.js'

function Card({ n, title, children }) {
  return (
    <div className="ccard">
      <div className="ccard-head">
        <div className="ccard-num">{n}</div>
        <div className="ccard-title">{title}</div>
      </div>
      {children}
    </div>
  )
}

export default function CenterPanel({ rows, summary, trend, link, metricKey, avgFilter, avgValue, selectedRow, rank, total, weights }) {
  const metric = metricBy(metricKey)
  const filterLabel = avgFilter === 'above' ? '평균 이상' : avgFilter === 'below' ? '평균 미만' : null

  return (
    <div className="center">
      <div className="breadcrumb">
        <span className="bc-txt">선택 지역<b>{selectedRow?.name ?? '—'}</b> · 지표<b>{metric.label}</b>
          {filterLabel && <> · 필터<b>{filterLabel}</b></>}</span>
      </div>

      <Card n="1" title="선택 시군구 상세">
        <DistrictPanel row={selectedRow} rank={rank} total={total} summary={summary} rows={rows} weights={weights} />
      </Card>

      <Card n="2" title={`시군구 순위 · ${metric.label}`}>
        <RankList rows={rows} {...link} metricKey={metricKey} avgFilter={avgFilter} avgValue={avgValue} />
      </Card>

      <Card n="3" title="1인가구 연령대 구성">
        <AgeStructure rows={rows} {...link} bare />
      </Card>

      <Card n="4" title="1인가구 유형 (평균 대비)">
        <ScatterAgedOne rows={rows} {...link} summary={summary} bare />
      </Card>

      <Card n="5" title="세대수 · 세대당 인구 추이">
        <TrendChart trend={trend} bare />
      </Card>

      <Card n="6" title="지역 유형 (평균 기준 유형화)">
        <TypologyCard rows={rows} summary={summary} selected={link.selected} onSelect={link.onSelect} />
      </Card>
    </div>
  )
}
