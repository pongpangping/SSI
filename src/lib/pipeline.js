// v3 계산부 — EDA 파이프라인.
//
// v2의 compute.js는 '원값 → 방향 반영 → 표준화 → 평균'만 알았다. v3은 사용자가
// 단계마다 손을 대므로 파이프라인이 길어진다.
//
//   원값 → ① 윈저라이징(꼬리 자르기) → ② 변환(로그화·반로그화)
//        → ③ 방향 정렬(작을수록 좋음이면 뒤집기) → ④ 표준화(5개 방법, 또는 미적용)
//        → ⑤ 가중 평균 = 부문지수 → 순위 · 십분위 등급
//
// 모든 단계의 중간값을 그대로 내놓는다. 1~3단계 화면이 각 단계의 분포를
// 그대로 보여줘야 하기 때문이다.
//
// 빈칸 원칙은 v2와 같다: 없는 값은 메우지 않는다. 표준화에서 빼고,
// 합성은 있는 지표의 가중치만 다시 100으로 맞춰 평균한다.

import data from './../data/ssi.json'

export const ROWS = data.rows
export const N = ROWS.length
export const SERIES = data.series

const num = (x) => x != null && Number.isFinite(x)

// ── 기술통계 ────────────────────────────────────────────────────────────────
export function describe(v) {
  const ok = v.filter(num)
  const n = ok.length
  if (!n) return null
  const sorted = [...ok].sort((a, b) => a - b)
  const lo = sorted[0], hi = sorted[n - 1]
  const mean = ok.reduce((a, b) => a + b, 0) / n
  const med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const sd = n > 1 ? Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
  // 표본 왜도 (pandas.skew와 같은 보정) — 분포가 어느 쪽으로 꼬리를 끄는가
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
  const q = (p) => {
    const t = (n - 1) * p, i = Math.floor(t)
    return i + 1 < n ? sorted[i] + (sorted[i + 1] - sorted[i]) * (t - i) : sorted[i]
  }
  return { n, miss: v.length - n, lo, hi, mean, med, sd, skew, kurt, q1: q(0.25), q3: q(0.75) }
}

// 분위수 (선형 보간) — 윈저라이징 경계에 쓴다
export function quantileAt(sorted, p) {
  const n = sorted.length
  if (!n) return null
  const t = (n - 1) * p, i = Math.floor(t)
  return i + 1 < n ? sorted[i] + (sorted[i + 1] - sorted[i]) * (t - i) : sorted[i]
}

// ── ① 윈저라이징 ────────────────────────────────────────────────────────────
// 아래 lo% · 위 hi% 밖의 값을 경계값으로 눌러 담는다. 빼는 게 아니라 눌러 담는
// 것이므로 지역 수는 그대로다. 극단값 한둘이 표준화 전체를 끌고 가는 일을 막는다.
export function winsorize(v, loP, hiP) {
  const ok = v.filter(num).sort((a, b) => a - b)
  if (!ok.length) return v.slice()
  const lo = quantileAt(ok, Math.max(0, Math.min(1, loP / 100)))
  const hi = quantileAt(ok, Math.max(0, Math.min(1, hiP / 100)))
  return v.map((x) => (num(x) ? Math.min(hi, Math.max(lo, x)) : null))
}

// ── ② 변환 ──────────────────────────────────────────────────────────────────
// 로그화   : y = ln(x − 최소 + 1).   오른쪽으로 꼬리가 길 때(왜도 > 0) 큰 값을 눌러 준다.
// 반로그화 : y = ln(범위 + 1) − ln(최대 − x + 1). 왼쪽으로 꼬리가 길 때(왜도 < 0)
//            작은 쪽 꼬리를 눌러 준다. 둘 다 순서는 그대로 두고(단조 증가) 0 이상만 내놓는다.
export const TRANSFORMS = [
  { key: 'none', label: '변환 없음', short: '—' },
  { key: 'log', label: '로그화', short: 'log' },
  { key: 'rlog', label: '반로그화', short: 'rlog' },
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

// ── ③ 방향 정렬 ────────────────────────────────────────────────────────────
// '작을수록 좋음(N)'은 x′ = 최대 + 최소 − x 로 뒤집는다. 순서만 뒤집고 간격은 둔다.
export function align(v, dir) {
  if (dir !== '-') return v.slice()
  const ok = v.filter(num)
  if (!ok.length) return v.slice()
  const lo = Math.min(...ok), hi = Math.max(...ok)
  return v.map((x) => (num(x) ? hi + lo - x : null))
}

// ── ④ 표준화 다섯 가지 ──────────────────────────────────────────────────────
// 자료 파일의 4개(Min-Max · 거리기반 · 백분위순위 · 로지스틱)에
// Min-Max ±α(양끝을 α만큼 띄운 변형)를 더한다. α는 사용자가 정한다(0 < α < 50).
export const METHODS = (() => {
  const base = data.methods.map((m) => ({ ...m }))
  const i = base.findIndex((m) => m.key === 'minmax')
  const mmA = {
    key: 'minmaxA', label: 'Min-Max ±α', short: 'MM±α', camp: '간격보존형',
    formula: 'α + (x − 최소) / (최대 − 최소) × (100 − 2α)',
    range: 'α ~ 100−α (양끝을 α만큼 띄움)',
    note: '0과 100이 나오지 않게 양끝을 α만큼 안쪽으로 밀어 넣은 Min-Max. 뒤에 로그·기하평균 합성처럼 0을 못 받는 계산이 올 때 쓴다.',
  }
  base.splice(i >= 0 ? i + 1 : base.length, 0, mmA)
  return base
})()
export const METHOD_KEYS = METHODS.map((m) => m.key)
export const methodOf = (k) => METHODS.find((m) => m.key === k) || METHODS[0]

function pctrankOf(v) {
  const pairs = v.map((x, i) => [x, i]).filter((p) => num(p[0])).sort((a, b) => a[0] - b[0])
  const n = pairs.length
  const out = v.map(() => null)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && pairs[j + 1][0] === pairs[i][0]) j++
    const avg = (i + j + 2) / 2
    for (let k = i; k <= j; k++) out[pairs[k][1]] = avg / n * 100
    i = j + 1
  }
  return out
}

function baseStats(v) {
  const ok = v.filter(num)
  const n = ok.length
  if (!n) return null
  const lo = Math.min(...ok), hi = Math.max(...ok)
  const mean = ok.reduce((a, b) => a + b, 0) / n
  const sd = n > 1
    ? Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) || 1
    : 1
  return { n, lo, hi, mean, sd }
}

export function standardize(v, method, alpha = 5) {
  const st = baseStats(v)
  if (!st) return v.map(() => null)
  const d = (st.hi - st.lo) || 1
  const a = Math.max(0.1, Math.min(49, +alpha || 5))
  switch (method) {
    case 'minmax': return v.map((x) => (num(x) ? (x - st.lo) / d * 100 : null))
    case 'minmaxA': return v.map((x) => (num(x) ? a + (x - st.lo) / d * (100 - 2 * a) : null))
    case 'distance': return v.map((x) => (num(x) ? x / (st.mean || 1) * 100 : null))
    case 'pctrank': return pctrankOf(v)
    case 'logistic': return v.map((x) => (num(x) ? 100 / (1 + Math.exp(-(x - st.mean) / st.sd)) : null))
    default: return v.map((x) => (num(x) ? (x - st.lo) / d * 100 : null))
  }
}

// ── 순위 · T점수 · 등급 ─────────────────────────────────────────────────────
export function rankDesc(v) {
  const pairs = v.map((x, i) => [x, i]).filter((p) => num(p[0])).sort((a, b) => b[0] - a[0])
  const n = pairs.length
  const out = v.map(() => null)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && pairs[j + 1][0] === pairs[i][0]) j++
    const avg = (i + j + 2) / 2
    for (let k = i; k <= j; k++) out[pairs[k][1]] = avg
    i = j + 1
  }
  return out
}

export function tScore(values) {
  const st = baseStats(values)
  if (!st) return values.map(() => null)
  if (st.n < 2) return values.map((x) => (num(x) ? 50 : null))
  return values.map((x) => (num(x) ? 50 + 10 * (x - st.mean) / st.sd : null))
}

// 10등급 — 1등급이 최상위.
//   decile : 십분위. 순위 기준으로 열 칸에 고르게(각 약 10%씩) 나눈다.
//   equal  : 등간격. 값의 범위를 열 칸으로 등분한다. 분포가 쏠리면 몰릴 수 있다.
export function grade10(values, mode = 'decile') {
  if (mode === 'equal') {
    const ok = values.filter(num)
    if (!ok.length) return values.map(() => null)
    const lo = Math.min(...ok), hi = Math.max(...ok), d = (hi - lo) || 1
    // 값이 클수록 좋음(합성점수) → 최상위 구간이 1등급
    return values.map((x) => (num(x) ? Math.min(10, Math.max(1, 10 - Math.floor((x - lo) / d * 10))) : null))
  }
  const rk = rankDesc(values)
  const n = values.filter(num).length || 1
  return rk.map((r) => (num(r) ? Math.min(10, Math.max(1, Math.ceil(r / n * 10))) : null))
}

export const pctFromRank = (rank) => (num(rank) ? (N - rank) / N * 100 : null)

// ── 파이프라인 실행 ─────────────────────────────────────────────────────────
// picks   = [{ col, id, label, unit, ... }]  — entriesOf가 만든 지표 목록
// cfg[col] = { dir, transform, winsor: {on, lo, hi}, std }
// alpha   = MM±α의 α
// weights[col] = 가중치(합 100 권장; 있는 지표끼리 다시 정규화해 쓴다)
//
// 반환: 지표별 중간 단계 전부 + 방법별 표준화 + 방법별 합성/순위/등급 + 민감도
const cache = new Map()

export const defaultCfg = (dir) => ({
  dir: dir || '+', transform: 'none', winsor: { on: false, lo: 5, hi: 95 }, std: true,
})

export function runPipeline(picks, cfg, alpha, weights, gradeMode = 'decile') {
  const ck = JSON.stringify([picks.map((p) => p.col), cfg, alpha, weights, gradeMode])
  if (cache.has(ck)) return cache.get(ck)

  const stages = picks.map((p) => {
    const c = cfg[p.col] || defaultCfg(p.dir)
    const raw = SERIES[p.col] || ROWS.map(() => null)
    const wz = c.winsor?.on ? winsorize(raw, c.winsor.lo, c.winsor.hi) : raw.slice()
    const tr = transform(wz, c.transform)
    const al = align(tr, c.dir)
    const std = {}
    for (const mk of METHOD_KEYS) {
      // 표준화 미적용을 고르면 방향 정렬까지만 한 값이 그대로 합성에 들어간다.
      // 눈금이 지표마다 다르므로 화면에 경고 띠를 붙인다(3단계).
      std[mk] = c.std ? standardize(al, mk, alpha) : al.slice()
    }
    return { pick: p, cfg: c, raw, wz, tr, al, std }
  })

  // 가중 평균 — 빈칸 지표는 빼고, 남은 가중치를 다시 100으로 맞춘다
  const w = picks.map((p) => {
    const x = weights?.[p.col]
    return num(x) && x >= 0 ? x : null
  })
  const wOk = w.every(num) && w.some((x) => x > 0)
  const wArr = wOk ? w : picks.map(() => 1)

  const ci = {}, rank = {}, ciT = {}, grade = {}, indRank = {}, indT = {}
  for (const mk of METHOD_KEYS) {
    ci[mk] = ROWS.map((_, i) => {
      let sum = 0, tw = 0
      stages.forEach((s, j) => {
        const x = s.std[mk][i]
        if (num(x)) { sum += x * wArr[j]; tw += wArr[j] }
      })
      return tw > 0 ? sum / tw : null
    })
    rank[mk] = rankDesc(ci[mk])
    ciT[mk] = tScore(ci[mk])
    grade[mk] = grade10(ci[mk], gradeMode)
    indRank[mk] = stages.map((s) => rankDesc(s.std[mk]))
    indT[mk] = stages.map((s) => tScore(s.std[mk]))
  }

  // 표준화 민감도 — 방법을 바꿨을 때 순위가 얼마나 흔들리는가 (순위 이동 탭)
  const [ra, rb] = ['minmax', 'pctrank']
  const camp = ROWS.map((_, i) =>
    (num(rank[ra]?.[i]) && num(rank[rb]?.[i]) ? Math.abs(rank[ra][i] - rank[rb][i]) : null))
  const allR = ROWS.map((_, i) => METHOD_KEYS.map((m) => rank[m][i]).filter(num))
  const range = allR.map((v) => (v.length ? Math.max(...v) - Math.min(...v) : null))
  const rstd = allR.map((v) => {
    if (v.length < 2) return null
    const m = v.reduce((x, y) => x + y, 0) / v.length
    return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1))
  })
  const flag = camp.map((c) => (c == null ? null : c >= 10 ? 'high' : c >= 5 ? 'mid' : 'low'))

  // 참고 플래그 — 지표 간 순위 격차(백분위 순위 %p)와 트레이드오프 지역.
  // 기준은 v2(21차)와 같다: 격차 상위 10%에서 끊되 바닥은 30%p.
  const prAll = stages.map((_, j) => indRank.pctrank[j])
  const spread = ROWS.map((_, i) => {
    const p = prAll.map((r) => (num(r[i]) ? (N - r[i]) / N * 100 : null)).filter(num)
    return p.length >= 2 ? Math.max(...p) - Math.min(...p) : null
  })
  const okSp = spread.filter(num).sort((a, b) => a - b)
  const tradeoffCut = okSp.length
    ? Math.max(30, okSp[Math.min(okSp.length - 1, Math.floor(okSp.length * 0.9))])
    : null
  const tradeoff = spread.map((v) => (num(v) && tradeoffCut != null ? (v >= tradeoffCut ? 1 : 0) : 0))

  const out = { stages, weights: wArr, ci, rank, ciT, grade, indRank, indT, camp, range, rstd, flag, spread, tradeoff, tradeoffCut }
  if (cache.size > 40) cache.clear()
  cache.set(ck, out)
  return out
}

// 상관 — 순위 이동 탭의 방법 간 스피어만 상관표
export function spearman(a, b) {
  const ra = rankDesc(a), rb = rankDesc(b)
  const pair = ra.map((x, i) => [x, rb[i]]).filter((p) => num(p[0]) && num(p[1]))
  const n = pair.length
  if (n < 3) return null
  const ma = pair.reduce((s, p) => s + p[0], 0) / n
  const mb = pair.reduce((s, p) => s + p[1], 0) / n
  let t = 0, da = 0, db = 0
  for (const [x, y] of pair) { t += (x - ma) * (y - mb); da += (x - ma) ** 2; db += (y - mb) ** 2 }
  return t / Math.sqrt(da * db || 1)
}

// 히스토그램 칸 나누기 — 1~3단계의 분포 그림이 함께 쓴다
export function histogram(v, bins = 24, lo = null, hi = null) {
  const ok = v.filter(num)
  if (!ok.length) return { bins: [], lo: 0, hi: 1, max: 0 }
  const L = lo != null ? lo : Math.min(...ok)
  const H = hi != null ? hi : Math.max(...ok)
  const d = (H - L) || 1
  const out = Array.from({ length: bins }, () => 0)
  ok.forEach((x) => {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((x - L) / d * bins)))
    out[i]++
  })
  return { bins: out, lo: L, hi: H, max: Math.max(...out) }
}
