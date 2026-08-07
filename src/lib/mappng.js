// 지도 PNG — 지금 칠해진 색 그대로, 타일 없이 경계와 색만 종이에 맞게 그린다.
//
// 리플릿 화면을 그대로 뜨면 바탕타일의 저작권 표시·주변국 지명까지 함께 찍히고,
// 타일 이미지는 다른 도메인에서 와서 캔버스로 옮길 수 없는 경우가 많다(CORS).
// 그래서 경계 좌표에서 직접 그린다 — 리포트의 SVG 지도와 같은 투영이다.

import { geoData, featKey } from '../components/NationalMap.jsx'
import { rowIndex } from './ssi.js'
import { savePng } from './pngout.js'

const FONT = "'Pretendard', -apple-system, 'Malgun Gothic', sans-serif"

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
  const W = 860
  const sc = W / (x1 - x0)
  const H = (y1 - y0) * sc
  const list = feats.map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    let d = ''
    polys.forEach((poly) => poly.forEach((ring) => {
      const step = Math.max(1, Math.floor(ring.length / 260))
      const pts = []
      for (let i = 0; i < ring.length; i += step) {
        const [lng, lat] = ring[i]
        pts.push(`${((lng * K - x0) * sc).toFixed(1)},${((y1 - lat) * sc).toFixed(1)}`)
      }
      d += `M${pts.join('L')}Z`
    }))
    return { idx: rowIndex(featKey(f)), d }
  })
  CACHE = { list, W, H }
  return CACHE
}

// colorOf(i): 행 번호 → 채움색.  legend: { ramp: [...], low, high } 또는 null.
export function mapPng({ title, sub, colorOf, legend }) {
  const { list, W, H } = paths()
  const SC = 2
  const headH = (title ? 26 : 0) + (sub ? 17 : 0) + (title || sub ? 10 : 0)
  const legH = legend ? 46 : 14
  const w = W + 36, h = headH + H + legH + 18
  const c = document.createElement('canvas')
  c.width = w * SC; c.height = h * SC
  const x = c.getContext('2d')
  x.scale(SC, SC)
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h)

  let y = 16
  if (title) {
    x.font = `750 16px ${FONT}`; x.fillStyle = '#0F172A'; x.textBaseline = 'top'
    x.fillText(title, 18, y); y += 24
  }
  if (sub) {
    x.font = `500 11px ${FONT}`; x.fillStyle = '#7C8698'
    x.fillText(sub, 18, y); y += 17
  }
  y += title || sub ? 6 : 0

  x.save()
  x.translate(18, y)
  list.forEach((p) => {
    const path = new Path2D(p.d)
    x.fillStyle = colorOf(p.idx) || '#E9ECF1'
    x.fill(path)
    x.strokeStyle = '#FFFFFF'
    x.lineWidth = 0.6
    x.stroke(path)
  })
  x.restore()

  if (legend) {
    const ly = y + H + 12
    const lw = 190, cell = lw / legend.ramp.length
    legend.ramp.forEach((col, i) => {
      x.fillStyle = col
      x.fillRect(18 + i * cell, ly, cell, 11)
    })
    x.strokeStyle = '#D8DEE6'; x.strokeRect(18, ly, lw, 11)
    x.font = `500 10px ${FONT}`; x.fillStyle = '#7C8698'; x.textBaseline = 'top'
    x.fillText(legend.low || '낮음', 18, ly + 15)
    const hiT = legend.high || '높음'
    x.fillText(hiT, 18 + lw - x.measureText(hiT).width, ly + 15)
  }

  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}

export async function saveMapPng(opts) {
  const blob = await mapPng(opts)
  if (blob) savePng(blob, opts.base || '지도')
  return !!blob
}
