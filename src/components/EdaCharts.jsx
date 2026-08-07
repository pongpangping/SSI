import { useMemo } from 'react'
import { histogram } from '../lib/eda.js'

// EDA 공용 분포 그림 — 단계 페이지(1·2·3)가 함께 쓴다.

const num = (x) => x != null && Number.isFinite(x)

export function HistBars({ values, bins = 26, h = 80, marks = [] }) {
  const H = useMemo(() => histogram(values, bins), [values, bins])
  if (!H.bins.length || !H.max) return <div className="eda-empty">자료 없음</div>
  const W = 260, bw = W / bins, d = (H.hi - H.lo) || 1
  return (
    <svg className="eda-hist" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
      {H.bins.map((c, i) => (c ? (
        <rect key={i} x={i * bw + 0.7} y={h - Math.max(1.5, (c / H.max) * (h - 6))}
          width={bw - 1.4} height={Math.max(1.5, (c / H.max) * (h - 6))}
          rx="1" fill="#0B93EE" opacity={0.32 + 0.68 * (c / H.max)} />
      ) : null))}
      {marks.map((m, i) => (num(m.v) ? (
        <line key={`m${i}`} x1={((m.v - H.lo) / d) * W} x2={((m.v - H.lo) / d) * W} y1={2} y2={h}
          stroke={m.color || '#0F172A'} strokeWidth="1" strokeDasharray={m.dash ? '3 3' : 'none'} opacity="0.85" />
      ) : null))}
    </svg>
  )
}

function shapePath(values, bins, W, h) {
  const H = histogram(values, bins)
  if (!H.max) return null
  const pts = H.bins.map((c, i) =>
    `${(((i + 0.5) / bins) * W).toFixed(1)},${(h - 3 - (c / H.max) * (h - 10)).toFixed(1)}`)
  return `M0,${h - 3} L${pts.join(' L')} L${W},${h - 3}`
}

export function ShapeCompare({ before, after, changed }) {
  const W = 300, h = 92
  const pb = useMemo(() => shapePath(before, 30, W, h), [before])
  const pa = useMemo(() => (changed ? shapePath(after, 30, W, h) : null), [after, changed])
  if (!pb) return <div className="eda-empty">자료 없음</div>
  return (
    <svg className="eda-hist" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
      <line x1="0" x2={W} y1={h - 3} y2={h - 3} stroke="rgba(15,23,42,0.18)" strokeWidth="1" />
      <path d={pb} fill="rgba(15,23,42,0.05)" stroke="rgba(15,23,42,0.5)" strokeWidth="1.3" strokeDasharray="4 3" />
      {pa && <path d={pa} fill="rgba(11,147,238,0.13)" stroke="#0B93EE" strokeWidth="1.8" />}
    </svg>
  )
}
