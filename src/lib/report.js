// 진단표 셈법 — 원값·표준점수(T)·백분위를 한 줄로 읽기 위한 계산부.
//   원값    : 자료에 들어 있는 값 그대로
//   표준화  : 방법에 따라 0~100 눈금 위로 옮긴 값
//   표준점수: T점수 = 50 + 10z.  전국 평균이 50, 표준편차가 10이다.
//             50이 한가운데, 60이면 평균보다 1 표준편차 위, 40이면 1 표준편차 아래.
//   백분위  : 나보다 낮은 점수를 받은 지역의 비율(%) — 100에 가까울수록 상위
//
// 표준화 방법을 바꾸면 z가 달라지므로 T점수도 함께 달라진다. 바로 그 차이를 보여주는
// 것이 이 화면의 목적이다.
//
// 9등급 표기는 두지 않는다. 등급은 백분위를 아홉 칸으로 자른 것뿐이라 백분위와
// 겹치는 데다, 경계선 근처에서 0.1%p 차이가 한 등급 차이로 보이게 만든다.

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

// T점수 눈금 — 진단표 막대의 눈금선 자리. 30·40·50·60·70
export const T_TICKS = [30, 40, 50, 60, 70]
export const T_MIN = 20
export const T_MAX = 80
// T점수를 막대 위 위치(0~1)로. 20~80 바깥은 끝에 붙인다.
export const tPos = (t) => (num(t) ? Math.min(1, Math.max(0, (t - T_MIN) / (T_MAX - T_MIN))) : null)

// 평균에서 얼마나 떨어져 있나 — 색 하나로 읽는 눈금
// 파랑 = 평균 위, 회색 = 평균 언저리, 주황 = 평균 아래
export function tColor(t) {
  if (!num(t)) return '#8894A4'
  if (t >= 65) return '#0A6FB3'
  if (t >= 57) return '#0B93EE'
  if (t >= 53) return '#5FB6F5'
  if (t > 47) return '#8894A4'
  if (t > 43) return '#FDA35A'
  if (t > 35) return '#F5760D'
  return '#C85B06'
}
// 평균과 견준 한 마디
export function tWord(t) {
  if (!num(t)) return '—'
  if (t >= 65) return '전국 평균보다 크게 높음'
  if (t >= 57) return '전국 평균보다 높음'
  if (t >= 53) return '전국 평균보다 조금 높음'
  if (t > 47) return '전국 평균 수준'
  if (t > 43) return '전국 평균보다 조금 낮음'
  if (t > 35) return '전국 평균보다 낮음'
  return '전국 평균보다 크게 낮음'
}

export const fmtT = (v) => (num(v) ? v.toFixed(1) : '—')
export const fmtPct = (v) => (num(v) ? `${v.toFixed(1)}%` : '—')
export const fmtRank = (v) => (num(v) ? `${Math.round(v)}위` : '—')
