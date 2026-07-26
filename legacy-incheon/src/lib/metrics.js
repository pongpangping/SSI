import { pct } from './format.js'

// 지도·순위에서 전환 가능한 지표 (인터랙티브)
export const METRICS = [
  {
    key: 'onePersonRate',
    label: '1인가구 비율',
    short: '1인가구율',
    unit: '%',
    fmt: (v) => pct(v),
    desc: '가구원수 1명 가구 ÷ 일반가구 (KOSIS 2023)',
  },
  {
    key: 'agedOneShareOfOne',
    label: '고령 1인가구 비중',
    short: '고령 1인',
    unit: '%',
    fmt: (v) => pct(v),
    desc: '1인가구 중 가구주 65세 이상 비중',
  },
  {
    key: 'avgHouseholdSize',
    label: '세대당 인구',
    short: '세대당 인구',
    unit: '명',
    fmt: (v) => (v == null ? '—' : `${v}명`),
    desc: '주민등록 세대당 평균 인구 (2025)',
  },
  {
    key: 'composite',
    label: '1인가구 집중지수',
    short: '집중지수',
    unit: '점',
    fmt: (v) => (v == null ? '—' : `${Math.round(v)}점`),
    // 방향 정의: 높을수록 1인·고령 가구가 많고 세대 규모가 작음 = 집중·정책관심 방향
    desc: '여러 지표를 가중 합산 · 높을수록 1인·고령·소규모 가구 집중',
    computed: true,
  },
]

export const metricBy = (key) => METRICS.find((m) => m.key === key) ?? METRICS[0]
