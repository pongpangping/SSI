// 자료 파일과 화면 사이의 다리.
//
// v1에서는 이 파일이 '이미 계산이 끝난 표'를 읽어 나눠 주는 일만 했다. v2는 사용자가
// 지표와 연도를 골라 오므로, 고른 조합을 compute.js에 넘겨 계산한 뒤 그 결과를 각 행에
// 얹어 준다(applyPicks). 그래서 지도·표·진단표는 예전처럼 row[부문].ci[방법] 하나만
// 알면 되고, 조합이 바뀌었다는 사실을 따로 알 필요가 없다.

import data from '../data/ssi.json'
import {
  ROWS, N, SERIES, METHODS, METHOD_KEYS, CAMP_REPS,
  computeSet, standardizeSeries, rankDesc, tScore, pctFromRank, spearman, pearson,
} from './compute.js'

export { ROWS, N, SERIES, METHODS, METHOD_KEYS, CAMP_REPS, spearman, pearson, rankDesc, tScore }

export const META = data.meta
export const SECTORS = data.sectors
export const INDICATORS = data.indicators
export const IND = Object.fromEntries(INDICATORS.map((i) => [i.id, i]))

// 열 개 부문 전부 / 자료가 들어온 부문만
export const ALL_SECTOR_KEYS = data.sectorKeys
export const SECTOR_KEYS = ALL_SECTOR_KEYS.filter((k) => SECTORS[k].ready)
export const isReady = (k) => !!SECTORS[k]?.ready

// 원값 적기 — 출처마다 소수 자릿수가 제각각이라 그대로 찍으면 4339647.152095 같은
// 숫자가 그대로 화면에 나온다. 크기에 따라 읽을 만큼만 남기고, 큰 수는 자릿점을 찍는다.
const trimZero = (s) => (s.indexOf('.') < 0 ? s : s.replace(/\.?0+$/, ''))
export function fmtRaw(v) {
  if (v == null || Number.isNaN(v)) return '—'
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 10000) return Math.round(v).toLocaleString('ko-KR')
  if (a >= 1000) return trimZero(v.toFixed(1))
  if (a >= 100) return trimZero(v.toFixed(2))
  if (a >= 1) return trimZero(v.toFixed(2))
  if (a >= 0.01) return trimZero(v.toFixed(3))
  return trimZero(Number(v.toPrecision(3)).toString())
}

export const methodOf = (k) => METHODS.find((m) => m.key === k) || METHODS[0]
export const keyOf = (sido, name) => `${sido}|${name}`
export const rowKey = (r) => keyOf(r.sido, r.name)

// 계열 이름(S8_1_23) → 지표·연도 되찾기. 주소창 해시를 읽을 때 쓴다.
const COL2PICK = (() => {
  const m = {}
  INDICATORS.forEach((i) => Object.entries(i.cols).forEach(([y, c]) => { m[c] = { id: i.id, year: +y } }))
  return m
})()
export const pickOfCol = (col) => COL2PICK[col] || null

// ── 행정구역 ─────────────────────────────────────────────────────────────
export const SIDOS = (() => {
  const seen = []
  ROWS.forEach((r) => { if (!seen.includes(r.sido)) seen.push(r.sido) })
  return seen.sort((a, b) => a.localeCompare(b, 'ko'))
})()
const SIDO_ABBR = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천',
  광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종',
  경기도: '경기', 강원도: '강원', 강원특별자치도: '강원',
  충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북',
  전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
  제주도: '제주', 제주특별자치도: '제주',
}
export const shortSido = (s) => SIDO_ABBR[s] || (s || '')
  .replace('특별자치도', '').replace('특별자치시', '').replace('광역시', '')
  .replace('특별시', '').replace(/도$/, '')
export function rowsOfSido(sido) {
  return (sido ? ROWS.filter((r) => r.sido === sido) : ROWS)
    .slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}
export const sidoCount = (sido) => ROWS.reduce((n, r) => n + (r.sido === sido ? 1 : 0), 0)

// 두 진영 — 지침서 8장
export const CAMP = {
  간격보존형: { color: '#0B93EE', rep: 'minmax', methods: [],
    desc: '값의 간격을 선형·단조로 보존한다.' },
  순위전용형: { color: '#F5760D', rep: 'pctrank', methods: [],
    desc: '등수만 반영하고 간격 정보를 버린다.' },
}
Object.keys(CAMP).forEach((n) => {
  const ks = METHODS.filter((m) => m.camp === n).map((m) => m.key)
  CAMP[n].methods = ks
  if (!ks.includes(CAMP[n].rep)) CAMP[n].rep = ks[0] || CAMP[n].rep
})
export const campOf = (mk) => methodOf(mk)?.camp
export const CAMP_NAMES = Object.keys(CAMP)
export function otherMethodOf(mk) {
  const c = campOf(mk)
  const rep = CAMP_NAMES.filter((n) => n !== c).map((n) => CAMP[n].rep)
    .find((k) => METHOD_KEYS.includes(k) && k !== mk)
  return rep || METHOD_KEYS.find((k) => k !== mk) || mk
}

// ── 선택 조합 ────────────────────────────────────────────────────────────
// pick = { id: 'S8_1', year: 2023 }.  선택 순서가 화면에 나오는 순서다.
export const indicatorsOf = (sector) => (SECTORS[sector]?.inds || []).map((id) => IND[id]).filter(Boolean)
export const latestYear = (ind) => ind.years[ind.years.length - 1]
export const defaultPicks = (sector) => indicatorsOf(sector).map((i) => ({ id: i.id, year: latestYear(i) }))
export const colOfPick = (p) => IND[p.id]?.cols[p.year] || null

// 선택한 것들이 한 해로 맞춰져 있으면 이름만, 여러 해가 섞였으면 이름 뒤에 연도를 붙인다.
function entriesOf(sector, picks) {
  const years = []
  picks.forEach((p) => { if (!years.includes(p.year)) years.push(p.year) })
  const mixed = years.length > 1
  return picks.map((p) => {
    const ind = IND[p.id]
    if (!ind) return null
    return {
      id: ind.id, sector, year: p.year, col: ind.cols[p.year], no: ind.no,
      label: mixed ? `${ind.label} (${p.year})` : ind.label,
      name: ind.label, dir: ind.dir, unit: ind.unit || '',
      desc: ind.desc || '', formula: ind.formula || '', source: ind.source || '', note: ind.note || '',
    }
  }).filter((e) => e && e.col)
}

// 지금 부문별로 담겨 있는 것 — 계산 결과와 함께 여기 둔다.
const CUR = {}
let VER = 0
export const picksVersion = () => VER

const byMethod = (obj, i) => Object.fromEntries(METHOD_KEYS.map((m) => [m, obj[m][i]]))

// 고른 조합으로 부문 하나를 다시 계산하고 결과를 각 행에 얹는다.
export function applyPicks(sector, picks) {
  const entries = entriesOf(sector, picks || [])
  if (!entries.length) {
    CUR[sector] = { entries: [], set: null }
    ROWS.forEach((r) => { r[sector] = null })
    VER += 1
    return CUR[sector]
  }
  const set = computeSet(entries.map((e) => ({ col: e.col, dir: e.dir })), sector)
  const [ra, rb] = CAMP_REPS
  ROWS.forEach((r, i) => {
    const raw = {}
    entries.forEach((e) => { raw[e.label] = SERIES[e.col] ? SERIES[e.col][i] : null })
    r[sector] = {
      ci: byMethod(set.ci, i),
      rank: byMethod(set.rank, i),
      ssiCamp: set.camp[i], ssiRange: set.range[i], ssiStd: set.rstd[i],
      flag: set.flag[i], prSpread: set.spread[i], tradeoff: set.tradeoff[i],
      repMinmax: set.rank[ra][i], repPctrank: set.rank[rb][i],
      raw,
    }
  })
  CUR[sector] = { entries, set }
  VER += 1
  return CUR[sector]
}

// 화면이 열리기 전에도 row[부문]이 비어 있지 않도록 기본 조합으로 한 번 채워 둔다.
SECTOR_KEYS.forEach((k) => applyPicks(k, defaultPicks(k)))

export const indsOf = (sector) => CUR[sector]?.entries || []
export const setOf = (sector) => CUR[sector]?.set || null

// 전처리 덮어쓰기 계산(44차) — 같은 지표 조합을 다른 전처리로 다시 계산한 세트.
// tr: 'cur'(2단계 설정 그대로) | 'none' | 'log' | 'rlog' (일괄 변환 · 윈저 없음)
// wt: 'cur'(4단계 가중치 그대로) | 'equal' (동일가중)
// 2종 비교에서 '로그화 대 반로그화', '가중치 대 동일가중'을 나란히 볼 때 쓴다.
// computeSet이 조합별로 기억해 두므로 몇 번을 물어도 계산은 한 번이다.
export function ovSet(sector, tr = 'none', wt = 'equal') {
  const entries = CUR[sector]?.entries || []
  if (!entries.length) return null
  return computeSet(entries.map((e) => ({ col: e.col, dir: e.dir })), sector, { tr, wt })
}
export const plainSet = (sector) => ovSet(sector, 'none', 'equal')
export const picksOf = (sector) => (CUR[sector]?.entries || []).map((e) => ({ id: e.id, year: e.year }))
// 선택 조합을 한 줄로: "S8_1_23.S8_2_23"
export const picksToHash = (picks) => picks.map(colOfPick).filter(Boolean).join('.')
export function picksFromHash(s) {
  if (!s) return null
  const out = s.split('.').map((c) => COL2PICK[c]).filter(Boolean)
  return out.length ? out : null
}

const entryIdx = (sector, label) => (CUR[sector]?.entries || []).findIndex((e) => e.label === label)

export function rawSeries(sector, label) {
  const j = entryIdx(sector, label)
  if (j < 0) return ROWS.map(() => null)
  const col = CUR[sector].entries[j].col
  return SERIES[col] || ROWS.map(() => null)
}
export function stdSeries(sector, label, method) {
  const j = entryIdx(sector, label)
  const set = setOf(sector)
  if (j < 0 || !set) return ROWS.map(() => null)
  return set.std[method][j]
}
export function indRank(sector, label, method) {
  const j = entryIdx(sector, label)
  const set = setOf(sector)
  if (j < 0 || !set) return ROWS.map(() => null)
  return set.indRank[method][j]
}
export function indT(sector, label, method) {
  const j = entryIdx(sector, label)
  const set = setOf(sector)
  if (j < 0 || !set) return ROWS.map(() => null)
  return set.indT[method][j]
}
export function ciT(sector, method) {
  const set = setOf(sector)
  return set ? set.ciT[method] : ROWS.map(() => null)
}

const idxCache = {}
export function rowIndex(key) {
  if (!Object.keys(idxCache).length) ROWS.forEach((r, i) => { idxCache[rowKey(r)] = i })
  return idxCache[key]
}

export const pctOf = (rank) => pctFromRank(rank, N)

// ── 색 스케일 ────────────────────────────────────────────────────────────
export const HEAT = ['#FFF3E6', '#FFDDBC', '#FFC38C', '#FDA35A', '#F5760D', '#C85B06', '#8F3F03']
export const BLUE = ['#EAF6FF', '#CBE8FC', '#9AD3FF', '#5FB6F5', '#0B93EE', '#0A6FB3', '#08507F']
export const GREEN = ['#EDFAF0', '#CDF0D6', '#A2E3B4', '#6FD08D', '#2FB86A', '#1D8A4E', '#136135']
export const PURPLE = ['#F5F0FC', '#E4D6F8', '#C9AFF0', '#A97FE4', '#8248D2', '#6231A6', '#452274']
export const DIV = ['#08507F', '#0B93EE', '#9AD3FF', '#EEF1F5', '#FFC38C', '#F5760D', '#8F3F03']

const RAMP = { heat: HEAT, blue: BLUE, green: GREEN, rank: BLUE, div: DIV }

export function colorFn(scale, min, max) {
  const ramp = RAMP[scale] || BLUE
  if (scale === 'div') {
    const m = Math.max(Math.abs(min), Math.abs(max)) || 1
    return (v) => {
      if (v == null) return '#E9ECF1'
      const t = (v / m + 1) / 2
      return ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)))]
    }
  }
  const d = (max - min) || 1
  return (v) => {
    if (v == null) return '#E9ECF1'
    let t = (v - min) / d
    if (scale === 'rank') t = 1 - t                 // 1위가 진하게
    return ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)))]
  }
}

// 값 → 7단계 색 구간 (지도가 실제로 얼마나 바뀌는지 셀 때 쓴다)
export function binOf(values) {
  const v = values.filter((x) => x != null)
  if (!v.length) return values.map(() => -1)
  const lo = Math.min(...v), hi = Math.max(...v), d = (hi - lo) || 1
  return values.map((x) => (x == null ? -1 : Math.min(6, Math.floor((x - lo) / d * 7))))
}

// ── 지도 색 기준 ─────────────────────────────────────────────────────────
// 최상위는 네 묶음으로 고정한다. 지표를 몇 개 고르든 목록의 첫 층은 늘 이 넷이다.
//
//   ① 부문 종합      점수 · 순위 · 표준점수 · 백분위 · 순위 변화
//   ② 원데이터        지표별 소묶음. 지표 하나마다 원값 → 표준화 → 표준점수 → 순위
//   ③ 표준화 민감도   방법을 바꿨을 때 순위가 얼마나 흔들리는가
//   ④ 참고 플래그
//
// 17차까지는 지표 하나가 곧 최상위 묶음('지표 · 인구변화율')이었다. 지표를 여덟
// 개 고르면 최상위가 열한 칸으로 늘어나, 무엇이 부문 종합이고 무엇이 원데이터인지
// 첫 층만 봐서는 알 수 없었다. 지표는 원데이터 안쪽 한 층 아래로 내린다.
export const GRP = { total: '부문 종합', raw: '원데이터', sens: '표준화 민감도', flag: '참고 플래그' }
export const GRP_ORDER = [GRP.total, GRP.raw, GRP.sens, GRP.flag]

export function metricsFor(sector, method) {
  const m = methodOf(method)
  const other = otherMethodOf(method)
  const om = methodOf(other)
  if (!setOf(sector)) return []
  const list = [
    { key: 'ci', group: GRP.total, scale: 'blue', dynamic: true,
      label: `부문 점수 (CI) · ${m.label}`,
      desc: `${m.label}으로 표준화한 지표들을 같은 비중으로 평균한 부문 총점. 범위 ${m.range}.`,
      fmt: (v) => (v == null ? '—' : v.toFixed(1)), get: (r) => r[sector].ci[method] },
    { key: 'rank', group: GRP.total, scale: 'rank', dynamic: true,
      label: `전국 순위 · ${m.label}`,
      desc: `${m.label} 부문 점수 기준 ${N}개 시군구 중 순위(1 = 최상위).`,
      fmt: (v) => (v == null ? '—' : `${v}위`), get: (r) => r[sector].rank[method] },
    { key: 'ciT', group: GRP.total, scale: 'blue', dynamic: true,
      label: `표준점수(T) · ${m.label}`,
      desc: '전국 평균이 50, 표준편차가 10이 되도록 맞춘 점수. 50이 한가운데, 60이면 평균보다 1 표준편차 위다.',
      fmt: (v) => (v == null ? '—' : v.toFixed(1)), get: (r, i) => ciT(sector, method)[i] },
    { key: 'pct', group: GRP.total, scale: 'green', dynamic: true,
      label: `백분위 · ${m.label}`,
      desc: '나보다 점수가 낮은 지역의 비율(%). 100에 가까울수록 상위.',
      fmt: (v) => (v == null ? '—' : `${v.toFixed(1)}%`),
      get: (r) => pctOf(r[sector].rank[method]) },
    { key: 'shift', group: GRP.total, scale: 'div', dynamic: true,
      label: `순위 변화 · ${m.label} → ${om.label}`,
      desc: `${m.label} 순위에서 ${om.label} 순위로 갈 때의 변동. 파랑(음수) = ${om.label}에서 순위 상승.`,
      fmt: (v) => (v == null ? '—' : v > 0 ? `▲${v}계단 하락` : v < 0 ? `▼${-v}계단 상승` : '변동 없음'),
      get: (r) => r[sector].rank[other] - r[sector].rank[method] },
  ]

  // ② 원데이터 — 최상위는 '원데이터' 하나. 지표 이름은 sub 로 달아 두고,
  //    조작부가 그 값으로 한 층 더 접었다 폈다 한다.
  indsOf(sector).forEach((ind) => {
    const g = GRP.raw
    const up = ind.dir === '+'
    list.push({
      key: `raw:${ind.label}`, group: g, sub: ind.label, scale: up ? 'green' : 'heat',
      label: `원값 (${ind.unit || '원자료'})`, full: `${ind.label} · 원값`,
      desc: `${ind.desc} 방향 ${up ? '▲ 높을수록 좋음' : '▼ 낮을수록 좋음'}. ${ind.year}년 자료.`,
      fmt: (v) => (v == null ? '—' : `${fmtRaw(v)}${ind.unit || ''}`), get: (r) => r[sector].raw[ind.label],
    })
    list.push({
      key: `std:${ind.label}`, group: g, sub: ind.label, scale: 'blue', dynamic: true,
      label: `표준화 값 · ${m.label}`, full: `${ind.label} · 표준화 값(${m.label})`,
      desc: `원값을 ${m.label}(${m.formula})으로 옮긴 값. 방향도 반영한다. 지표 1개만 보면 어떤 방법을 써도 순위는 같다.`,
      fmt: (v) => (v == null ? '—' : v.toFixed(1)),
      get: (r, i) => stdSeries(sector, ind.label, method)[i],
    })
    list.push({
      key: `t:${ind.label}`, group: g, sub: ind.label, scale: 'blue', dynamic: true,
      label: `표준점수(T) · ${m.label}`, full: `${ind.label} · 표준점수(T)`,
      desc: '전국 평균 50 · 표준편차 10 눈금. 표준화 방법을 바꾸면 이 값이 달라진다.',
      fmt: (v) => (v == null ? '—' : v.toFixed(1)),
      get: (r, i) => indT(sector, ind.label, method)[i],
    })
    list.push({
      key: `rank:${ind.label}`, group: g, sub: ind.label, scale: 'rank',
      label: '지표 전국 순위', full: `${ind.label} · 전국 순위`,
      desc: `${ind.label} 하나만 놓고 매긴 ${N}개 시군구 순위(1 = 최상위).`,
      fmt: (v) => (v == null ? '—' : `${Math.round(v)}위`),
      get: (r, i) => indRank(sector, ind.label, method)[i],
    })
  })

  // ③ 민감도
  const [repA, repB] = CAMP_REPS
  list.push(
    { key: 'ssiCamp', group: GRP.sens, scale: 'heat',
      label: `순위 이동 폭 (${methodOf(repA).label} ↔ ${methodOf(repB).label})`,
      desc: `|${methodOf(repA).label} 순위 − ${methodOf(repB).label} 순위|. 지침서 9장에서 확정한 최종 민감도 지표(SSI_camp).`,
      fmt: (v) => (v == null ? '—' : `${v}계단`), get: (r) => r[sector].ssiCamp },
    { key: 'ssiRange', group: GRP.sens, scale: 'heat',
      label: `순위 최대-최소 차 (${METHODS.length}개 방법)`,
      desc: '모든 방법 순위의 최댓값 − 최솟값. 참고용 민감도(SSI_range).',
      fmt: (v) => (v == null ? '—' : `${v}계단`), get: (r) => r[sector].ssiRange },
    { key: 'ssiStd', group: GRP.sens, scale: 'heat',
      label: `순위 표준편차 (${METHODS.length}개 방법)`,
      desc: '모든 방법 순위의 표준편차. 참고용(SSI_std).',
      fmt: (v) => (v == null ? '—' : v.toFixed(2)), get: (r) => r[sector].ssiStd },
  )

  // ④ 지표가 둘 이상일 때만 뜻이 있는 플래그
  //
  // 20차까지 이 묶음에는 '트레이드오프 지역' 하나뿐이었고, 그 기준이 지표 수와
  // 무관한 고정값(30%p)이라 지표를 여섯 개 고르면 229곳 중 220곳에 표시가 붙었다.
  // 기준을 전국 분포에서 끊도록 고치면서, 표시의 근거가 되는 격차 자체도 지도에서
  // 볼 수 있게 함께 내놓는다. 표시만 있고 값이 없으면 왜 걸렸는지 확인할 길이 없다.
  if (indsOf(sector).length >= 2) {
    const cut = setOf(sector)?.tradeoffCut
    list.push({
      key: 'prSpread', group: GRP.flag, scale: 'heat',
      label: '지표 간 순위 격차',
      desc: '선택한 지표 각각의 백분위 순위 중 가장 높은 값과 가장 낮은 값의 차이(%p). 클수록 어느 지표로 보느냐에 따라 평가가 갈린다.',
      fmt: (v) => (v == null ? '—' : `${v.toFixed(1)}%p`), get: (r) => r[sector].prSpread,
    })
    list.push({
      key: 'tradeoff', group: GRP.flag, scale: 'heat',
      label: '트레이드오프 지역',
      desc: `지표 간 순위 격차가 전국 상위 10%에 드는 지역${cut == null ? '' : ` (${cut.toFixed(1)}%p 이상)`}. 격차는 지표 수가 늘수록 저절로 커지므로 고정 기준 대신 전국 분포에서 끊는다.`,
      fmt: (v) => (v ? '해당' : '해당 없음'), get: (r) => (r[sector].tradeoff ? 1 : 0),
    })
  }
  return list
}
// 선택 지표가 하나도 없으면 그릴 값도 없다. 화면이 무너지지 않도록 빈 색 기준을 준다.
const EMPTY_METRIC = {
  key: 'none', group: '—', scale: 'blue', label: '표시할 값 없음',
  desc: '선택 지표가 없어 계산된 값이 없습니다. [지표 선택]에서 지표를 선택해 주세요.',
  fmt: () => '—', get: () => null,
}
export const metricFor = (sector, method, key) => {
  const list = metricsFor(sector, method)
  return list.find((x) => x.key === key) || list[0] || EMPTY_METRIC
}

export function valuesOf(metric) { return ROWS.map((r, i) => metric.get(r, i)) }

export function extentOf(metric) {
  const v = valuesOf(metric).filter((x) => x != null && !Number.isNaN(x))
  if (!v.length) return [0, 1]
  return [Math.min(...v), Math.max(...v)]
}

// ── 요약 통계 ────────────────────────────────────────────────────────────
export function sectorSummary(sector) {
  const c = ROWS.map((r) => r[sector]?.ssiCamp).filter((x) => x != null)
  if (!c.length) return { n: ROWS.length, high: 0, over10: 0, avg: 0, max: 0, med: 0 }
  const high = ROWS.filter((r) => r[sector]?.flag === 'high').length
  const over10 = c.filter((x) => x >= 10).length
  return {
    n: ROWS.length, high, over10,
    avg: c.reduce((a, b) => a + b, 0) / c.length,
    max: Math.max(...c),
    med: [...c].sort((a, b) => a - b)[Math.floor(c.length / 2)],
  }
}

// ── 전체 표 · CSV ────────────────────────────────────────────────────────
const MCOL = Object.fromEntries(METHODS.map((m) => [m.short, m.key]))
const SECT_HEAD = new RegExp(`^(${ALL_SECTOR_KEYS.join('|')})_`)

export function flatValue(row, col) {
  if (col === '시도') return row.sido
  if (col === '시군구') return row.name
  const mm = col.match(SECT_HEAD)
  if (!mm) return null
  const s = mm[1]
  const d = row[s]
  if (!d) return null
  const rest = col.slice(s.length + 1)
  if (rest.startsWith('CI_')) return d.ci[MCOL[rest.slice(3)]]
  if (rest.startsWith('순위_')) return d.rank[MCOL[rest.slice(3)]]
  if (rest === 'SSI_range') return d.ssiRange
  if (rest === 'SSI_std') return d.ssiStd
  if (rest === 'SSI_camp') return d.ssiCamp
  if (rest === '민감구분') return d.flag
  if (rest === 'MinMax대표순위') return d.repMinmax
  if (rest === 'PctRank대표순위') return d.repPctrank
  if (rest.startsWith('원값_')) return d.raw[rest.slice(3)]
  if (rest === '지표간_순위격차') return d.prSpread
  if (rest === '트레이드오프_참고') return d.tradeoff ? 'Y' : 'N'
  return null
}

// 전체 표의 열 순서. 선택 조합이 바뀌면 원값 열도 따라 바뀐다.
export function sheetOrder() {
  const out = ['시도', '시군구']
  for (const s of SECTOR_KEYS) {
    METHODS.forEach((m) => out.push(`${s}_CI_${m.short}`))
    METHODS.forEach((m) => out.push(`${s}_순위_${m.short}`))
    out.push(`${s}_SSI_range`, `${s}_SSI_std`, `${s}_SSI_camp`, `${s}_민감구분`,
      `${s}_MinMax대표순위`, `${s}_PctRank대표순위`)
    indsOf(s).forEach((i) => out.push(`${s}_원값_${i.label}`))
    if (indsOf(s).length >= 2) out.push(`${s}_지표간_순위격차`, `${s}_트레이드오프_참고`)
  }
  return out
}

// 열 머리글에 붙는 설명. 자료 파일의 메타데이터에서 그때그때 만든다.
export function colMeta(col) {
  if (col === '시도') return { desc: '광역시·도 이름', unit: '문자', how: '행정안전부 행정구역 경계' }
  if (col === '시군구') return { desc: '시·군·구 이름', unit: '문자', how: '행정안전부 행정구역 경계' }
  const mm = col.match(SECT_HEAD)
  if (!mm) return null
  const s = mm[1]
  const sn = SECTORS[s]?.name || s
  const rest = col.slice(s.length + 1)
  const mlab = (sh) => methodOf(MCOL[sh])?.label || sh
  const mfor = (sh) => methodOf(MCOL[sh])?.formula || ''
  if (rest.startsWith('CI_')) {
    const sh = rest.slice(3)
    return { desc: `${sn} 부문 점수 · ${mlab(sh)} 표준화 후 선택 지표 단순평균`,
      unit: methodOf(MCOL[sh])?.range || '0~100', how: mfor(sh) }
  }
  if (rest.startsWith('순위_')) {
    const sh = rest.slice(3)
    return { desc: `${sn} 부문 점수 기준 전국 순위 · ${mlab(sh)}`, unit: `1~${N}위`,
      how: '부문 점수 내림차순, 동점은 평균순위' }
  }
  if (rest === 'SSI_range') return { desc: `${sn} 순위의 최댓값 − 최솟값`, unit: '계단', how: `${METHODS.length}개 방법 순위의 범위` }
  if (rest === 'SSI_std') return { desc: `${sn} 순위의 표준편차`, unit: '계단', how: `${METHODS.length}개 방법 순위의 표본표준편차` }
  if (rest === 'SSI_camp') return { desc: `${sn} 두 진영 대표 방법의 순위 차이`, unit: '계단', how: '|Min-Max 순위 − 백분위순위 순위|', note: '지침서 9장의 최종 민감도 지표' }
  if (rest === '민감구분') return { desc: '민감도 구간', unit: 'low / mid / high', how: '10계단 이상 high, 5계단 이상 mid' }
  if (rest === 'MinMax대표순위') return { desc: '간격보존형 대표(Min-Max) 순위', unit: `1~${N}위`, how: '진영 대표 방법의 순위' }
  if (rest === 'PctRank대표순위') return { desc: '순위전용형 대표(백분위순위) 순위', unit: `1~${N}위`, how: '진영 대표 방법의 순위' }
  if (rest === '트레이드오프_참고') return { desc: '선택 지표 사이 점수 격차가 큰 지역', unit: 'Y / N', how: '지표 백분위 순위 차이 > 30%p' }
  if (rest.startsWith('원값_')) {
    const lab = rest.slice(3)
    const e = indsOf(s).find((x) => x.label === lab)
    if (!e) return { desc: lab, unit: '', how: '' }
    return { desc: e.desc || e.name, unit: e.unit || '', how: e.formula || `${e.year}년 원자료`,
      note: `${e.source}${e.note ? ` · ${e.note}` : ''} · 방향 ${e.dir === '+' ? '▲ 높을수록 좋음' : '▼ 낮을수록 좋음'}` }
  }
  return null
}

// ── 부문 진단표 (229행 × 선택 지표) ──────────────────────────────────────
export function reportTable(sector, method) {
  const inds = indsOf(sector)
  const cols = ['시도', '시군구']
  inds.forEach((i) => cols.push(
    `${i.label}_원값`, `${i.label}_표준화`, `${i.label}_T점수`, `${i.label}_순위`))
  cols.push('부문점수_CI', '부문_T점수', '부문_백분위', '부문_전국순위')

  const std = inds.map((i) => stdSeries(sector, i.label, method))
  const tt = inds.map((i) => indT(sector, i.label, method))
  const rk = inds.map((i) => indRank(sector, i.label, method))
  const ct = ciT(sector, method)
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10)

  const rows = ROWS.map((r, i) => {
    const d = r[sector]
    const o = { 시도: r.sido, 시군구: r.name }
    inds.forEach((ind, j) => {
      o[`${ind.label}_원값`] = d ? d.raw[ind.label] : null
      o[`${ind.label}_표준화`] = r1(std[j][i])
      o[`${ind.label}_T점수`] = r1(tt[j][i])
      o[`${ind.label}_순위`] = rk[j][i]
    })
    o['부문점수_CI'] = r1(d?.ci[method])
    o['부문_T점수'] = r1(ct[i])
    o['부문_백분위'] = r1(pctOf(d?.rank[method]))
    o['부문_전국순위'] = d?.rank[method] ?? null
    return o
  })
  return { cols, rows }
}

const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

export function reportCSV(sector, method) {
  const { cols, rows } = reportTable(sector, method)
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export function toCSV(cols, rows = ROWS) {
  const cs = cols || sheetOrder()
  return '﻿' + [cs.join(','), ...rows.map((r) => cs.map((c) => esc(flatValue(r, c))).join(','))].join('\n')
}

// 방법 A→B 전환 시 색 구간(7단계)이 바뀌는 시군구 수 — "지도가 실제로 얼마나 바뀌나"
export function binChangeCount(sector, from, to) {
  const a = binOf(ROWS.map((r) => r[sector]?.rank[from] ?? null))
  const b = binOf(ROWS.map((r) => r[sector]?.rank[to] ?? null))
  return a.reduce((n, x, i) => n + (x !== b[i] ? 1 : 0), 0)
}

// 산점도 축으로 고를 수 있는 것들 — 선택 지표 + 부문 종합
export function axisOptions(sector, method) {
  const out = [
    { key: 'ci', label: `부문 점수 (CI)`, get: (r) => r[sector]?.ci[method] ?? null },
    { key: 'ciT', label: '부문 표준점수(T)', get: (r, i) => ciT(sector, method)[i] },
    { key: 'rank', label: '부문 전국 순위', get: (r) => r[sector]?.rank[method] ?? null, invert: true },
    { key: 'ssiCamp', label: '표준화 민감도 (순위 이동 폭)', get: (r) => r[sector]?.ssiCamp ?? null },
  ]
  indsOf(sector).forEach((e) => {
    out.push({ key: `raw:${e.label}`, label: `${e.label} 원값${e.unit ? ` (${e.unit})` : ''}`,
      get: (r) => r[sector]?.raw[e.label] ?? null })
    out.push({ key: `std:${e.label}`, label: `${e.label} 표준화 값`,
      get: (r, i) => stdSeries(sector, e.label, method)[i] })
  })
  return out
}
export const axisFor = (sector, method, key) => {
  const list = axisOptions(sector, method)
  return list.find((a) => a.key === key) || list[0]
}
