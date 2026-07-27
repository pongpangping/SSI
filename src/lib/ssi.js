import data from '../data/ssi.json'
import { standardizeInd, rankDesc } from './standardize.js'

export const META = data.meta
export const COLUMNS = data.columns          // 컬럼메타데이터 시트 40행 전체
export const SECTORS = data.sectors
export const METHODS = data.methods          // [{key,label,camp,short,formula,range,note}]
export const ROWS = data.rows
export const N = ROWS.length

export const METHOD_KEYS = METHODS.map((m) => m.key)
export const methodOf = (k) => METHODS.find((m) => m.key === k)

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
export const CAMP = {
  간격보존형: { color: '#0B93EE', rep: 'minmax', methods: ['minmax', 'distance', 'logistic'],
    desc: '값의 간격을 선형·단조로 보존한다. 대표 = Min-Max.' },
  순위전용형: { color: '#F5760D', rep: 'pctrank', methods: ['pctrank'],
    desc: '등수만 반영하고 간격 정보를 버린다. 대표 = 백분위순위.' },
}
export const campOf = (mk) => methodOf(mk)?.camp

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
export function metricsFor(sector, method) {
  const m = methodOf(method)
  const other = method === 'pctrank' ? 'minmax' : 'pctrank'
  const om = methodOf(other)
  const list = [
    { key: 'ci', group: '표준화 결과', scale: 'blue', dynamic: true,
      label: `CI 점수 · ${m.label}`,
      desc: `${m.label} 방식으로 표준화해 합산한 부문지수. 범위 ${m.range}.`,
      fmt: (v) => (v == null ? '—' : v.toFixed(1)), get: (r) => r[sector].ci[method] },
    { key: 'rank', group: '표준화 결과', scale: 'rank', dynamic: true,
      label: `전국 순위 · ${m.label}`,
      desc: `${m.label} CI 기준 229개 시군구 중 순위(1 = 최상위).`,
      fmt: (v) => (v == null ? '—' : `${v}위`), get: (r) => r[sector].rank[method] },
    { key: 'shift', group: '표준화 결과', scale: 'div', dynamic: true,
      label: `순위 변화 · ${m.label} → ${om.label}`,
      desc: `${m.label} 순위에서 ${om.label} 순위로 갈 때의 변동. 파랑(음수) = ${om.label}에서 순위 상승.`,
      fmt: (v) => (v == null ? '—' : v > 0 ? `▲${v}계단 하락` : v < 0 ? `▼${-v}계단 상승` : '변동 없음'),
      get: (r) => r[sector].rank[other] - r[sector].rank[method] },
    { key: 'ssiCamp', group: '민감도', scale: 'heat',
      label: '순위 이동 폭 (Min-Max ↔ 백분위순위)',
      desc: '|Min-Max 순위 − 백분위순위 순위|. 지침서 9장에서 확정한 최종 민감도 지표(SSI_camp).',
      fmt: (v) => (v == null ? '—' : `${v}계단`), get: (r) => r[sector].ssiCamp },
    { key: 'ssiRange', group: '민감도', scale: 'heat',
      label: '순위 최대-최소 차 (4개 방법)',
      desc: '4개 방법 순위의 최댓값 − 최솟값. 참고용 4-way 민감도(SSI_range).',
      fmt: (v) => (v == null ? '—' : `${v}계단`), get: (r) => r[sector].ssiRange },
    { key: 'ssiStd', group: '민감도', scale: 'heat',
      label: '순위 표준편차 (4개 방법)',
      desc: '4개 방법 순위의 표준편차. 참고용(SSI_std).',
      fmt: (v) => (v == null ? '—' : v.toFixed(2)), get: (r) => r[sector].ssiStd },
  ]
  SECTORS[sector].inds.forEach((ind) => {
    list.push({
      key: `raw:${ind.label}`, group: '원자료 지표', scale: ind.dir === '+' ? 'green' : 'heat',
      label: `${ind.label} (원자료)`,
      desc: `${ind.desc} 방향 ${ind.dir === '+' ? '+1 (높을수록 좋음)' : '−1 (낮을수록 좋음)'}.`,
      fmt: (v) => (v == null ? '—' : `${v}${ind.unit}`), get: (r) => r[sector].raw[ind.label],
    })
    list.push({
      key: `std:${ind.label}`, group: '지표별 표준화값', scale: 'blue', dynamic: true,
      label: `${ind.label} · ${m.label} 표준화`,
      desc: `원자료를 ${m.label}으로 표준화한 값(방향 반영). 지표 1개 단위에서는 어떤 방법을 써도 순위가 동일하다.`,
      fmt: (v) => (v == null ? '—' : v.toFixed(1)),
      get: (r, i) => stdSeries(sector, ind.label, method)[i],
    })
  })
  if (sector === 'S1') {
    list.push({
      key: 'tradeoff', group: '파생 플래그', scale: 'heat',
      label: '트레이드오프 지역',
      desc: '두 지표의 백분위 순위 차이가 30%p를 초과 — 한쪽은 앞서고 한쪽은 뒤처지는 지역.',
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
  for (const s of ['S1', 'S8']) {
    METHODS.forEach((m) => out.push(`${s}_CI_${m.col}`))
    METHODS.forEach((m) => out.push(`${s}_순위_${m.col}`))
    out.push(`${s}_SSI_range`, `${s}_SSI_std`, `${s}_SSI_camp`, `${s}_민감구분`,
      `${s}_MinMax대표순위`, `${s}_PctRank대표순위`)
    SECTORS[s].inds.forEach((i) => out.push(`${s}_원자료_${i.label}`))
  }
  out.push('S1_트레이드오프_참고')
  return out
})()

export const COLMETA = Object.fromEntries(COLUMNS.map((c) => [c.name, c]))

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
