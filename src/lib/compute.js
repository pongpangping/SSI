// 선택 조합 → 표준화 → 부문점수 → 순위. 화면에서 도는 계산부.
//
// v1은 이 계산을 파이썬에서 끝내고 결과만 파일에 담았다. v2는 사용자가 지표와
// 연도를 골라 조합을 바꾸므로 그렇게 할 수 없다. 대신 자료 파일에 원값만 담고
// 여기서 계산한다. 229행 × 지표 몇 개 × 방법 4개는 한 자릿수 밀리초로 끝난다.
//
// 빈칸 처리 원칙: 없는 값은 0이나 평균으로 메우지 않는다. 표준화할 때 계산에서
// 빼고, 부문점수는 있는 지표만으로 평균한다. 한 지표도 없으면 그 지역은 빈칸이다.

import data from '../data/ssi.json'
import { cfgOf, weightOf, edaKey, preprocess } from './eda.js'

export const ROWS = data.rows
export const N = ROWS.length
export const SERIES = data.series
export const METHODS = data.methods
export const METHOD_KEYS = METHODS.map((m) => m.key)

const num = (x) => x != null && Number.isFinite(x)

// ── 표준화 네 가지 (빈칸을 건너뛴다) ─────────────────────────────────────────
function stats(v) {
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

// 방향 ▼ 지표 뒤집기: x′ = 최대 + 최소 − x. 순서만 뒤집고 간격은 그대로 둔다.
function reverse(v, st) {
  return v.map((x) => (num(x) ? st.hi + st.lo - x : null))
}

// 동점은 평균순위 — pandas rank(pct=True)와 같다
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

const FN = {
  minmax: (v, st) => {
    const d = (st.hi - st.lo) || 1
    return v.map((x) => (num(x) ? (x - st.lo) / d * 100 : null))
  },
  distance: (v, st) => v.map((x) => (num(x) ? x / (st.mean || 1) * 100 : null)),
  pctrank: (v) => pctrankOf(v),
  logistic: (v, st) => v.map((x) => (num(x) ? 100 / (1 + Math.exp(-(x - st.mean) / st.sd)) : null)),
}

// 지표 1개를 방향 반영해 표준화
export function standardizeSeries(values, dir, method) {
  const st0 = stats(values)
  if (!st0) return values.map(() => null)
  const v = dir === '-' ? reverse(values, st0) : values
  const st = dir === '-' ? stats(v) : st0
  return (FN[method] || FN.minmax)(v, st)
}

// 내림차순 순위 (1 = 최상위). 빈칸은 순위를 주지 않는다.
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

// T점수 = 50 + 10z. 전국 평균이 50, 표준편차가 10.
export function tScore(values) {
  const st = stats(values)
  if (!st) return values.map(() => null)
  if (st.n < 2) return values.map((x) => (num(x) ? 50 : null))
  return values.map((x) => (num(x) ? 50 + 10 * (x - st.mean) / st.sd : null))
}

export const pctFromRank = (rank, n) => (num(rank) ? (n - rank) / n * 100 : null)

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

export function pearson(a, b) {
  const pair = a.map((x, i) => [x, b[i]]).filter((p) => num(p[0]) && num(p[1]))
  const n = pair.length
  if (n < 3) return null
  const ma = pair.reduce((s, p) => s + p[0], 0) / n
  const mb = pair.reduce((s, p) => s + p[1], 0) / n
  let t = 0, da = 0, db = 0
  for (const [x, y] of pair) { t += (x - ma) * (y - mb); da += (x - ma) ** 2; db += (y - mb) ** 2 }
  return t / Math.sqrt(da * db || 1)
}

// ── 부문 계산 ────────────────────────────────────────────────────────────────
// picks = [{ col, dir }] — col은 자료 파일의 계열 이름(S8_1_23 같은 것)
// 같은 조합을 다시 물으면 계산하지 않고 기억해 둔 것을 준다.
const cache = new Map()

export function computeSet(picks, sector = '', ov = null) {
  // EDA 설정(방향·변환·윈저·가중치)이 열쇠에 들어간다 — 설정이 바뀌면 새로 계산.
  //
  // ov = 전처리 덮어쓰기. 2종 비교의 오른쪽(실험) 지도가 쓴다.
  // 방향은 언제나 사용자 선택을 따른다.
  //   ov.trMap : { 열이름 → 'none' | 'log' | 'rlog' } — 적힌 지표만 그 변환으로
  //              바꿔 계산(이때 윈저 없음). 안 적힌 지표는 2단계 설정 그대로.
  //   ov.wt    : 'cur' = 4단계 가중치 그대로 · 'equal' = 동일가중
  if (ov === true) ov = { trMap: Object.fromEntries(picks.map((p) => [p.col, 'none'])), wt: 'equal' }
  if (ov && ov.tr) { // 옛 일괄형 호출 호환
    ov = { trMap: ov.tr === 'cur' ? {} : Object.fromEntries(picks.map((p) => [p.col, ov.tr])), wt: ov.wt }
  }
  const ck = picks.map((p) => p.col).join('.') + '#' + sector + '#' + edaKey(picks, sector)
    + (ov ? '#OV:' + (ov.wt || 'cur') + ':' + picks.map((p) => ov.trMap?.[p.col] || 'c').join('') : '')
  if (cache.has(ck)) return cache.get(ck)

  // 원값 → 윈저라이징 → 로그화·반로그화 (2단계 설정). 방향은 사용자가 바꿨으면 그것을 쓴다.
  const cfgs = picks.map((p) => {
    const g = cfgOf(p.col, p.dir)
    const kind = ov?.trMap?.[p.col]
    if (!kind || kind === 'cur') return g
    return { dir: g.dir, transform: kind, winsor: { on: false, lo: 5, hi: 95 } }
  })
  const cols = picks.map((p, j) => preprocess(SERIES[p.col] || ROWS.map(() => null), cfgs[j]))
  const wts = (ov && ov.wt === 'equal')
    ? picks.map(() => 1)
    : picks.map((p) => weightOf(sector, p.col, picks.length))
  const std = {}, ci = {}, rank = {}, indRank = {}
  for (const mk of METHOD_KEYS) {
    const s = picks.map((p, j) => standardizeSeries(cols[j], cfgs[j].dir, mk))
    std[mk] = s
    indRank[mk] = s.map(rankDesc)
    // 가중 평균 — 빈칸 지표는 빼고 남은 가중치를 다시 100으로 맞춘다 (4단계 설정)
    ci[mk] = ROWS.map((_, i) => {
      let sum = 0, tw = 0
      s.forEach((c, j) => { if (num(c[i])) { sum += c[i] * wts[j]; tw += wts[j] } })
      return tw > 0 ? sum / tw : null
    })
    rank[mk] = rankDesc(ci[mk])
  }

  // 두 진영 대표(Min-Max ↔ 백분위순위)의 순위 차이 = 표준화 민감도
  const [a, b] = CAMP_REPS
  const camp = ROWS.map((_, i) =>
    (num(rank[a]?.[i]) && num(rank[b]?.[i]) ? Math.abs(rank[a][i] - rank[b][i]) : null))
  const allR = ROWS.map((_, i) => METHOD_KEYS.map((m) => rank[m][i]).filter(num))
  const range = allR.map((v) => (v.length ? Math.max(...v) - Math.min(...v) : null))
  const rstd = allR.map((v) => {
    if (v.length < 2) return null
    const m = v.reduce((x, y) => x + y, 0) / v.length
    return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1))
  })
  // 민감 구분: 순위가 10계단 넘게 흔들리면 '높음'
  const flag = camp.map((c) => (c == null ? null : c >= 10 ? 'high' : c >= 5 ? 'mid' : 'low'))

  // 지표 간 순위 격차 = 선택 지표들의 백분위 순위 중 최댓값 − 최솟값(%p).
  // 어느 지표로 보느냐에 따라 평가가 얼마나 갈리는지를 그대로 재는 값이다.
  const prAll = picks.map((_, j) => indRank.pctrank[j])
  const spread = ROWS.map((_, i) => {
    const p = prAll.map((r) => (num(r[i]) ? (N - r[i]) / N * 100 : null)).filter(num)
    return p.length >= 2 ? Math.max(...p) - Math.min(...p) : null
  })

  // 트레이드오프 지역 — 격차가 유난히 큰 곳.
  //
  // 20차까지는 '격차 30%p 초과'라는 고정 기준을 썼다. 이 기준은 지표가 둘셋일
  // 때를 염두에 둔 것이어서, 지표를 여섯 개 고르면 229곳 가운데 220곳이 '해당'이
  // 되어 버렸다. 최댓값과 최솟값의 차이는 지표 수가 늘수록 저절로 커지기 때문이다.
  // 표시가 거의 모든 지역에 붙으면 아무것도 가리키지 못한다.
  //
  // 그래서 기준을 전국 분포에서 끊는다 — 격차 상위 10%. 지표를 몇 개 고르든
  // 눈에 띄는 곳만 남는다. 다만 지표들이 거의 같은 순위를 매기는 조합에서는
  // 상위 10%라도 격차 자체가 작을 수 있으므로, 옛 기준 30%p를 바닥으로 둔다.
  const okSp = spread.filter(num).sort((a, b) => a - b)
  const tradeoffCut = okSp.length
    ? Math.max(30, okSp[Math.min(okSp.length - 1, Math.floor(okSp.length * 0.9))])
    : null
  const tradeoff = spread.map((v) => (num(v) && tradeoffCut != null ? v >= tradeoffCut : false))

  const ciT = {}
  for (const mk of METHOD_KEYS) ciT[mk] = tScore(ci[mk])
  const indT = {}
  for (const mk of METHOD_KEYS) indT[mk] = std[mk].map(tScore)

  const out = { picks, cols, std, ci, rank, ciT, indRank, indT, camp, range, rstd, flag, spread, tradeoff, tradeoffCut }
  if (cache.size > 60) cache.clear()
  cache.set(ck, out)
  return out
}

// 두 진영의 대표 방법. 방법 목록이 바뀌어도 자료에서 다시 찾는다.
export const CAMP_REPS = (() => {
  const camps = []
  METHODS.forEach((m) => { if (!camps.includes(m.camp)) camps.push(m.camp) })
  const want = { 간격보존형: 'minmax', 순위전용형: 'pctrank' }
  const reps = camps.map((c) => {
    const ks = METHODS.filter((m) => m.camp === c).map((m) => m.key)
    return ks.includes(want[c]) ? want[c] : ks[0]
  })
  return reps.length >= 2 ? reps.slice(0, 2) : [METHOD_KEYS[0], METHOD_KEYS[1] || METHOD_KEYS[0]]
})()
