import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { comma, pct } from '../lib/format.js'
import { compositeBreakdown } from '../lib/stats.js'

const DONUT = ['#008AE0', '#33A8FF', '#FFA233', '#A033FF'] // 1인/2인/3인/4인+
const CONTRIB = { onePersonRate: '#0B93EE', agedOneShareOfOne: '#F5760D', avgHouseholdSize: '#64748B' }

function Tile({ label, value, unit, delta, deltaUnit }) {
  const up = delta > 0
  const col = up ? '#DC2626' : '#0EA5E9'
  return (
    <div className="dp-tile">
      <div className="dp-tile-k">{label}</div>
      <div className="dp-tile-v">{value}<span>{unit}</span></div>
      <div className="dp-tile-d" style={{ color: col }}>
        평균 {up ? '▲' : '▼'} {Math.abs(delta).toFixed(deltaUnit === 'p' ? 1 : 2)}{deltaUnit}
      </div>
    </div>
  )
}

export default function DistrictPanel({ row, rank, total, summary, rows, weights }) {
  if (!row) return null
  const donut = [
    { name: '1인', value: row.onePerson },
    { name: '2인', value: row.twoPerson },
    { name: '3인', value: row.threePerson },
    { name: '4인+', value: row.fourPlusPerson },
  ].filter((d) => d.value != null)
  const bd = rows && weights ? compositeBreakdown(rows, row, weights) : null

  return (
    <>
      <div className="dp-head">
        <span className="dp-name">{row.name}</span>
        <span className="dp-rank">1인가구 비율 인천 {rank}위 / {total}</span>
      </div>

      <div className="dp-donutrow">
        <div className="dp-donut">
          <ResponsiveContainer width={124} height={124}>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius={40} outerRadius={58}
                startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive>
                {donut.map((d, i) => <Cell key={d.name} fill={DONUT[i]} />)}
              </Pie>
              <text x="50%" y="47%" textAnchor="middle" className="donut-center-val">{pct(row.onePersonRate)}</text>
              <text x="50%" y="61%" textAnchor="middle" className="donut-center">1인가구</text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="dp-comp">
          <div className="dp-comp-title">가구원수 구성 · 2023</div>
          {donut.map((d, i) => (
            <div className="dp-comp-row" key={d.name}>
              <i style={{ background: DONUT[i] }} /><span>{d.name}</span><b>{comma(d.value)}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="dp-tiles">
        <Tile label="1인가구 비율" value={row.onePersonRate} unit="%"
          delta={row.onePersonRate - summary.onePersonRate} deltaUnit="p" />
        <Tile label="고령 1인가구" value={row.agedOneShareOfOne} unit="%"
          delta={row.agedOneShareOfOne - summary.agedOneShareOfOne} deltaUnit="p" />
        <Tile label="세대당 인구" value={row.avgHouseholdSize} unit="명"
          delta={row.avgHouseholdSize - summary.avgHouseholdSize} deltaUnit="명" />
      </div>

      <div className="dp-sub">1인가구 연령대 구성</div>
      <div className="agemini">
        <span className="am-seg" style={{ width: `${row.youngOneShare}%`, background: '#33A8FF' }} />
        <span className="am-seg" style={{ width: `${row.midOneShare}%`, background: '#94A3B8' }} />
        <span className="am-seg" style={{ width: `${row.agedOneShareOfOne}%`, background: '#FF8A00' }} />
      </div>
      <div className="agemini-legend">
        <span><i style={{ background: '#33A8FF' }} />청년 {pct(row.youngOneShare)}</span>
        <span><i style={{ background: '#94A3B8' }} />중년 {pct(row.midOneShare)}</span>
        <span><i style={{ background: '#FF8A00' }} />고령 {pct(row.agedOneShareOfOne)}</span>
      </div>

      {bd && (
        <>
          <div className="dp-sub">1인가구 집중지수 <b className="dp-score">{bd.total}점</b> <span className="dp-sub-hint">지표별 기여</span></div>
          <div className="agemini">
            {bd.parts.map((p) => (
              <span key={p.key} className="am-seg" style={{ width: `${p.contrib}%`, background: CONTRIB[p.key] }} />
            ))}
          </div>
          <div className="agemini-legend">
            {bd.parts.map((p) => (
              <span key={p.key}><i style={{ background: CONTRIB[p.key] }} />{p.label}{p.invert ? '↓' : ''} {p.contrib}점</span>
            ))}
          </div>
        </>
      )}

      <div className="dp-foot">인구 <b>{comma(row.population)}</b>명 · 세대 <b>{comma(row.households)}</b>세대 (주민등록 2025)</div>
    </>
  )
}
