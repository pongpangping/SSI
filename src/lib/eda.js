// EDA 확장 — 변수 변환·방향 정렬·가중치를 계산부에 꽂는 저장소와 수식.
//
// 22~29차 EDA판을 걷어내고 21차로 돌아온 뒤, 작업요령의 여섯 단계를 이번에는
// 21차 구조를 유지한 채 얹는다. 원칙은 하나 — 여기 설정이 바뀌면 compute.js가
// 그것을 읽어 다시 계산하고, 지도·통계창·데이터표·내려받기가 전부 같은 값을 쓴다.
//
//   순서: 원값 → ① 윈저라이징 → ② 로그화·반로그화 → (표준화 직전 방향 반전은
//   compute.js가 cfg.dir로 수행) → 표준화 4방법 → ③ 가중 평균 = 부문지수
//
// 설정은 지표(자료 열) 단위로 남는다. 부문을 오가도, 지표를 뺐다 다시 담아도
// 방향·변환·윈저라이징이 유지된다. 가중치는 부문 단위다(합 100).

const num = (x) => x != null && Number.isFinite(x)

// ── 기술통계 (1단계 탐색 화면) ──────────────────────────────────────────────
export function describe(v) {
  const ok = v.filter(num)
  const n = ok.length
  if (!n) return null
  const sorted = [...ok].sort((a, b) => a - b)
  const lo = sorted[0], hi = sorted[n - 1]
  const mean = ok.reduce((a, b) => a + b, 0) / n
  const med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const sd = n > 1 ? Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
  let skew = null, kurt = null
  if (n > 2 && sd > 0) {
    const m3 = ok.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0)
    skew = (n / ((n - 1) * (n - 2))) * m3
  }
  if (n > 3 && sd > 0) {
    const m4 = ok.reduce((a, b) => a + ((b - mean) / sd) ** 4, 0)
    kurt = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4
      - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
  }
  return { n, miss: v.length - n, lo, hi, mean, med, sd, skew, kurt }
}

export function histogram(v, bins = 24) {
  const ok = v.filter(num)
  if (!ok.length) return { bins: [], lo: 0, hi: 1, max: 0 }
  const L = Math.min(...ok), H = Math.max(...ok), d = (H - L) || 1
  const out = Array.from({ length: bins }, () => 0)
  ok.forEach((x) => { out[Math.min(bins - 1, Math.max(0, Math.floor((x - L) / d * bins)))]++ })
  return { bins: out, lo: L, hi: H, max: Math.max(...out) }
}

// ── ① 윈저라이징 ────────────────────────────────────────────────────────────
function quantileAt(sorted, p) {
  const n = sorted.length
  if (!n) return null
  const t = (n - 1) * p, i = Math.floor(t)
  return i + 1 < n ? sorted[i] + (sorted[i + 1] - sorted[i]) * (t - i) : sorted[i]
}
export function winsorize(v, loP, hiP) {
  const ok = v.filter(num).sort((a, b) => a - b)
  if (!ok.length) return v.slice()
  const lo = quantileAt(ok, Math.max(0, Math.min(1, loP / 100)))
  const hi = quantileAt(ok, Math.max(0, Math.min(1, hiP / 100)))
  return v.map((x) => (num(x) ? Math.min(hi, Math.max(lo, x)) : null))
}

// ── ② 변환 ──────────────────────────────────────────────────────────────────
// 로그화   : y = ln(x − 최소 + 1).   오른쪽 꼬리(왜도 > 0)를 눌러 준다.
// 반로그화 : y = ln(범위 + 1) − ln(최대 − x + 1). 왼쪽 꼬리(왜도 < 0)를 눌러 준다.
// 둘 다 순서(등수)는 그대로 두므로 백분위순위에서는 결과가 달라지지 않는다.
export const TRANSFORMS = [
  { key: 'none', label: '변환 없음' },
  { key: 'log', label: '로그화' },
  { key: 'rlog', label: '반로그화' },
]
export function transform(v, kind) {
  if (kind !== 'log' && kind !== 'rlog') return v.slice()
  const ok = v.filter(num)
  if (!ok.length) return v.slice()
  const lo = Math.min(...ok), hi = Math.max(...ok)
  if (kind === 'log') return v.map((x) => (num(x) ? Math.log(x - lo + 1) : null))
  const c = Math.log(hi - lo + 1)
  return v.map((x) => (num(x) ? c - Math.log(hi - x + 1) : null))
}

// 윈저 → 변환. 방향 반전은 표준화 직전에 compute.js가 한다.
export function preprocess(values, cfg) {
  let v = values
  if (cfg.winsor?.on) v = winsorize(v, cfg.winsor.lo, cfg.winsor.hi)
  if (cfg.transform && cfg.transform !== 'none') v = transform(v, cfg.transform)
  return v
}

// ── 설정 저장소 ─────────────────────────────────────────────────────────────
const CFG = {}          // col → { dir, transform, winsor }
const WEIGHTS = {}      // sector → { col: 0~100 }  (없으면 동일 가중)

export const defaultCfg = (dir) => ({
  dir: dir || '+', transform: 'none', winsor: { on: false, lo: 5, hi: 95 },
})
export const cfgOf = (col, dir) => CFG[col] || defaultCfg(dir)
export const setCfg = (col, c) => { CFG[col] = c }
export const resetCfg = (col) => { delete CFG[col] }

export const weightsOf = (sector) => WEIGHTS[sector] || null
export const setWeights = (sector, w) => { WEIGHTS[sector] = w }
export const clearWeights = (sector) => { delete WEIGHTS[sector] }
export const weightOf = (sector, col, n) => {
  const w = WEIGHTS[sector]
  const x = w?.[col]
  return num(x) && x >= 0 ? x : 100 / (n || 1)
}

// 계산 캐시 열쇠 — 설정이 바뀌면 다른 열쇠가 나와 다시 계산된다
export function edaKey(picks, sector) {
  const c = picks.map((p) => {
    const g = cfgOf(p.col, p.dir)
    return `${p.col}:${g.dir}${g.transform}${g.winsor?.on ? `w${g.winsor.lo}-${g.winsor.hi}` : ''}`
  }).join('|')
  const w = WEIGHTS[sector]
  return c + (w ? '||' + picks.map((p) => Math.round((w[p.col] ?? 0) * 10)).join('.') : '')
}

// 조작부 요약 배지 — 무엇을 얼마나 손댔는가
export function edaSummary(entries) {
  let tr = 0, dirCh = 0, wz = 0
  entries.forEach((e) => {
    const c = cfgOf(e.col, e.dir)
    if (c.transform !== 'none') tr += 1
    if (c.dir !== e.dir) dirCh += 1
    if (c.winsor?.on) wz += 1
  })
  return { tr, dirCh, wz, touched: tr + dirCh + wz > 0 }
}
