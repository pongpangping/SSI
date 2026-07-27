// 성적표 셈법 — 모의고사 성적표와 같은 방식으로 점수를 읽는다.
//   원점수  : 표준화한 값 그대로 (0~100)
//   표준점수: T점수 = 50 + 10z  (전국 평균 50, 표준편차 10)
//   백분위  : 나보다 낮은 점수를 받은 지역의 비율(%) — 100에 가까울수록 상위
//   등급    : 상위 누적비율 기준 9등급
// 표준화 방법을 바꾸면 z가 달라지므로 T점수·등급도 함께 달라진다.
// 바로 그 차이를 보여주는 것이 이 화면의 목적이다.

const num = (x) => x != null && Number.isFinite(x)

// 값 목록 → T점수 목록 (빈칸은 빈칸으로 남긴다)
export function tScore(values) {
  const v = values.filter(num)
  const n = v.length
  if (n < 2) return values.map(() => (n ? 50 : null))
  const m = v.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) || 1
  return values.map((x) => (num(x) ? 50 + 10 * (x - m) / sd : null))
}

// 순위(1 = 최상위) → 백분위
export const pctFromRank = (rank, n) => (num(rank) ? (n - rank) / n * 100 : null)

// 수능·모의고사 9등급 구분선(상위 누적 %)
export const GRADE_CUT = [4, 11, 23, 40, 60, 77, 89, 96]
export function gradeFromRank(rank, n) {
  if (!num(rank)) return null
  const top = rank / n * 100
  for (let i = 0; i < GRADE_CUT.length; i++) if (top <= GRADE_CUT[i]) return i + 1
  return 9
}
// 1~3등급 파랑 / 4~6등급 회색 / 7~9등급 주황 — 지도 색과 같은 계열
export const GRADE_COLOR = ['#0A6FB3', '#0B93EE', '#5FB6F5', '#8894A4', '#8894A4', '#8894A4',
  '#FDA35A', '#F5760D', '#C85B06']
export const gradeColor = (g) => GRADE_COLOR[(g || 1) - 1] || '#8894A4'

// 등급 구간이 전체에서 차지하는 위치(0~1) — 성적표 막대 그리기용
export const GRADE_BAND = GRADE_CUT.map((c) => c / 100)

export const fmtT = (v) => (num(v) ? v.toFixed(1) : '—')
export const fmtPct = (v) => (num(v) ? `${v.toFixed(1)}%` : '—')
export const fmtRank = (v) => (num(v) ? `${Math.round(v)}위` : '—')
