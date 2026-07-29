// 통계창 내려받기 — 화면에 그린 것과 같은 값을 표로 떨어뜨린다.
//
// 원칙 하나: 그림에 쓴 배열을 그대로 다시 쓴다. 차트는 반올림해 그리고 파일은
// 원래 값을 담는 식으로 어긋나면, 발표 자리에서 숫자가 안 맞는다는 말이 나온다.
// 그래서 여기 있는 함수들은 모두 ssi.js의 같은 계산 결과를 읽어 온다.

import {
  ROWS, N, METHODS, SECTORS, methodOf, indsOf, stdSeries, indT, indRank, ciT,
  pctOf, reportCSV, axisFor, rowKey, rowIndex,
} from './ssi.js'

const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000)

// 엑셀이 UTF-8을 알아보게 BOM을 붙인다. 안 붙이면 한글이 깨진 채로 열린다.
export const csv = (cols, rows) =>
  '﻿' + [cols.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')

export function download(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  // 문서에 붙이지 않고 click()하면 브라우저에 따라 download 속성이 무시되고
  // 파일 이름이 'download'로 떨어진다. 붙였다 떼는 편이 확실하다.
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 파일 이름은 '무엇을 · 어느 부문 · 어느 방법'이 드러나게 짓는다.
// 공백은 밑줄로 바꾼다. 파일을 스크립트로 다시 읽을 때 따옴표를 안 붙여도 되게.
const safe = (s) => String(s).replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '')
export const fileName = (what, sector, method) =>
  safe(`${SECTORS[sector].name}_${what}${method ? `_${methodOf(method).label}` : ''}`) + '.csv'

const who = (row) => (row ? `${row.sido} ${row.name}` : '—')

// ── A단 ──────────────────────────────────────────────────────────────
// 진단표: 229행 전체 (ssi.js의 reportTable과 같은 표)
export const dlReport = (sector, method) => ({
  name: fileName('진단표', sector, method), text: reportCSV(sector, method),
})

// 방법별 점수·순위 — 선택 지역 한 곳
export function dlMethods(sector, method, row) {
  const d = row?.[sector]
  const i = rowIndex(rowKey(row))
  const cols = ['시도', '시군구', '표준화방법', '계열', '부문점수_CI', '전국순위', '백분위', '표준점수_T', '지금선택']
  const rows = d ? METHODS.map((m) => [
    row.sido, row.name, m.label, m.camp, r1(d.ci[m.key]), d.rank[m.key],
    r1(pctOf(d.rank[m.key])), r1(ciT(sector, m.key)[i]), m.key === method ? 'Y' : '',
  ]) : []
  return { name: fileName(`방법별점수_${who(row)}`, sector), text: csv(cols, rows) }
}

// 선택 지표 원값 — 선택 지역 한 곳
export function dlRaw(sector, method, row) {
  const d = row?.[sector]
  const i = rowIndex(rowKey(row))
  const cols = ['시도', '시군구', '지표', '연도', '단위', '방향', '원값', '표준화값', '표준점수_T', '지표순위', '정의', '출처']
  const rows = d ? indsOf(sector).map((e) => [
    row.sido, row.name, e.name, e.year, e.unit || '',
    e.dir === '+' ? '높을수록 좋음' : '낮을수록 좋음',
    d.raw[e.label], r1(stdSeries(sector, e.label, method)[i]),
    r1(indT(sector, e.label, method)[i]), indRank(sector, e.label, method)[i],
    e.desc || '', e.source || '',
  ]) : []
  return { name: fileName(`지표원값_${who(row)}`, sector, method), text: csv(cols, rows) }
}

// ── B단 ──────────────────────────────────────────────────────────────
// 계산 과정 — 원값 → 표준화 → 부문점수, 선택 지역 한 곳
export function dlTransform(sector, method, row) {
  const d = row?.[sector]
  const i = rowIndex(rowKey(row))
  const m = methodOf(method)
  const inds = indsOf(sector)
  const cols = ['구분', '지표', '연도', '원값', '표준화값', '수식', '전국최소', '전국최대']
  const rows = []
  if (d) {
    inds.forEach((e) => {
      const s = stdSeries(sector, e.label, method)
      const vs = s.filter((v) => v != null)
      rows.push(['지표', e.name, e.year, d.raw[e.label], r1(s[i]), m.formula,
        vs.length ? r1(Math.min(...vs)) : null, vs.length ? r1(Math.max(...vs)) : null])
    })
    rows.push(['부문점수', `CI = 표준화값 ${inds.length}개 단순평균`, '', '', r1(d.ci[method]), '동일가중', '', ''])
    rows.push(['전국순위', `${N}개 시군구 중`, '', '', d.rank[method], '', '', ''])
  }
  return { name: fileName(`계산과정_${who(row)}`, sector, method), text: csv(cols, rows) }
}

// 방법별 부문점수 분포 — 229행 × 4방법
export function dlDist(sector) {
  const cols = ['시도', '시군구', ...METHODS.map((m) => `${m.label}_CI`)]
  const rows = ROWS.map((r) => [r.sido, r.name,
    ...METHODS.map((m) => r1(r[sector]?.ci[m.key]))])
  return { name: fileName('방법별_부문점수분포', sector), text: csv(cols, rows) }
}

// 방법 간 순위 이동 — 229행 × 4방법 순위
export function dlRankFlow(sector) {
  const cols = ['시도', '시군구', ...METHODS.map((m) => `${m.label}_순위`), '순위이동']
  const rows = ROWS.map((r) => {
    const d = r[sector]
    return [r.sido, r.name, ...METHODS.map((m) => d?.rank[m.key] ?? null), d?.ssiCamp ?? null]
  })
  return { name: fileName('방법간_순위이동', sector), text: csv(cols, rows) }
}

// ── C단 ──────────────────────────────────────────────────────────────
// 지표 간 산점도 — 지금 축 두 개
export function dlScatter(sector, method, xKey, yKey) {
  const ax = axisFor(sector, method, xKey)
  const ay = axisFor(sector, method, yKey)
  const cols = ['시도', '시군구', `가로축_${ax.label}`, `세로축_${ay.label}`]
  const rows = ROWS.map((r, i) => [r.sido, r.name, r3(ax.get(r, i)), r3(ay.get(r, i))])
  return { name: fileName('산점도', sector, method), text: csv(cols, rows) }
}

// 민감도 산점도 — 두 진영 대표 순위
export function dlSensScatter(sector) {
  const cols = ['시도', '시군구', 'MinMax순위', '백분위순위_순위', '순위이동', '민감구분']
  const rows = ROWS.map((r) => {
    const d = r[sector]
    return [r.sido, r.name, d?.repMinmax ?? null, d?.repPctrank ?? null,
      d?.ssiCamp ?? null, d?.flag ?? '']
  })
  return { name: fileName('표준화민감도', sector), text: csv(cols, rows) }
}

// 순위 이동이 큰 시군구 — 화면은 상위 15곳만 보여주지만 파일은 전체를 담는다
export function dlSensList(sector) {
  const cols = ['순서', '시도', '시군구', '순위이동', 'MinMax순위', '백분위순위_순위', '민감구분']
  const rows = [...ROWS]
    .filter((r) => r[sector]?.ssiCamp != null)
    .sort((a, b) => b[sector].ssiCamp - a[sector].ssiCamp)
    .map((r, i) => {
      const d = r[sector]
      return [i + 1, r.sido, r.name, d.ssiCamp, d.rank.minmax, d.rank.pctrank, d.flag]
    })
  return { name: fileName('순위이동_전체', sector), text: csv(cols, rows) }
}

// ── 통계창 전체 ───────────────────────────────────────────────────────
// 표 하나에 부문 결과를 모두 눕힌다. 지표별 값 + 방법별 CI·순위 + 민감도.
export function dlAll(sector, method) {
  const inds = indsOf(sector)
  const std = inds.map((e) => stdSeries(sector, e.label, method))
  const cols = ['시도', '시군구']
  inds.forEach((e) => cols.push(`${e.name}_${e.year}_원값`, `${e.name}_${e.year}_표준화`))
  METHODS.forEach((m) => cols.push(`${m.label}_CI`, `${m.label}_순위`))
  cols.push('표준점수_T', '백분위', '순위이동', '민감구분')
  const ct = ciT(sector, method)
  const rows = ROWS.map((r, i) => {
    const d = r[sector]
    const o = [r.sido, r.name]
    inds.forEach((e, j) => { o.push(d ? d.raw[e.label] : null, r1(std[j][i])) })
    METHODS.forEach((m) => o.push(r1(d?.ci[m.key]), d?.rank[m.key] ?? null))
    o.push(r1(ct[i]), r1(pctOf(d?.rank[method])), d?.ssiCamp ?? null, d?.flag ?? '')
    return o
  })
  return { name: fileName('통계전체', sector, method), text: csv(cols, rows) }
}

export const rowsKeyed = () => ROWS.map(rowKey)
