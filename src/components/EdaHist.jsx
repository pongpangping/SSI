import { useMemo } from 'react'
import { histogram } from '../lib/pipeline.js'

// 분포 그림 두 가지 — v3 공용.
//
// <HistBars>   막대 히스토그램. 1단계(지표 탐색) · 3단계(표준화 결과)에서 쓴다.
// <ShapeCompare> 변환 전(점선)·후(실선)의 분포 '모양' 겹쳐 보기. 2단계에서 쓴다.
//   변환 전후는 눈금 자체가 달라지므로(원값 ↔ 로그값) 같은 축에 그대로 얹을 수
//   없다. 각자 자기 범위를 0~1로 눌러 모양만 견주게 한다 — 묻는 것이 "쏠림이
//   풀렸는가"이지 "값이 몇인가"가 아니기 때문이다.

const num = (x) => x != null && Number.isFinite(x)

export function HistBars({ values, bins = 26, h = 84, color = 'var(--acc)', lo = null, hi = null, marks = null, className = '' }) {
  const H = useMemo(() => histogram(values, bins, lo, hi), [values, bins, lo, hi])
  const W = 260
  if (!H.bins.length || !H.max) return <div className="eh-empty">자료 없음</div>
  const bw = W / bins
  const d = (H.hi - H.lo) || 1
  return (
    <svg className={`eh ${className}`} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
      {H.bins.map((c, i) => {
        const bh = c ? Math.max(1.5, (c / H.max) * (h - 6)) : 0
        return c ? (
          <rect key={i} x={i * bw + 0.7} y={h - bh} width={bw - 1.4} height={bh}
            rx="1" fill={color} opacity={0.32 + 0.68 * (c / H.max)} />
        ) : null
      })}
      {(marks || []).map((m, i) => {
        const x = ((m.v - H.lo) / d) * W
        return num(m.v) ? (
          <g key={`m${i}`}>
            <line x1={x} x2={x} y1={2} y2={h} stroke={m.color || '#fff'} strokeWidth="1"
              strokeDasharray={m.dash ? '3 3' : 'none'} opacity="0.85" />
          </g>
        ) : null
      })}
    </svg>
  )
}

// 값 배열 → 0~1로 누른 밀도 꺾은선 좌표
function shapePath(values, bins, W, h) {
  const ok = values.filter(num)
  if (!ok.length) return null
  const H = histogram(values, bins)
  if (!H.max) return null
  const pts = H.bins.map((c, i) => {
    const x = ((i + 0.5) / bins) * W
    const y = h - 3 - (c / H.max) * (h - 10)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `M0,${h - 3} L${pts.join(' L')} L${W},${h - 3}`
}

export function ShapeCompare({ before, after, bins = 30, h = 96, color = 'var(--acc)', changed = true }) {
  const W = 300
  const pb = useMemo(() => shapePath(before, bins, W, h), [before, bins, h])
  const pa = useMemo(() => (changed ? shapePath(after, bins, W, h) : null), [after, bins, h, changed])
  if (!pb) return <div className="eh-empty">자료 없음</div>
  return (
    <svg className="eh eh-cmp" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
      <line x1="0" x2={W} y1={h - 3} y2={h - 3} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      {/* 변환 전 — 점선 */}
      <path d={pb} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.3" strokeDasharray="4 3" />
      {/* 변환 후 — 실선 */}
      {pa && <path d={pa} fill="color-mix(in srgb, currentColor 14%, transparent)"
        stroke={color} strokeWidth="1.8" style={{ color }} />}
    </svg>
  )
}
