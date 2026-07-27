import { useMemo, useState } from 'react'
import { METHODS, ROWS, N, rowKey, shortSido, methodOf, CAMP_REPS } from '../lib/ssi.js'

// 방법 간 순위 이동 — 범프 차트.
// 세로축은 전국 순위(위가 1위), 가로축은 표준화 방법이다.
// 한 지역이 방법을 옮겨 다닐 때 그리는 선이 곧 '이 지역의 자리가 방법에 얼마나 기대고 있는가'다.
//
// 리코차트 대신 SVG로 직접 그린다. 이유는 셋.
//  1) 세로축을 1~229로 고정하면 이동이 눌려 보인다 → 보이는 지역들의 범위로 자동 조정.
//  2) 오른쪽에 지역 이름을 붙여야 선을 눈으로 따라갈 수 있다.
//  3) 선 색을 '오르내림'으로 나눠야 한눈에 읽힌다 (파랑=상승, 주황=하락).

const W = 720, H = 340
const L = 52, R = 150, T = 40, B = 34
const PW = W - L - R
const PH = H - T - B

const UP = '#0B93EE'      // 순위 상승 (숫자가 작아짐)
const DOWN = '#F5760D'    // 순위 하락
const FLAT = '#94A3B8'    // 거의 그대로
const SEL = '#0F172A'     // 선택 지역

const MODES = [
  { key: 'move', label: '이동 큰 곳', desc: '표준화 방법에 따라 순위가 가장 많이 흔들린 지역' },
  { key: 'sido', label: '선택 지역 시도', desc: '선택한 시군구가 속한 시도 안의 지역' },
  { key: 'top', label: '상위권', desc: '대표 방법 기준 상위 지역' },
]

const nice = (v) => Math.max(1, Math.min(N, Math.round(v)))

export default function RankFlow({ sector, selectedRow, onSelect }) {
  const [mode, setMode] = useState('move')
  const [hov, setHov] = useState(null)

  const mk0 = METHODS[0].key
  const [repA, repB] = CAMP_REPS

  const series = useMemo(() => {
    let list
    if (mode === 'sido' && selectedRow) {
      list = ROWS.filter((r) => r.sido === selectedRow.sido)
        .sort((a, b) => a[sector].rank[mk0] - b[sector].rank[mk0]).slice(0, 12)
    } else if (mode === 'top') {
      list = [...ROWS].sort((a, b) => a[sector].rank[mk0] - b[sector].rank[mk0]).slice(0, 10)
    } else {
      list = [...ROWS].sort((a, b) => b[sector].ssiCamp - a[sector].ssiCamp).slice(0, 8)
    }
    if (selectedRow && !list.some((r) => rowKey(r) === rowKey(selectedRow))) list = [...list, selectedRow]
    return list.map((r) => {
      const rk = METHODS.map((m) => r[sector].rank[m.key])
      // 방향은 두 진영의 대표 방법(간격보존형 ↔ 순위전용형)으로 본다.
      // +면 순위가 올라간 것(등수 숫자가 작아진 것)이다.
      const d = r[sector].rank[repA] - r[sector].rank[repB]
      const swing = Math.max(...rk) - Math.min(...rk)
      return { key: rowKey(r), name: r.name, sido: shortSido(r.sido), ranks: rk, delta: d, swing, row: r }
    })
  }, [mode, sector, selectedRow, mk0, repA, repB])

  const selKey = selectedRow ? rowKey(selectedRow) : null

  // 세로축 범위 — 보이는 지역들의 순위 범위에 여유를 준다.
  const [lo, hi] = useMemo(() => {
    const all = series.flatMap((s) => s.ranks).filter((v) => v != null)
    if (!all.length) return [1, N]
    const a = Math.min(...all), b = Math.max(...all)
    const pad = Math.max(4, (b - a) * 0.12)
    return [nice(a - pad), nice(b + pad)]
  }, [series])

  const x = (i) => (METHODS.length < 2 ? L + PW / 2 : L + (i * PW) / (METHODS.length - 1))
  const y = (r) => T + ((r - lo) / ((hi - lo) || 1)) * PH

  // 오른쪽 이름표 — 겹치지 않게 아래로 밀어 준다.
  const labels = useMemo(() => {
    const arr = series.map((s) => ({ ...s, y0: y(s.ranks[s.ranks.length - 1]) }))
      .sort((a, b) => a.y0 - b.y0)
    const GAP = 15
    let prev = -1e9
    arr.forEach((o) => { o.ly = Math.max(o.y0, prev + GAP); prev = o.ly })
    const over = arr.length ? arr[arr.length - 1].ly - (T + PH) : 0
    if (over > 0) arr.forEach((o) => { o.ly -= over })
    return arr
  }, [series, lo, hi])

  const ticks = useMemo(() => {
    const n = 5
    return Array.from({ length: n }, (_, i) => nice(lo + ((hi - lo) * i) / (n - 1)))
  }, [lo, hi])

  const colorOf = (s) => (s.key === selKey ? SEL : s.delta > 2 ? UP : s.delta < -2 ? DOWN : FLAT)
  // 흐리게 처리는 '마우스를 올렸을 때'만 한다.
  // 선택 지역이 있다고 해서 나머지를 흐리게 하면 정작 비교가 되지 않는다.
  const focus = hov || selKey
  const modeDesc = MODES.find((m) => m.key === mode)?.desc

  return (
    <div className="rf">
      <div className="rf-bar">
        <div className="rf-seg">
          {MODES.map((o) => (
            <button key={o.key} className={`rf-sg${mode === o.key ? ' on' : ''}`}
              onClick={() => setMode(o.key)}
              disabled={o.key === 'sido' && !selectedRow}
              title={o.desc}>{o.label}</button>
          ))}
        </div>
        <span className="rf-desc">{modeDesc}</span>
      </div>

      <svg className="rf-svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        onMouseLeave={() => setHov(null)}>
        {/* 가로 눈금 */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={L + PW} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeDasharray="2 4" />
            <text x={L - 8} y={y(t) + 3.5} textAnchor="end" className="rf-ax">{t}위</text>
          </g>
        ))}
        <text x={10} y={16} className="rf-cap">전국 순위 — 위쪽이 상위</text>

        {/* 세로 방법 축 */}
        {METHODS.map((m, i) => (
          <g key={m.key}>
            <line x1={x(i)} x2={x(i)} y1={T - 4} y2={T + PH + 4} stroke="#E2E8F0" />
            <text x={x(i)} y={T + PH + 20} textAnchor="middle" className="rf-mx">{m.short || m.label}</text>
          </g>
        ))}

        {/* 선 — 선택 지역을 마지막에 그려 위로 올린다 */}
        {[...series].sort((a) => (a.key === selKey ? 1 : -1)).map((s) => {
          const on = s.key === focus
          const c = colorOf(s)
          const dim = hov ? s.key !== hov : false
          const d = s.ranks.map((r, i) => `${i ? 'L' : 'M'}${x(i)} ${y(r)}`).join(' ')
          return (
            <g key={s.key} className="rf-g" onMouseEnter={() => setHov(s.key)}
              onClick={() => onSelect?.(s.key)} style={{ cursor: 'pointer' }}>
              <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
              <path d={d} fill="none" stroke={c}
                strokeWidth={s.key === selKey ? 2.8 : on ? 2.4 : 1.6}
                strokeOpacity={dim ? 0.16 : 0.92}
                strokeLinejoin="round" strokeLinecap="round" />
              {s.ranks.map((r, i) => (
                <circle key={i} cx={x(i)} cy={y(r)} r={on ? 4.2 : 2.6} fill={c}
                  fillOpacity={dim ? 0.18 : 1} />
              ))}
              {on && s.ranks.map((r, i) => (
                <g key={`b${i}`}>
                  <rect x={x(i) - 15} y={y(r) - 21} width={30} height={15} rx={4} fill={c} />
                  <text x={x(i)} y={y(r) - 10} textAnchor="middle" className="rf-bg">{r}</text>
                </g>
              ))}
            </g>
          )
        })}

        {/* 오른쪽 이름표 */}
        {labels.map((s) => {
          const on = s.key === focus
          const c = colorOf(s)
          const dim = hov ? s.key !== hov : false
          const zx = x(METHODS.length - 1)
          return (
            <g key={s.key} onMouseEnter={() => setHov(s.key)} onClick={() => onSelect?.(s.key)}
              style={{ cursor: 'pointer' }} opacity={dim ? 0.34 : 1}>
              <path d={`M${zx + 3} ${s.y0} L${zx + 12} ${s.ly}`} stroke={c} strokeWidth={1} fill="none" />
              <text x={zx + 16} y={s.ly + 4} className={`rf-nm${on ? ' on' : ''}`} fill={c}>
                {s.name}
              </text>
              <text x={W - 6} y={s.ly + 4} textAnchor="end" className="rf-dl" fill={c}>
                ↕{Math.round(s.swing)}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="rf-lg">
        <span><i style={{ background: UP }} />순위 상승</span>
        <span><i style={{ background: DOWN }} />순위 하락</span>
        <span><i style={{ background: FLAT }} />거의 그대로</span>
        <span><i style={{ background: SEL }} />선택 지역</span>
        <em>↕ 는 {METHODS.length}개 방법에서 순위가 움직인 폭(계단) · 색은 {methodOf(repA).short || methodOf(repA).label} → {methodOf(repB).short || methodOf(repB).label} 방향</em>
      </div>
    </div>
  )
}
