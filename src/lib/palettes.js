// 지도 색상 팔레트 — 사용자가 고른다.
//
// 계급 수가 7일 수도, 10등급일 수도 있으므로 고정 배열 대신 기준색 몇 개를
// 보간해 필요한 칸 수만큼 만들어 쓴다. 모든 팔레트는 '옅음 → 진함'이며,
// 지도 쪽에서 값이 클수록 진하게 칠한다(순위는 반대로 뒤집는다).

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const rgb2hex = (r) => '#' + r.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')

function interp(anchors, k) {
  const pts = anchors.map(hex2rgb)
  const out = []
  for (let i = 0; i < k; i++) {
    const t = k === 1 ? 0 : i / (k - 1)
    const s = t * (pts.length - 1)
    const j = Math.min(pts.length - 2, Math.floor(s))
    const f = s - j
    out.push(rgb2hex(pts[j].map((a, c) => a + (pts[j + 1][c] - a) * f)))
  }
  return out
}

export const PALETTES = [
  { key: 'blue', label: '블루', anchors: ['#EAF6FF', '#9AD3FF', '#0B93EE', '#08507F', '#032A44'] },
  { key: 'teal', label: '틸', anchors: ['#E6FAF7', '#8FE3D4', '#14B8A6', '#0F766E', '#083F3B'] },
  { key: 'green', label: '그린', anchors: ['#EDFAF0', '#A2E3B4', '#2FB86A', '#136135', '#07331B'] },
  { key: 'amber', label: '앰버', anchors: ['#FFF6E8', '#FFD9A0', '#F59E0B', '#92400E', '#4A2107'] },
  { key: 'red', label: '레드', anchors: ['#FFEFEC', '#FCA5A5', '#EF4444', '#991B1B', '#450A0A'] },
  { key: 'purple', label: '퍼플', anchors: ['#F5F0FF', '#C4B5FD', '#8B5CF6', '#5B21B6', '#2E1065'] },
  { key: 'magma', label: '마그마', anchors: ['#FCF4D9', '#FCA55C', '#E1476B', '#7C1D6F', '#1D1147'] },
  { key: 'mono', label: '모노', anchors: ['#F4F4F5', '#C9CBD1', '#8E939E', '#4C515C', '#17191E'] },
]
export const PALETTE_KEYS = PALETTES.map((p) => p.key)
export const paletteOf = (key) => PALETTES.find((p) => p.key === key) || PALETTES[0]

const cacheR = new Map()
export function rampOf(key, k = 7) {
  const ck = `${key}:${k}`
  if (!cacheR.has(ck)) cacheR.set(ck, interp(paletteOf(key).anchors, k))
  return cacheR.get(ck)
}

// 발산형(순위 이동처럼 ± 대칭 값) — 파랑 ↔ 회백 ↔ 주황 고정
export const DIV_ANCHORS = ['#08507F', '#5FB6F5', '#EEF1F5', '#FDA35A', '#8F3F03']
export function divRamp(k = 7) {
  const ck = `div:${k}`
  if (!cacheR.has(ck)) cacheR.set(ck, interp(DIV_ANCHORS, k))
  return cacheR.get(ck)
}

export const MISSING = '#3A3F4A' // 빈칸(자료 없음) — 다크 지도 위의 무채색
