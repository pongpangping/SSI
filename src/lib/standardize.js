// 4개 표준화 방법의 실시간 구현.
// renew/verify_formula.py 로 파일럿_분석결과.xlsx의 CI 컬럼과 완전 일치 검증 완료.
// (원자료 → 방향반전 → 표준화 → 동일가중 평균 = CI)

// 방향 −1(낮을수록 좋음) 지표 반전: x' = max + min − x
// 선형 반전이라 순서만 뒤집고 값 간격은 그대로 보존한다.
export function reverse(v) {
  const lo = Math.min(...v), hi = Math.max(...v)
  return v.map((x) => hi + lo - x)
}

export function minmax(v) {
  const lo = Math.min(...v), hi = Math.max(...v)
  const d = hi - lo || 1
  return v.map((x) => (x - lo) / d * 100)
}

export function distance(v) {
  const m = v.reduce((a, b) => a + b, 0) / v.length
  return v.map((x) => x / m * 100)
}

// pandas rank(pct=True) 와 동일 — 동점은 평균순위
export function pctrank(v) {
  const N = v.length
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0])
  const out = new Array(N)
  let i = 0
  while (i < N) {
    let j = i
    while (j + 1 < N && idx[j + 1][0] === idx[i][0]) j++
    const avgRank = (i + j + 2) / 2          // 1기준 평균순위
    for (let k = i; k <= j; k++) out[idx[k][1]] = avgRank / N * 100
    i = j + 1
  }
  return out
}

export function logistic(v) {
  const n = v.length
  const m = v.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) || 1
  return v.map((x) => 100 / (1 + Math.exp(-(x - m) / sd)))
}

export const FN = { minmax, distance, pctrank, logistic }

// 지표 1개를 방향 반영해 표준화
export function standardizeInd(values, dir, method) {
  const v = dir === '+' ? values : reverse(values)
  return FN[method](v)
}

// 부문 CI = 지표별 표준화값의 동일가중 평균
export function computeCI(indValueLists, dirs, method) {
  const cols = indValueLists.map((v, i) => standardizeInd(v, dirs[i], method))
  const n = cols[0].length
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = cols.reduce((a, c) => a + c[i], 0) / cols.length
  return out
}

// 내림차순 순위 (1 = 최상위), 동점은 평균순위
export function rankDesc(v) {
  const N = v.length
  const idx = v.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0])
  const out = new Array(N)
  let i = 0
  while (i < N) {
    let j = i
    while (j + 1 < N && idx[j + 1][0] === idx[i][0]) j++
    const avgRank = (i + j + 2) / 2
    for (let k = i; k <= j; k++) out[idx[k][1]] = avgRank
    i = j + 1
  }
  return out
}

// 스피어만 상관 (순위 간)
export function spearman(a, b) {
  const ra = rankDesc(a), rb = rankDesc(b), n = a.length
  const ma = ra.reduce((x, y) => x + y, 0) / n, mb = rb.reduce((x, y) => x + y, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const x = ra[i] - ma, y = rb[i] - mb
    num += x * y; da += x * x; db += y * y
  }
  return num / Math.sqrt(da * db)
}
