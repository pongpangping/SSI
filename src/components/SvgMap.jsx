import { useMemo } from 'react'
import { geoData, featKey } from './NationalMap.jsx'
import { rowIndex } from '../lib/ssi.js'

// 인쇄용 정적 지도 — 리플릿 없이 SVG로 그린다.
//
// 리포트는 종이(PDF)로 나가는 화면이라 바탕타일·확대 조작이 필요 없고,
// 인쇄 시점에 타일이 덜 내려와 빈 지도가 찍히는 사고도 피해야 한다.
// 경위도를 단순 직교 투영(위도 보정 cos φ)으로 눌러 그린다 — 남한 폭에서는
// 이 정도로 충분하다.

let CACHE = null
function paths() {
  if (CACHE) return CACHE
  const feats = geoData().features
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  const K = Math.cos((36.2 * Math.PI) / 180)
  feats.forEach((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    polys.forEach((poly) => poly[0].forEach(([lng, lat]) => {
      const x = lng * K, y = lat
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
    }))
  })
  const W = 720
  const s = W / (x1 - x0)
  const H = (y1 - y0) * s
  const list = feats.map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    const d = polys.map((poly) => poly.map((ring) => {
      // 인쇄 해상도에서 티가 안 나는 촘촘한 점은 건너뛰어 파일을 가볍게 한다
      const step = Math.max(1, Math.floor(ring.length / 220))
      const pts = []
      for (let i = 0; i < ring.length; i += step) {
        const [lng, lat] = ring[i]
        pts.push(`${((lng * K - x0) * s).toFixed(1)},${((y1 - lat) * s).toFixed(1)}`)
      }
      return `M${pts.join('L')}Z`
    }).join('')).join('')
    return { key: featKey(f), d, idx: rowIndex(featKey(f)) }
  })
  CACHE = { list, W, H }
  return CACHE
}

export default function SvgMap({ colorOf, strokeColor = '#ffffff', height = 520 }) {
  const { list, W, H } = useMemo(paths, [])
  return (
    <svg className="svgmap" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: height }}>
      {list.map((p) => (
        <path key={p.key} d={p.d} fill={colorOf(p.idx)} stroke={strokeColor} strokeWidth="0.5" />
      ))}
    </svg>
  )
}
