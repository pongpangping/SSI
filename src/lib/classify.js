// 지도 색 구간을 나누는 방법 4가지.
// 같은 값이라도 어떻게 끊느냐에 따라 지도가 완전히 달라 보이므로,
// 지표의 분포 모양을 보고 기본값을 자동으로 고르되 사용자가 바꿀 수 있게 둔다.

export const CLASS_MODES = [
  { key: 'equal', label: '등간격', short: '등간격',
    desc: '최솟값~최댓값을 같은 폭으로 나눈다. 값 자체의 눈금이 의미를 가질 때.' },
  { key: 'quantile', label: '분위수', short: '분위수',
    desc: '각 구간에 같은 수의 지역이 들어가게 나눈다. 값이 한쪽에 몰려 있을 때.' },
  { key: 'jenks', label: '자연분류', short: '자연분류',
    desc: '값이 실제로 끊기는 지점에서 나눈다(Jenks). 덩어리가 뚜렷할 때.' },
  { key: 'stddev', label: '표준편차', short: '±σ',
    desc: '전국 평균을 가운데 두고 ±1σ·±2σ로 나눈다. 평균 대비 위치를 볼 때.' },
]
export const modeOf = (k) => CLASS_MODES.find((m) => m.key === k) || CLASS_MODES[0]

const clean = (v) => v.filter((x) => x != null && Number.isFinite(x))

// ── 구간 경계 만들기 ─────────────────────────────────────────────────────
// 반환값은 항상 '안쪽 경계' k-1개. [b1..b6] 이면 7단계.

function equalBreaks(v, k) {
  const lo = Math.min(...v), hi = Math.max(...v), d = (hi - lo) || 1
  return Array.from({ length: k - 1 }, (_, i) => lo + d * (i + 1) / k)
}

function quantileBreaks(v, k) {
  const s = [...v].sort((a, b) => a - b)
  const at = (p) => {
    const x = p * (s.length - 1), i = Math.floor(x), f = x - i
    return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * f : s[i]
  }
  const out = []
  for (let i = 1; i < k; i++) out.push(at(i / k))
  return dedupe(out, s)
}

function stddevBreaks(v, k) {
  const n = v.length
  const m = v.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) || 1
  // 7단계 기준: −2σ −1σ −0.5σ +0.5σ +1σ +2σ
  const steps = k === 7 ? [-2, -1, -0.5, 0.5, 1, 2]
    : k === 5 ? [-1.5, -0.5, 0.5, 1.5]
      : Array.from({ length: k - 1 }, (_, i) => -((k - 1) / 2) + i + 0.5)
  return steps.map((z) => m + z * sd)
}

// Jenks natural breaks — 동적계획법. n=229·k=7 정도면 즉시 끝난다.
function jenksBreaks(v, k) {
  const s = [...v].sort((a, b) => a - b)
  const n = s.length
  if (n <= k) return equalBreaks(v, k)

  const mat1 = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0))
  const mat2 = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity))
  for (let j = 1; j <= k; j++) { mat1[1][j] = 1; mat2[1][j] = 0 }

  for (let l = 2; l <= n; l++) {
    let sum = 0, sumSq = 0, w = 0
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1
      const val = s[i3 - 1]
      w++; sum += val; sumSq += val * val
      const variance = sumSq - (sum * sum) / w
      if (i3 === 1) { mat1[l][1] = 1; mat2[l][1] = variance; continue }
      for (let j = 2; j <= k; j++) {
        const cand = variance + mat2[i3 - 1][j - 1]
        if (mat2[l][j] >= cand) { mat1[l][j] = i3; mat2[l][j] = cand }
      }
    }
  }

  const out = []
  let kk = n
  for (let j = k; j >= 2; j--) { const id = mat1[kk][j] - 1; out.unshift(s[id]); kk = id }
  return dedupe(out, s)
}

// 동점이 많아 경계가 겹치면 단계가 빈다 — 겹친 경계를 미세하게 밀어 단조 증가로 만든다.
function dedupe(breaks, sorted) {
  const eps = ((sorted[sorted.length - 1] - sorted[0]) || 1) * 1e-6
  const out = []
  breaks.forEach((b, i) => { out.push(i && b <= out[i - 1] ? out[i - 1] + eps : b) })
  return out
}

const FN = { equal: equalBreaks, quantile: quantileBreaks, jenks: jenksBreaks, stddev: stddevBreaks }

export function breaksOf(values, mode = 'equal', k = 7) {
  const v = clean(values)
  if (!v.length) return []
  if (v.length === 1 || Math.min(...v) === Math.max(...v)) return equalBreaks([0, 1], k)
  return (FN[mode] || equalBreaks)(v, k)
}

// 값 → 0..k-1 단계 (경계 이상이면 다음 단계)
export function classOf(breaks) {
  return (x) => {
    if (x == null || !Number.isFinite(x)) return -1
    let i = 0
    while (i < breaks.length && x >= breaks[i]) i++
    return i
  }
}

// ── 분포 모양 진단 → 기본 분류 방법 자동 선택 ────────────────────────────
export function skewness(values) {
  const v = clean(values), n = v.length
  if (n < 3) return 0
  const m = v.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1))
  if (!sd) return 0
  return v.reduce((a, b) => a + ((b - m) / sd) ** 3, 0) / n
}

// 값이 몇 덩어리로 끊겨 있는지 대략 본다 — 가장 큰 틈이 평균 간격의 몇 배인가.
function gapRatio(values) {
  const s = clean(values).sort((a, b) => a - b)
  if (s.length < 8) return 1
  const span = (s[s.length - 1] - s[0]) || 1
  let maxGap = 0
  for (let i = 1; i < s.length; i++) maxGap = Math.max(maxGap, s[i] - s[i - 1])
  return maxGap / (span / s.length)
}

// 지표의 성격(scale)과 실제 분포를 함께 보고 기본 분류를 정한다.
export function autoMode(values, scale) {
  if (scale === 'div') return 'stddev'      // 순위 변화 — 0을 가운데 두고 좌우 대칭이어야 읽힌다
  if (scale === 'rank') return 'equal'      // 순위 — 이미 균등분포라 등간격이 곧 분위수
  const v = clean(values)
  if (v.length < 12) return 'equal'
  const g = gapRatio(v)
  if (g >= 18) return 'jenks'               // 덩어리가 뚜렷하게 끊긴다
  const sk = Math.abs(skewness(v))
  if (sk >= 1.0) return 'quantile'          // 한쪽으로 심하게 몰려 있다
  if (sk >= 0.55) return 'jenks'
  return 'equal'
}

// 자동으로 고른 이유를 한 줄로 — 범례에 그대로 띄운다.
export function autoReason(values, scale) {
  const mode = autoMode(values, scale)
  if (scale === 'div') return '순위가 오른 쪽과 내린 쪽이 대칭이 되도록 평균 ±σ로 끊었습니다'
  if (scale === 'rank') return '순위는 이미 고르게 퍼져 있어 같은 폭으로 끊었습니다'
  const sk = skewness(values)
  if (mode === 'quantile') return `값이 ${sk > 0 ? '낮은' : '높은'} 쪽에 몰려 있어 각 단계에 같은 수가 들어가게 끊었습니다`
  if (mode === 'jenks') return '값이 덩어리로 끊겨 있어 실제 틈이 벌어지는 지점에서 끊었습니다'
  return '값이 고르게 퍼져 있어 같은 폭으로 끊었습니다'
}
