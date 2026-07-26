import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { METHODS, ROWS, rowKey } from '../lib/ssi.js'

// 범프 차트 — 표준화 방법을 바꿀 때 순위가 어떻게 이동하는지 선으로 따라간다.
export default function RankFlow({ sector, selectedRow, onSelect }) {
  const top = useMemo(() =>
    [...ROWS].sort((a, b) => b[sector].ssiCamp - a[sector].ssiCamp).slice(0, 8), [sector])

  const series = useMemo(() => {
    const list = [...top]
    if (selectedRow && !list.some((r) => rowKey(r) === rowKey(selectedRow))) list.push(selectedRow)
    return list.map((r) => ({ key: rowKey(r), name: r.name, sido: r.sido, row: r }))
  }, [top, selectedRow])

  const data = useMemo(() => METHODS.map((m) => {
    const o = { m: m.label, camp: m.camp }
    series.forEach((s) => { o[s.key] = s.row[sector].rank[m.key] })
    return o
  }), [series, sector])

  const selKey = selectedRow ? rowKey(selectedRow) : null

  return (
    <div className="chart-bare">
      <div className="card-sub">
        SSI_camp 상위 8개 지역 + 선택 지역의 순위가 표준화 방법에 따라 어떻게 이동하는지. 선이 가파를수록 방법에 민감.
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ left: 4, right: 62, top: 10, bottom: 6 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis reversed domain={[1, 229]} width={38} tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: '#9aa0ac' }}
            label={{ value: '전국 순위', angle: -90, position: 'insideLeft', fill: '#8a909c', fontSize: 10 }} />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const sorted = [...payload].sort((a, b) => a.value - b.value)
            return (
              <div className="rc-tip">
                <b>{label}</b>
                {sorted.map((p) => {
                  const s = series.find((x) => x.key === p.dataKey)
                  return <div key={p.dataKey}>{s?.name} — {p.value}위</div>
                })}
              </div>
            )
          }} />
          {series.map((s) => {
            const on = s.key === selKey
            return (
              <Line key={s.key} type="monotone" dataKey={s.key} isAnimationActive={false}
                stroke={on ? '#0F172A' : '#F5760D'} strokeWidth={on ? 2.6 : 1.2}
                strokeOpacity={on ? 1 : 0.45}
                dot={{ r: on ? 4 : 2.4, strokeWidth: 0, fill: on ? '#0F172A' : '#F5760D' }}
                activeDot={{ r: 5, onClick: () => onSelect(s.key) }} />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
      <div className="type-legend">
        <span><i style={{ background: '#0F172A' }} />선택 지역</span>
        <span><i style={{ background: '#F5760D' }} />SSI_camp 상위 8</span>
      </div>
    </div>
  )
}
