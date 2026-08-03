// 전국 요약 — 부문 하나를 골랐을 때 가장 먼저 나와야 하는 네 가지.
//
// 지도는 '어디가 높은가'는 보여 주지만 '전체가 어떤 모양인가'는 보여 주지 않는다.
// 색이 일곱 칸으로 끊겨 있으니 한 칸 안에서 얼마나 벌어져 있는지도 안 보인다.
// 그래서 값 자체를 네 각도에서 한 번씩 요약한다.
//
//   1 분포 요약   평균·중앙값·최고·최저·표준편차 + 히스토그램
//   2 상·하위     위 열 곳과 아래 열 곳
//   3 시도별      17개 시도 평균 (한 시도 안에서 몇 곳을 묶은 값인지도 함께)
//   4 지표별 기여  이 부문 점수를 실제로 움직이는 지표가 무엇인가
//
// 계산은 모두 ssi.js가 이미 만들어 둔 값을 읽어 쓴다. 여기서 다시 표준화하거나
// 평균을 새로 정의하지 않는다 — 화면마다 숫자가 달라지는 일을 막기 위해서다.

import {
  ROWS, N, SECTORS, indsOf, stdSeries, ciT, pctOf, rowKey, methodOf,
} from './ssi.js'
import { pearson } from './compute.js'

const num = (x) => x != null && Number.isFinite(x)
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)

function stats(v) {
  const f = v.filter(num)
  if (!f.length) return null
  const s = [...f].sort((a, b) => a - b)
  const m = mean(f)
  const sd = f.length > 1
    ? Math.sqrt(f.reduce((a, b) => a + (b - m) ** 2, 0) / (f.length - 1))
    : 0
  const at = (p) => {
    const x = p * (s.length - 1), i = Math.floor(x), fr = x - i
    return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * fr : s[i]
  }
  return {
    n: f.length, mean: m, med: at(0.5), min: s[0], max: s[s.length - 1], sd,
    q1: at(0.25), q3: at(0.75),
  }
}

// 부문점수(CI)를 그대로 쓴다. 방법마다 눈금이 다르므로 지금 고른 방법 하나만.
export const ciValues = (sector, method) => ROWS.map((r) => r[sector]?.ci?.[method] ?? null)

// ── 1. 분포 요약 ─────────────────────────────────────────────────────
// 히스토그램 칸 수는 20개로 고정한다. 자료 수가 229개로 늘 같으므로 자동으로
// 정할 이유가 없고, 부문을 바꿀 때마다 칸 수가 달라지면 모양을 견줄 수 없다.
export const HIST_BINS = 20

export function distribution(sector, method) {
  const v = ciValues(sector, method)
  const st = stats(v)
  if (!st) return null
  const lo = st.min, hi = st.max, d = (hi - lo) || 1
  const bins = Array.from({ length: HIST_BINS }, (_, i) => ({
    i, from: lo + d * i / HIST_BINS, to: lo + d * (i + 1) / HIST_BINS, n: 0,
  }))
  v.forEach((x) => {
    if (!num(x)) return
    bins[Math.min(HIST_BINS - 1, Math.floor((x - lo) / d * HIST_BINS))].n += 1
  })
  const peak = Math.max(...bins.map((b) => b.n)) || 1
  // 평균과 중앙값이 얼마나 어긋났는지 = 한쪽으로 쏠린 정도
  const skew = st.sd ? (st.mean - st.med) / st.sd : 0
  return { ...st, bins, peak, skew }
}

// 쏠림을 사람 말로. 판단이 아니라 그림을 말로 옮긴 것뿐이다.
export function shapeText(d) {
  if (!d) return ''
  const a = Math.abs(d.skew)
  if (a < 0.08) return '평균과 중앙값이 거의 겹치는 고른 분포입니다'
  const side = d.skew > 0 ? '높은 쪽' : '낮은 쪽'
  const how = a < 0.25 ? '약간' : a < 0.5 ? '뚜렷하게' : '크게'
  return `${side}으로 ${how} 꼬리가 늘어져 있습니다 (평균 ${d.mean.toFixed(1)} · 중앙값 ${d.med.toFixed(1)})`
}

// ── 2. 상위·하위 ─────────────────────────────────────────────────────
export function topBottom(sector, method, k = 10) {
  const list = ROWS
    .map((r, i) => ({
      key: rowKey(r), sido: r.sido, name: r.name, i,
      ci: r[sector]?.ci?.[method] ?? null,
      rank: r[sector]?.rank?.[method] ?? null,
      camp: r[sector]?.ssiCamp ?? null,
    }))
    .filter((x) => num(x.ci) && num(x.rank))
  const t = ciT(sector, method)
  list.forEach((x) => { x.t = t[x.i] })
  const asc = [...list].sort((a, b) => a.rank - b.rank)
  return { top: asc.slice(0, k), bottom: asc.slice(-k).reverse(), n: list.length }
}

// ── 3. 시도별 평균 ───────────────────────────────────────────────────
// 시도별 '평균 부문점수'는 그 시도에 속한 시군구 값의 단순 평균이다. 인구나
// 면적으로 가중하지 않는다 — 이 지수 자체가 시군구를 한 단위로 세는 지수라,
// 여기서만 가중을 넣으면 지도와 표의 기준이 어긋난다.
export function bySido(sector, method) {
  const g = new Map()
  ROWS.forEach((r) => {
    const v = r[sector]?.ci?.[method]
    if (!num(v)) return
    if (!g.has(r.sido)) g.set(r.sido, [])
    g.get(r.sido).push(v)
  })
  const out = [...g.entries()].map(([sido, v]) => ({
    sido, n: v.length, mean: mean(v), min: Math.min(...v), max: Math.max(...v),
  }))
  out.sort((a, b) => b.mean - a.mean)
  const all = out.map((x) => x.mean)
  const lo = Math.min(...all), hi = Math.max(...all)
  const nat = mean(ciValues(sector, method).filter(num))
  out.forEach((x, i) => { x.order = i + 1; x.gap = x.mean - nat })
  return { list: out, lo, hi, nat }
}

// ── 4. 지표별 기여도 ─────────────────────────────────────────────────
// 부문점수는 선택 지표의 표준화값을 같은 무게로 평균한 값이다. 그러니 '평균을
// 얼마나 끌어올렸는가'(몫)와 '순위를 얼마나 좌우하는가'(상관·편차)는 다른 이야기다.
// 둘 다 적어 둔다. 몫만 보면 모든 지표가 비슷해 보이고, 상관만 보면 값이 낮은
// 지표가 왜 순위를 흔드는지 설명되지 않는다.
export function contribution(sector, method) {
  const inds = indsOf(sector)
  if (!inds.length) return []
  const ci = ciValues(sector, method)
  const rows = inds.map((e) => {
    const s = stdSeries(sector, e.label, method)
    const st = stats(s)
    return {
      id: e.id, label: e.label, name: e.name, dir: e.dir, unit: e.unit, year: e.year,
      mean: st?.mean ?? null, sd: st?.sd ?? null,
      min: st?.min ?? null, max: st?.max ?? null,
      corr: pearson(s, ci),
    }
  })
  const tot = rows.reduce((a, b) => a + (num(b.mean) ? b.mean : 0), 0) || 1
  rows.forEach((r) => { r.share = num(r.mean) ? r.mean / tot * 100 : null })
  return rows
}

// 화면·파일이 같은 문장을 쓰도록 꼬리말도 여기서 만든다.
export const summaryFoot = (sector, method) =>
  `${SECTORS[sector].name} · 표준화 ${methodOf(method).label} · 전국 ${N}개 시군구 기준`

export { stats, pctOf }
