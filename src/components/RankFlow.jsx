import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { METHODS, ROWS, N, rowKey, shortSido, methodOf, CAMP_REPS } from '../lib/ssi.js'

// 방법 간 순위 이동 — 범프 차트.
// 세로축은 전국 순위(위가 1위), 가로축은 표준화 방법이다.
// 한 지역이 방법을 옮겨 다닐 때 그리는 선이 곧 '이 지역의 자리가 방법에 얼마나 기대고 있는가'다.
//
// 리코차트 대신 SVG로 직접 그린다. 이유는 셋.
//  1) 세로축을 1~229로 고정하면 이동이 눌려 보인다 → 보이는 지역들의 범위로 자동 조정.
//  2) 오른쪽에 지역 이름을 붙여야 선을 눈으로 따라갈 수 있다.
//  3) 선 색을 '오르내림'으로 나눠야 한눈에 읽힌다 (파랑=상승, 주황=하락).
//
// 크기는 두 벌이다. 좁은 통계 패널(367px)에 720짜리 도면을 넣으면 글자가 절반으로
// 줄어 읽히지 않으므로, 패널용 도면은 패널 폭에 맞춰 작게 그리고(축소율 ≒ 1),
// 자세히 볼 때는 '크게 보기'로 넓은 도면을 화면 전체에 띄운다.

const UP = '#0B93EE'      // 순위 상승 (숫자가 작아짐)
const DOWN = '#F5760D'    // 순위 하락
const FLAT = '#94A3B8'    // 거의 그대로
const SEL = '#0F172A'     // 선택 지역

// 패널용(sm)은 그려지는 실제 폭과 도면 폭을 비슷하게 맞춘다 → 글자가 줄지 않는다.
const GEO = {
  sm: { W: 344, H: 340, L: 32, R: 106, T: 30, B: 28, gap: 14, dot: 2.4, dotOn: 3.9, bw: 26, bh: 14, nameMax: 5 },
  lg: { W: 1180, H: 640, L: 68, R: 244, T: 46, B: 48, gap: 25, dot: 3.6, dotOn: 5.6, bw: 40, bh: 21, nameMax: 14 },
}
const COUNT = {
  sm: { move: 6, sido: 10, top: 8 },
  lg: { move: 16, sido: 24, top: 16 },
}

const MODES = [
  { key: 'move', label: '이동 큰 곳', desc: '표준화 방법에 따라 순위가 가장 많이 흔들린 지역' },
  { key: 'sido', label: '선택 지역 시도', desc: '선택한 시군구가 속한 시도 안의 지역' },
  { key: 'top', label: '상위권', desc: '대표 방법 기준 상위 지역' },
]

const nice = (v) => Math.max(1, Math.min(N, Math.round(v)))

// 이름표 자리 잡기. 겹치는 것끼리 한 덩어리로 묶고, 덩어리를 제 자리(원래 y의 평균)에
// 맞춰 위아래로 고르게 편다. 아래로만 밀면 이름표 무리가 통째로 선 아래에 쳐져
// 어느 선의 이름인지 알아보기 어려워진다.
function place(ys, gap, top, bottom) {
  let g = ys.map((y, i) => ({ i0: i, n: 1, sum: y }))
  const st = (o) => o.sum / o.n - ((o.n - 1) * gap) / 2
  const en = (o) => o.sum / o.n + ((o.n - 1) * gap) / 2
  for (let pass = 0; pass < 40; pass++) {
    // 화면 밖으로 나간 덩어리를 안으로 들인다
    g.forEach((o) => {
      if (st(o) < top) o.sum = (top + ((o.n - 1) * gap) / 2) * o.n
      if (en(o) > bottom) o.sum = (bottom - ((o.n - 1) * gap) / 2) * o.n
    })
    let hit = false
    for (let i = 0; i < g.length - 1; i++) {
      if (en(g[i]) + gap > st(g[i + 1]) + 1e-6) {
        g[i] = { i0: g[i].i0, n: g[i].n + g[i + 1].n, sum: g[i].sum + g[i + 1].sum }
        g.splice(i + 1, 1); hit = true; i--
      }
    }
    if (!hit) break
  }
  const out = new Array(ys.length)
  g.forEach((o) => { for (let k = 0; k < o.n; k++) out[o.i0 + k] = st(o) + k * gap })
  return out
}
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const mshort = (k) => { const m = methodOf(k); return m?.short || m?.label || k }

/* ── 도면 한 벌 ─────────────────────────────────────────────── */
function Bump({ size, sector, selectedRow, mode, onSelect, ver = 0 }) {
  const g = GEO[size]
  const PW = g.W - g.L - g.R
  const PH = g.H - g.T - g.B
  const [hov, setHov] = useState(null)

  const mk0 = METHODS[0].key
  const [repA, repB] = CAMP_REPS
  const take = COUNT[size][mode] || 8

  const series = useMemo(() => {
    let list
    if (mode === 'sido' && selectedRow) {
      list = ROWS.filter((r) => r[sector] && r.sido === selectedRow.sido)
        .sort((a, b) => a[sector].rank[mk0] - b[sector].rank[mk0]).slice(0, take)
    } else if (mode === 'top') {
      list = ROWS.filter((r) => r[sector]).sort((a, b) => a[sector].rank[mk0] - b[sector].rank[mk0]).slice(0, take)
    } else {
      list = ROWS.filter((r) => r[sector]).sort((a, b) => b[sector].ssiCamp - a[sector].ssiCamp).slice(0, take)
    }
    if (selectedRow && selectedRow[sector] && !list.some((r) => rowKey(r) === rowKey(selectedRow))) list = [...list, selectedRow]
    return list.map((r) => {
      const rk = METHODS.map((m) => r[sector].rank[m.key])
      // 방향은 두 진영의 대표 방법(간격보존형 ↔ 순위전용형)으로 본다.
      // +면 순위가 올라간 것(등수 숫자가 작아진 것)이다.
      const d = r[sector].rank[repA] - r[sector].rank[repB]
      const swing = Math.max(...rk) - Math.min(...rk)
      return { key: rowKey(r), name: r.name, sido: shortSido(r.sido), ranks: rk, delta: d, swing, row: r }
    })
  }, [mode, sector, selectedRow, mk0, repA, repB, take, ver])

  const selKey = selectedRow ? rowKey(selectedRow) : null

  // 세로축 범위 — 보이는 지역들의 순위 범위에 여유를 준다.
  const [lo, hi] = useMemo(() => {
    const all = series.flatMap((s) => s.ranks).filter((v) => v != null)
    if (!all.length) return [1, N]
    const a = Math.min(...all), b = Math.max(...all)
    const pad = Math.max(4, (b - a) * 0.12)
    return [nice(a - pad), nice(b + pad)]
  }, [series])

  const x = (i) => (METHODS.length < 2 ? g.L + PW / 2 : g.L + (i * PW) / (METHODS.length - 1))
  const y = (r) => g.T + ((r - lo) / ((hi - lo) || 1)) * PH

  // 오른쪽 이름표 — 겹치지 않게 아래로 밀어 준다.
  const labels = useMemo(() => {
    const arr = series.map((s) => ({ ...s, y0: y(s.ranks[s.ranks.length - 1]) }))
      .sort((a, b) => a.y0 - b.y0)
    const ly = place(arr.map((o) => o.y0), g.gap, g.T + 2, g.T + PH - 2)
    arr.forEach((o, i) => { o.ly = ly[i] })
    return arr
  }, [series, lo, hi, size])

  const ticks = useMemo(() => {
    const n = 5
    return Array.from({ length: n }, (_, i) => nice(lo + ((hi - lo) * i) / (n - 1)))
  }, [lo, hi])

  const colorOf = (s) => (s.key === selKey ? SEL : s.delta > 2 ? UP : s.delta < -2 ? DOWN : FLAT)
  // 흐리게 처리는 '마우스를 올렸을 때'만 한다.
  // 선택 지역이 있다고 해서 나머지를 흐리게 하면 정작 비교가 되지 않는다.
  const focus = hov || selKey

  return (
    <svg className="rf-svg" viewBox={`0 0 ${g.W} ${g.H}`} width="100%" role="img"
      onMouseLeave={() => setHov(null)}>
      {/* 가로 눈금 */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={g.L} x2={g.L + PW} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeDasharray="2 4" />
          <text x={g.L - 6} y={y(t) + 3.5} textAnchor="end" className="rf-ax">{t}위</text>
        </g>
      ))}
      <text x={4} y={14} className="rf-cap">전국 순위 — 위쪽이 상위</text>

      {/* 세로 방법 축 */}
      {METHODS.map((m, i) => (
        <g key={m.key}>
          <line x1={x(i)} x2={x(i)} y1={g.T - 4} y2={g.T + PH + 4} stroke="#E2E8F0" />
          <text x={x(i)} y={g.T + PH + 19} textAnchor="middle" className="rf-mx">{m.short || m.label}</text>
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
              <circle key={i} cx={x(i)} cy={y(r)} r={on ? g.dotOn : g.dot} fill={c}
                fillOpacity={dim ? 0.18 : 1} />
            ))}
            {on && s.ranks.map((r, i) => (
              <g key={`b${i}`}>
                <rect x={x(i) - g.bw / 2} y={y(r) - g.bh - 6} width={g.bw} height={g.bh} rx={4} fill={c} />
                <text x={x(i)} y={y(r) - 6 - g.bh / 2 + 3.6} textAnchor="middle" className="rf-bg">{r}</text>
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
            <text x={zx + 15} y={s.ly + 4} className={`rf-nm${on ? ' on' : ''}`} fill={c}>
              {cut(size === 'lg' ? `${s.name} (${s.sido})` : s.name, g.nameMax)}
            </text>
            <text x={g.W - 4} y={s.ly + 4} textAnchor="end" className="rf-dl" fill={c}>
              ↕{Math.round(s.swing)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── 카드 + 크게 보기 ───────────────────────────────────────── */
export default function RankFlow({ sector, selectedRow, onSelect, ver = 0 }) {
  const [mode, setMode] = useState('move')
  const [big, setBig] = useState(false)

  useEffect(() => {
    if (!big) return
    const h = (e) => { if (e.key === 'Escape') setBig(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [big])

  const modeDesc = MODES.find((m) => m.key === mode)?.desc

  const seg = (
    <div className="rf-seg">
      {MODES.map((o) => (
        <button key={o.key} className={`rf-sg${mode === o.key ? ' on' : ''}`}
          onClick={() => setMode(o.key)}
          disabled={o.key === 'sido' && !selectedRow}
          title={o.desc}>{o.label}</button>
      ))}
    </div>
  )

  const legend = (
    <div className="rf-lg">
      <span><i style={{ background: UP }} />순위 상승</span>
      <span><i style={{ background: DOWN }} />순위 하락</span>
      <span><i style={{ background: FLAT }} />거의 그대로</span>
      <span><i style={{ background: SEL }} />선택 지역</span>
      <em>↕ 는 {METHODS.length}개 방법에서 순위가 움직인 폭(계단) · 색은 {mshort(CAMP_REPS[0])} → {mshort(CAMP_REPS[1])} 방향</em>
    </div>
  )

  return (
    <div className="rf">
      <div className="rf-bar">
        {seg}
        <span className="rf-desc">{modeDesc}</span>
        <button className="rf-zoom" onClick={() => setBig(true)} title="차트를 화면 크기로 펼쳐 봅니다">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M6.6 1.4H1.4v5.2M9.4 14.6h5.2V9.4" fill="none" stroke="currentColor"
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1.4 1.4l5 5M14.6 14.6l-5-5" fill="none" stroke="currentColor"
              strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          크게 보기
        </button>
      </div>

      <Bump size="sm" sector={sector} selectedRow={selectedRow} mode={mode} onSelect={onSelect} ver={ver} />
      {legend}

      {/* 통계 패널 안쪽에 그대로 두면 패널 상자에 갇힌다 → 화면 뿌리로 옮겨 띄운다 */}
      {big && createPortal(
        <div className="modal-back" onClick={() => setBig(false)}>
          <div className="modal modal-wide rf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>방법 간 순위 이동 · 범프 차트</h3>
              <button onClick={() => setBig(false)} title="닫기 (Esc)">✕</button>
            </div>
            <div className="modal-b rf-modal-b">
              <div className="rf rf-big">
                <div className="rf-bar">
                  {seg}
                  <span className="rf-desc">{modeDesc}</span>
                </div>
                <Bump size="lg" sector={sector} selectedRow={selectedRow} mode={mode} onSelect={onSelect} ver={ver} />
                {legend}
              </div>
            </div>
          </div>
        </div>, document.body)}
    </div>
  )
}
