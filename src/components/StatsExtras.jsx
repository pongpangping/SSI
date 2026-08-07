import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts'
import { ROWS, N, rowKey, shortSido, methodOf, indsOf, stdSeries } from '../lib/ssi.js'

// 통계창 확장 카드 둘 — 작업요령 5단계의 화면 구성을 채운다.
//   RankCard   지역별 점수 순위 표 (검색 · 클릭 선택)
//   RadarCard  선택 지역의 지표 구성 방사 차트 (전국 중앙값 겹침)

const num = (x) => x != null && Number.isFinite(x)
const f1 = (v) => (v == null ? '—' : v.toFixed(1))

export function rankRows(sector, method) {
  const out = ROWS.map((r) => ({
    key: rowKey(r), sido: r.sido, name: r.name,
    ci: r[sector]?.ci?.[method] ?? null, rank: r[sector]?.rank?.[method] ?? null,
  })).filter((r) => num(r.rank))
  out.sort((a, b) => a.rank - b.rank)
  return out
}

export function RankCard({ sector, method, selected, onSelect, ver }) {
  const [q, setQ] = useState('')
  const box = useRef(null)
  const rows = useMemo(() => rankRows(sector, method), [sector, method, ver])
  const t = q.trim()
  const view = t ? rows.filter((r) => r.name.includes(t) || r.sido.includes(t)) : rows

  useEffect(() => {
    if (!selected || !box.current) return
    const el = box.current.querySelector('[data-on="1"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selected, method, ver])

  return (
    <div className="rkc">
      <input className="rkc-q" placeholder="시군구 찾기…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="rkc-cols"><span>순위</span><span>지역</span><span>점수</span></div>
      <div className="rkc-list" ref={box}>
        {view.map((r) => (
          <button key={r.key} data-on={r.key === selected ? '1' : '0'}
            className={`rkc-row${r.key === selected ? ' on' : ''}`}
            onClick={() => onSelect(r.key === selected ? null : r.key)}>
            <u>{Math.round(r.rank)}</u>
            <span><em>{shortSido(r.sido)}</em>{r.name}</span>
            <b>{f1(r.ci)}</b>
          </button>
        ))}
      </div>
      <div className="rkc-foot">전국 {N}개 시군구 · 줄을 누르면 그 지역이 선택됩니다</div>
    </div>
  )
}

function median(arr) {
  const ok = arr.filter(num).sort((a, b) => a - b)
  if (!ok.length) return null
  return ok.length % 2 ? ok[(ok.length - 1) / 2] : (ok[ok.length / 2 - 1] + ok[ok.length / 2]) / 2
}
const shortLab = (s) => (s.length > 7 ? s.slice(0, 6) + '…' : s)

export function RadarCard({ row, sector, method, ver }) {
  const inds = indsOf(sector)
  const i = ROWS.indexOf(row)
  const data = useMemo(() => inds.map((e) => {
    const s = stdSeries(sector, e.label, method)
    const md = median(s)
    return {
      axis: shortLab(e.label), full: e.label,
      region: num(s[i]) ? Math.round(s[i] * 10) / 10 : 0,
      nation: md == null ? 0 : Math.round(md * 10) / 10,
    }
  }), [sector, method, i, ver])

  if (inds.length < 3) {
    return <div className="ns-say">지표가 3개 이상일 때 방사 차트가 나옵니다.
      지금은 {inds.length}개라 축을 이루지 못합니다.</div>
  }
  return (
    <div className="rdc">
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(15,23,42,0.14)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: '#46536B', fontSize: 10.5 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]}
            tick={{ fill: 'rgba(70,83,107,0.55)', fontSize: 9 }} tickCount={3} stroke="rgba(15,23,42,0.1)" />
          <Radar name="전국 중앙값" dataKey="nation" stroke="rgba(15,23,42,0.45)"
            fill="rgba(15,23,42,0.06)" strokeDasharray="4 3" />
          <Radar name={row.name} dataKey="region" stroke="#0B93EE" fill="#0B93EE" fillOpacity={0.28} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="rdc-legend">
        <span><i className="lg-a2" />{row.name}</span>
        <span><i className="lg-b" />전국 중앙값</span>
        <em>표준화값 · {methodOf(method).label}</em>
      </div>
    </div>
  )
}
