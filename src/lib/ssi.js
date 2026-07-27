import data from '../data/ssi.json'
import { standardizeInd, rankDesc } from './standardize.js'
import { tScore, pctFromRank, gradeFromRank } from './report.js'

export const META = data.meta
export const COLUMNS = data.columns          // 컬럼메타데이터 시트 40행 전체
export const SECTORS = data.sectors
export const METHODS = data.methods          // [{key,label,camp,short,formula,range,note}]
export const ROWS = data.rows
export const N = ROWS.length

// 부문·방법 목록은 언제나 데이터에서 읽는다.
// 8개 부문 · 부문당 10개 지표로 늘어나도, LQ가 들어오고 로지스틱이 빠져도
// 데이터 파일만 바꾸면 화면 전체가 따라오도록 하기 위한 것.
export const SECTOR_KEYS = Object.keys(SECTORS)
export const METHOD_KEYS = METHODS.map((m) => m.key)
export const methodOf = (k) => METHODS.find((m) => m.key === k) || METHODS[0]
export const indsOf = (sector) => SECTORS[sector]?.inds || []

export const keyOf = (sido, name) => `${sido}|${name}`
export const rowKey = (r) => keyOf(r.sido, r.name)

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
// 소속 방법 목록과 대표 방법은 데이터에서 채운다.
// 로지스틱이 빠지고 LQ가 들어와도 이 표를 손댈 필요가 없게 하기 위한 것.
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
// 각 진영의 대표 방법 — 데이터에 실제로 살아 있는 것만.
export const CAMP_REPS = (() => {
  const reps = CAMP_NAMES.map((n) => CAMP[n].rep).filter((k) => METHOD_KEYS.includes(k))
  return reps.length >= 2 ? reps : [METHOD_KEYS[0], METHOD_KEYS[1] || METHOD_KEYS[0]]
})()
// 지금 보는 방법과 '가장 다른' 방법 = 반대 진영의 대표. 진영이 하나뿐이면 다른 아무 방법.
export function otherMethodOf(mk) {
  const c = campOf(mk)
  const rep = CAMP_NAMES.filter((n) => n !== c).map((n) => CAMP[n].rep)
    .find((k) => METHOD_KEYS.includes(k) && k !== mk)
  return rep || METHOD_KEYS.find((k) => k !== mk) || mk
}

// ── 지표 원자료 · 표준화값 캐시 ───────────────────────────────────────────
const rawCache = {}
export function rawSeries(sector, label) {
  const k = `${sector}|${label}`
  if (!rawCache[k]) rawCache[k] = ROWS.map((r) => r[sector].raw[label])
  return rawCache[k]
}
const stdCache = {}
export function stdSeries(sector, label, method) {
  const k = `${sector}|${label}|${method}`
  if (!stdCache[k]) {
    const ind = SECTORS[sector].inds.find((i) => i.label === label)
    stdCache[k] = standardizeInd(rawSeries(sector, label), ind.dir, method)
  }
  return stdCache[k]
}
const idxCache = {}
export function rowIndex(key) {
  if (!Object.keys(idxCache).length) ROWS.forEach((r, i) => { idxCache[rowKey(r)] = i })
  return idxCache[key]
}

// 지표 1개 단위 순위 (방법 무관하게 동일함을 증명하는 데 사용)
const indRankCache = {}
export function indRank(sector, label, method) {
  const k = `${sector}|${label}|${method}`
  if (!indRankCache[k]) indRankCache[k] = rankDesc(stdSeries(sector, label, method))
  return indRankCache[k]
}

// ── 성적표용 파생값 (T점수 · 백분위 · 등급) ──────────────────────────────
// 지표 1개: 표준화값 → T점수 / 순위 → 백분위 · 등급
const indTCache = {}
export function indT(sector, label, method) {
  const k = `${sector}|${label}|${method}`
  if (!indTCache[k]) indTCache[k] = tScore(stdSeries(sector, label, method))
  return indTCache[k]
}
// 부문 CI: CI값 → T점수
const ciTCache = {}
export function ciT(sector, method) {
  const k = `${sector}|${method}`
  if (!ciTCache[k]) ciTCache[k] = tScore(ROWS.map((r) => r[sector].ci[method]))
  return ciTCache[k]
}
export const pctOf = (rank) => pctFromRank(rank, N)
export const gradeOf = (rank) => gradeFromRank(rank, N)

// ── 색 스케일 ────────────────────────────────────────────────────────────
export const HEAT = ['#FFF3E6', '#FFDDBC', '#FFC38C', '#FDA35A', '#F5760D', '#C85B06', '#8F3F03']
export const BLUE = ['#EAF6FF', '#CBE8FC', '#9AD3FF', '#5FB6F5', '#0B93EE', '#0A6FB3', '#08507F']
export const GREEN = ['#EDFAF0', '#CDF0D6', '#A2E3B4', '#6FD08D', '#2FB86A', '#1D8A4E', '#136135']
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

// 값 → 7단계 등급 (지도 색 등급 비교용)
export function binOf(values) {
  const v = values.filter((x) => x != null)
  const lo = Math.min(...v), hi = Math.max(...v), d = (hi - lo) || 1
  return values.map((x) => (x == null ? -1 : Math.min(6, Math.floor((x - lo) / d * 7))))
}

// ── 지도 지표 정의 (선택된 표준화 방법에 따라 값이 바뀐다) ─────────────────
// 묶음 순서는 성적표를 읽는 순서 그대로다.
//   ① 부문 종합 — 총점·전국순위·표준점수
//   ② 지표 · ○○ — 지표 하나마다 원점수 → 표준화 → 표준점수 → 순위 (지표 수만큼 반복)
//   ③ 표준화 민감도 — 방법을 바꿨을 때 순위가 얼마나 흔들리는가
//   ④ 참고 플래그
export const GRP = { total: '부문 종합', sens: '표준화 민감도', flag: '참고 플래그' }
export const indGroup = (label) => `지표 · ${label}`

export function metricsFor(sector, method) {
  const m = methodOf(method)
  const other = otherMethodOf(method)
  const om = methodOf(other)
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
      desc: '전국 평균을 50, 표준편차를 10으로 맞춘 점수. 성적표의 표준점수와 같은 방식.',
      fmt: (v) => (v == null ? '—' : v.toFixed(1)), get: (r, i) => ciT(sector, method)[i] },
    { key: 'pct', group: GRP.total, scale: 'green', dynamic: true,
      label: `백분위 · ${m.label}`,
      desc: '나보다 점수가 낮은 지역의 비율(%). 100에 가까울수록 상위.',
      fmt: (v) => (v == null ? '—' : `${v.toFixed(1)}%`),
      get: (r) => pctOf(r[sector].rank[method]) },
    { key: 'grade', group: GRP.total, scale: 'rank', dynamic: true,
      label: `등급 (9등급) · ${m.label}`,
      desc: '상위 누적비율 기준 9등급. 1등급 = 상위 4%.',
      fmt: (v) => (v == null ? '—' : `${v}등급`), get: (r) => gradeOf(r[sector].rank[method]) },
    { key: 'shift', group: GRP.total, scale: 'div', dynamic: true,
      label: `순위 변화 · ${m.label} → ${om.label}`,
      desc: `${m.label} 순위에서 ${om.label} 순위로 갈 때의 변동. 파랑(음수) = ${om.label}에서 순위 상승.`,
      fmt: (v) => (v == null ? '—' : v > 0 ? `▲${v}계단 하락` : v < 0 ? `▼${-v}계단 상승` : '변동 없음'),
      get: (r) => r[sector].rank[other] - r[sector].rank[method] },
  ]

  // ② 지표별 묶음 — 지표 하나가 상자 하나. 10개로 늘어나도 상자가 10개 될 뿐이다.
  indsOf(sector).forEach((ind) => {
    const g = indGroup(ind.label)
    const up = ind.dir === '+'
    list.push({
      key: `raw:${ind.label}`, group: g, scale: up ? 'green' : 'heat',
      label: `원점수 (${ind.unit || '원자료'})`,
      desc: `${ind.desc} 방향 ${up ? '+1 (높을수록 좋음)' : '−1 (낮을수록 좋음)'}.`,
      fmt: (v) => (v == null ? '—' : `${v}${ind.unit || ''}`), get: (r) => r[sector].raw[ind.label],
    })
    list.push({
      key: `std:${ind.label}`, group: g, scale: 'blue', dynamic: true,
      label: `표준화 점수 · ${m.label}`,
      desc: `원점수를 ${m.label}으로 표준화한 값(방향 반영). 지표 1개만 보면 어떤 방법을 써도 순위는 같다.`,
      fmt: (v) => (v == null ? '—' : v.toFixed(1)),
      get: (r, i) => stdSeries(sector, ind.label, method)[i],
    })
    list.push({
      key: `t:${ind.label}`, group: g, scale: 'blue', dynamic: true,
      label: `표준점수(T) · ${m.label}`,
      desc: '전국 평균 50 · 표준편차 10 기준 점수. 표준화 방법을 바꾸면 이 값이 달라진다.',
      fmt: (v) => (v == null ? '—' : v.toFixed(1)),
      get: (r, i) => indT(sector, ind.label, method)[i],
    })
    list.push({
      key: `rank:${ind.label}`, group: g, scale: 'rank',
      label: '지표 전국 순위',
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

  // ④ 부문에 실제로 들어 있는 플래그만 노출한다
  if (ROWS.some((r) => r[sector] && r[sector].tradeoff != null)) {
    list.push({
      key: 'tradeoff', group: GRP.flag, scale: 'heat',
      label: '트레이드오프 지역',
      desc: '지표 간 백분위 순위 차이가 30%p를 초과 — 한쪽은 앞서고 한쪽은 뒤처지는 지역.',
      fmt: (v) => (v ? '해당' : '해당 없음'), get: (r) => (r[sector].tradeoff ? 1 : 0),
    })
  }
  return list
}
export const metricFor = (sector, method, key) =>
  metricsFor(sector, method).find((x) => x.key === key) || metricsFor(sector, method)[0]

export function valuesOf(metric) { return ROWS.map((r, i) => metric.get(r, i)) }

export function extentOf(metric) {
  const v = valuesOf(metric).filter((x) => x != null && !Number.isNaN(x))
  return [Math.min(...v), Math.max(...v)]
}

// ── 요약 통계 ────────────────────────────────────────────────────────────
export function sectorSummary(sector) {
  const c = ROWS.map((r) => r[sector].ssiCamp).filter((x) => x != null)
  const high = ROWS.filter((r) => r[sector].flag === 'high').length
  const over10 = c.filter((x) => x >= 10).length
  return {
    n: ROWS.length, high, over10,
    avg: c.reduce((a, b) => a + b, 0) / c.length,
    max: Math.max(...c),
    med: [...c].sort((a, b) => a - b)[Math.floor(c.length / 2)],
  }
}

// ── 원본 40개 컬럼 그대로 되살리기 (데이터표 · CSV 내보내기용) ─────────────
const MCOL = Object.fromEntries(METHODS.map((m) => [m.col, m.key]))

export function flatValue(row, col) {
  if (col === '시도') return row.sido
  if (col === '시군구') return row.name
  const s = col.slice(0, 2)
  const d = row[s]
  if (!d) return null
  const rest = col.slice(3)
  if (rest.startsWith('CI_')) return d.ci[MCOL[rest.slice(3)]]
  if (rest.startsWith('순위_')) return d.rank[MCOL[rest.slice(3)]]
  if (rest === 'SSI_range') return d.ssiRange
  if (rest === 'SSI_std') return d.ssiStd
  if (rest === 'SSI_camp') return d.ssiCamp
  if (rest === '민감구분') return d.flag
  if (rest === 'MinMax대표순위') return d.repMinmax
  if (rest === 'PctRank대표순위') return d.repPctrank
  if (rest.startsWith('원자료_')) return d.raw[rest.slice(4)]
  if (rest === '트레이드오프_참고') return d.tradeoff ? 'Y' : 'N'
  return null
}

// 데이터표 기본 컬럼 순서 = 원본 시트 순서
export const SHEET_ORDER = (() => {
  const out = ['시도', '시군구']
  for (const s of SECTOR_KEYS) {
    METHODS.forEach((m) => out.push(`${s}_CI_${m.col}`))
    METHODS.forEach((m) => out.push(`${s}_순위_${m.col}`))
    out.push(`${s}_SSI_range`, `${s}_SSI_std`, `${s}_SSI_camp`, `${s}_민감구분`,
      `${s}_MinMax대표순위`, `${s}_PctRank대표순위`)
    indsOf(s).forEach((i) => out.push(`${s}_원자료_${i.label}`))
  }
  for (const s of SECTOR_KEYS) {
    if (ROWS.some((r) => r[s] && r[s].tradeoff != null)) out.push(`${s}_트레이드오프_참고`)
  }
  return out
})()

export const COLMETA = Object.fromEntries(COLUMNS.map((c) => [c.name, c]))

// ── 부문 성적표 (229행 × 지표수) ─────────────────────────────────────────
// 한 부문 · 한 표준화 방법에 대해 전 시군구 성적표를 통째로 만든다.
// 지표가 10개로 늘면 열이 10×5개가 되고, 방법을 바꾸면 표 한 벌이 새로 나온다.
export function reportTable(sector, method) {
  const inds = indsOf(sector)
  const cols = ['시도', '시군구']
  inds.forEach((i) => cols.push(
    `${i.label}_원점수`, `${i.label}_표준화`, `${i.label}_T점수`, `${i.label}_순위`, `${i.label}_등급`))
  cols.push('부문점수_CI', '부문_T점수', '부문_백분위', '부문_전국순위', '부문_등급')

  const std = inds.map((i) => stdSeries(sector, i.label, method))
  const tt = inds.map((i) => indT(sector, i.label, method))
  const rk = inds.map((i) => indRank(sector, i.label, method))
  const ct = ciT(sector, method)
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10)

  const rows = ROWS.map((r, i) => {
    const d = r[sector]
    const o = { 시도: r.sido, 시군구: r.name }
    inds.forEach((ind, j) => {
      o[`${ind.label}_원점수`] = d.raw[ind.label]
      o[`${ind.label}_표준화`] = r1(std[j][i])
      o[`${ind.label}_T점수`] = r1(tt[j][i])
      o[`${ind.label}_순위`] = rk[j][i]
      o[`${ind.label}_등급`] = gradeOf(rk[j][i])
    })
    o['부문점수_CI'] = r1(d.ci[method])
    o['부문_T점수'] = r1(ct[i])
    o['부문_백분위'] = r1(pctOf(d.rank[method]))
    o['부문_전국순위'] = d.rank[method]
    o['부문_등급'] = gradeOf(d.rank[method])
    return o
  })
  return { cols, rows }
}

export function reportCSV(sector, method) {
  const { cols, rows } = reportTable(sector, method)
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export function toCSV(cols = SHEET_ORDER, rows = ROWS) {
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(flatValue(r, c))).join(','))].join('\n')
}

// 방법 A→B 전환 시 색 등급(7단계)이 바뀌는 시군구 수 — "지도가 실제로 얼마나 바뀌나"
export function binChangeCount(sector, from, to) {
  const a = binOf(ROWS.map((r) => r[sector].rank[from]))
  const b = binOf(ROWS.map((r) => r[sector].rank[to]))
  return a.reduce((n, x, i) => n + (x !== b[i] ? 1 : 0), 0)
}
