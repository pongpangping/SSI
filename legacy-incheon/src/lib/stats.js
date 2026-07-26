// 프론트엔드(클라이언트)에서 실시간으로 계산하는 통계 유틸
// — 빌드 전 Python 전처리와 별개로, 사용자 입력에 따라 브라우저가 값을 다시 계산한다.

// 피어슨 상관계수
export function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy
  }
  const d = Math.sqrt(sxx * syy)
  return d === 0 ? null : sxy / d
}

// 최소제곱 선형회귀 y = slope·x + intercept
export function linreg(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    sxy += dx * (ys[i] - my); sxx += dx * dx
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx }
}

// 상관 강도 설명(한국어)
export function corrLabel(r) {
  if (r == null) return '—'
  const a = Math.abs(r)
  const strength = a >= 0.7 ? '강한' : a >= 0.4 ? '뚜렷한' : a >= 0.2 ? '약한' : '거의 없는'
  const dir = r > 0 ? '양의' : r < 0 ? '음의' : ''
  return `${strength} ${dir} 상관`.trim()
}

// ── 가중 종합지수 ─────────────────────────────────────────────
// 여러 지표를 0~1로 정규화(min-max)한 뒤 가중 평균해 0~100 점수로 만든다.
// invert=true 인 지표는 값이 작을수록 점수가 높아진다(예: 세대당 인구).
export const COMPOSITE_INDICATORS = [
  { key: 'onePersonRate', label: '1인가구 비율', invert: false },
  { key: 'agedOneShareOfOne', label: '고령 1인가구 비중', invert: false },
  { key: 'avgHouseholdSize', label: '세대당 인구', invert: true },
]

// ── 규칙기반 유형화 (인천 평균 기준 사분면) ──────────────────────────
// 시군구가 10개뿐이라 군집분석(k-means)은 통계적 근거가 약하고 결과가 불안정하다.
// 그래서 '발견'이 아니라 '명시적 규칙'으로 나눈다: 1인가구율 × 고령1인비중을
// 인천 평균 기준으로 갈라 4→3유형. 기준이 투명해 누구나 검증 가능하고,
// 산점도(④)의 십자선 유형과 정확히 같은 규칙을 쓴다.
export const TYPOLOGY = {
  aged:  { key: 'aged',  name: '고령·1인 집중형', color: '#F5760D', rule: '1인가구율 ≥ 평균 · 고령1인 비중 ≥ 평균' },
  young: { key: 'young', name: '청년·1인 집중형', color: '#0B93EE', rule: '1인가구율 ≥ 평균 · 고령1인 비중 < 평균' },
  low:   { key: 'low',   name: '1인가구 비집중형', color: '#94A3B8', rule: '1인가구율 < 인천 평균' },
}
const TYPE_ORDER = ['aged', 'young', 'low']

// 한 시군구의 유형: 인천 평균(ax=1인가구율, ay=고령1인비중) 기준
export function classifyType(row, ax, ay) {
  if (row == null || row.onePersonRate == null) return null
  if (row.onePersonRate >= ax) return row.agedOneShareOfOne >= ay ? 'aged' : 'young'
  return 'low'
}

// 유형별로 시군구를 묶어 반환 (평균값·멤버 포함)
export function typologyGroups(rows, ax, ay) {
  return TYPE_ORDER.map((k) => {
    const mem = rows.filter((r) => classifyType(r, ax, ay) === k)
    const avg = (f) => mem.length ? mem.reduce((s, m) => s + (m[f] || 0), 0) / mem.length : 0
    return {
      ...TYPOLOGY[k],
      members: mem.map((m) => ({ name: m.name, code: m.code })),
      avg: { onePersonRate: avg('onePersonRate'), agedOneShareOfOne: avg('agedOneShareOfOne'), avgHouseholdSize: avg('avgHouseholdSize') },
    }
  }).filter((g) => g.members.length)
}

// 선택 구의 집중지수를 지표별 기여도로 분해 (블랙박스가 아니게)
export function compositeBreakdown(rows, row, weights) {
  if (!row) return null
  const range = {}
  for (const ind of COMPOSITE_INDICATORS) {
    const vals = rows.map((r) => r[ind.key]).filter((v) => v != null)
    range[ind.key] = { min: Math.min(...vals), max: Math.max(...vals) }
  }
  const wSum = COMPOSITE_INDICATORS.reduce((a, ind) => a + (weights[ind.key] || 0), 0)
  const parts = COMPOSITE_INDICATORS.map((ind) => {
    const w = weights[ind.key] || 0
    const { min, max } = range[ind.key]
    const v = row[ind.key]
    let norm = max === min || v == null ? 0.5 : (v - min) / (max - min)
    if (ind.invert) norm = 1 - norm
    const contrib = wSum ? (w * norm / wSum) * 100 : 0
    return { key: ind.key, label: ind.label, invert: ind.invert, weight: w, contrib: Math.round(contrib * 10) / 10 }
  })
  const total = Math.round(parts.reduce((a, p) => a + p.contrib, 0))
  return { parts, total }
}

export function computeComposite(rows, weights) {
  // 지표별 min/max
  const range = {}
  for (const ind of COMPOSITE_INDICATORS) {
    const vals = rows.map((r) => r[ind.key]).filter((v) => v != null)
    range[ind.key] = { min: Math.min(...vals), max: Math.max(...vals) }
  }
  const wSum = COMPOSITE_INDICATORS.reduce((a, ind) => a + (weights[ind.key] || 0), 0)
  return rows.map((r) => {
    if (wSum === 0) return { ...r, composite: 0 }
    let acc = 0
    for (const ind of COMPOSITE_INDICATORS) {
      const w = weights[ind.key] || 0
      if (!w) continue
      const { min, max } = range[ind.key]
      const v = r[ind.key]
      let norm = max === min || v == null ? 0.5 : (v - min) / (max - min)
      if (ind.invert) norm = 1 - norm
      acc += w * norm
    }
    return { ...r, composite: Math.round((acc / wSum) * 1000) / 10 } // 0~100, 소수1
  })
}
