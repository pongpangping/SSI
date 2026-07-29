// 통계창 내려받기 — 화면에 그린 것과 같은 값을 파일로 떨어뜨린다.
//
// 원칙 하나: 그림에 쓴 배열을 그대로 다시 쓴다. 차트는 반올림해 그리고 파일은
// 원래 값을 담는 식으로 어긋나면, 발표 자리에서 숫자가 안 맞는다는 말이 나온다.
// 그래서 여기 있는 함수들은 모두 ssi.js의 같은 계산 결과를 읽어 온다.
//
// 원칙 둘: 각 dl* 함수는 '무엇을 담을지'만 정하고 파일 형식은 정하지 않는다.
// 돌려주는 것은 { base, cols, rows } 꼴의 값 묶음이고, 이것을 CSV·엑셀·그림 중
// 어느 것으로 만들지는 받는 쪽에서 고른다. 형식이 하나 늘 때마다 표 만드는
// 코드를 열 번 고쳐 쓰지 않기 위해서다.

import {
  ROWS, N, METHODS, SECTORS, methodOf, indsOf, stdSeries, indT, indRank, ciT,
  pctOf, reportTable, axisFor, rowKey, rowIndex,
} from './ssi.js'
import { xlsx, XLSX_MIME } from './xlsx.js'
import { download as saveBytes } from './shpout.js'
import { tablePng, chartPng, savePng, chartSvgOf } from './pngout.js'

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
  safe(`${SECTORS[sector].name}_${what}${method ? `_${methodOf(method).label}` : ''}`)

const who = (row) => (row ? `${row.sido} ${row.name}` : '—')

// 그림으로 받을 때 아래에 붙는 꼬리말. 무엇을 기준으로 뽑은 표인지 남긴다.
const foot = (sector, method, extra) => {
  const l = [`${SECTORS[sector].name}${method ? ` · 표준화 ${methodOf(method).label}` : ''} · 전국 ${N}개 시군구 기준`]
  if (extra) l.push(extra)
  return l
}

// ── A단 ──────────────────────────────────────────────────────────────
// 진단표: 229행 전체 (ssi.js의 reportTable과 같은 표)
export function dlReport(sector, method) {
  const { cols, rows } = reportTable(sector, method)
  return {
    base: fileName('진단표', sector, method),
    title: `${SECTORS[sector].name} 지역 진단표`,
    sub: '지표 원값 · 표준화값 · 표준점수(T) · 순위',
    cols,
    rows: rows.map((r) => cols.map((c) => r[c])),
    note: foot(sector, method),
  }
}

// 방법별 점수·순위 — 선택 지역 한 곳
export function dlMethods(sector, method, row) {
  const d = row?.[sector]
  const i = rowIndex(rowKey(row))
  const cols = ['시도', '시군구', '표준화방법', '계열', '부문점수_CI', '전국순위', '백분위', '표준점수_T', '지금선택']
  const rows = d ? METHODS.map((m) => [
    row.sido, row.name, m.label, m.camp, r1(d.ci[m.key]), d.rank[m.key],
    r1(pctOf(d.rank[m.key])), r1(ciT(sector, m.key)[i]), m.key === method ? 'Y' : '',
  ]) : []
  return {
    base: fileName(`방법별점수_${who(row)}`, sector),
    title: '표준화 방법별 점수와 순위',
    sub: who(row),
    cols,
    rows,
    note: foot(sector, null, '같은 지표·같은 연도를 네 가지 방법으로 표준화한 결과입니다.'),
  }
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
  return {
    base: fileName(`지표원값_${who(row)}`, sector, method),
    title: '선택 지표 원값',
    sub: who(row),
    cols,
    // 그림으로 그릴 때 정의·출처까지 넣으면 가로로 너무 길어진다. 앞 열만 그린다.
    pngCols: 10,
    rows,
    note: foot(sector, method),
  }
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
  return {
    base: fileName(`계산과정_${who(row)}`, sector, method),
    title: '계산 과정',
    sub: `${who(row)} · 원값 → 표준화 → 부문점수 → 순위`,
    cols,
    rows,
    note: foot(sector, method),
  }
}

// 방법별 부문점수 분포 — 229행 × 4방법
export function dlDist(sector) {
  const cols = ['시도', '시군구', ...METHODS.map((m) => `${m.label}_CI`)]
  const rows = ROWS.map((r) => [r.sido, r.name,
    ...METHODS.map((m) => r1(r[sector]?.ci[m.key]))])
  return {
    base: fileName('방법별_부문점수분포', sector),
    title: '방법별 부문점수 분포',
    sub: `${N}개 시군구 × 4개 표준화 방법`,
    cols,
    rows,
    note: foot(sector, null),
  }
}

// 방법 간 순위 이동 — 229행 × 4방법 순위
export function dlRankFlow(sector) {
  const cols = ['시도', '시군구', ...METHODS.map((m) => `${m.label}_순위`), '순위이동']
  const rows = ROWS.map((r) => {
    const d = r[sector]
    return [r.sido, r.name, ...METHODS.map((m) => d?.rank[m.key] ?? null), d?.ssiCamp ?? null]
  })
  return {
    base: fileName('방법간_순위이동', sector),
    title: '방법 간 순위 이동',
    sub: `${N}개 시군구 × 4개 표준화 방법 순위`,
    cols,
    rows,
    note: foot(sector, null, '순위이동 = 간격보존형 대표(Min-Max)와 순위전용형 대표(백분위순위) 순위 차이의 절댓값'),
  }
}

// ── C단 ──────────────────────────────────────────────────────────────
// 지표 간 산점도 — 지금 축 두 개
export function dlScatter(sector, method, xKey, yKey) {
  const ax = axisFor(sector, method, xKey)
  const ay = axisFor(sector, method, yKey)
  const cols = ['시도', '시군구', `가로축_${ax.label}`, `세로축_${ay.label}`]
  const rows = ROWS.map((r, i) => [r.sido, r.name, r3(ax.get(r, i)), r3(ay.get(r, i))])
  return {
    base: fileName('산점도', sector, method),
    title: '지표 간 산점도',
    sub: `가로 ${ax.label} × 세로 ${ay.label}`,
    cols,
    rows,
    note: foot(sector, method),
  }
}

// 민감도 산점도 — 두 진영 대표 순위
export function dlSensScatter(sector) {
  const cols = ['시도', '시군구', 'MinMax순위', '백분위순위_순위', '순위이동', '민감구분']
  const rows = ROWS.map((r) => {
    const d = r[sector]
    return [r.sido, r.name, d?.repMinmax ?? null, d?.repPctrank ?? null,
      d?.ssiCamp ?? null, d?.flag ?? '']
  })
  return {
    base: fileName('표준화민감도', sector),
    title: '표준화 민감도 산점도',
    sub: 'Min-Max 순위 × 백분위순위 순위',
    cols,
    rows,
    note: foot(sector, null, '민감구분 high = 순위 이동 10계단 이상, mid = 5계단 이상'),
  }
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
  return {
    base: fileName('순위이동_전체', sector),
    title: '순위 이동이 큰 시군구',
    sub: '순위 이동 내림차순',
    cols,
    rows,
    note: foot(sector, null),
  }
}

// ── 통계창 전체 ───────────────────────────────────────────────────────
// 표 하나에 부문 결과를 모두 눕힌다. 지표별 값 + 방법별 CI·순위 + 민감도.
// 엑셀로 받을 때는 여기에 딸림 장을 더 붙인다. 값만 있는 표는 몇 달 뒤에
// 열어 보면 어느 지표를 무슨 방향으로 넣었는지 알 수 없다.
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

  // 딸림 장 — 지표 정의와 방법 설명. 표만 떼어 돌려도 읽히게.
  const indCols = ['지표', '연도', '단위', '방향', '정의', '산식', '출처', '비고']
  const indRows = inds.map((e) => [
    e.name, e.year, e.unit || '', e.dir === '+' ? '높을수록 좋음' : '낮을수록 좋음',
    e.desc || '', e.formula || '', e.source || '', e.note || '',
  ])
  const mCols = ['표준화방법', '계열', '수식', '범위', '설명', '지금선택']
  const mRows = METHODS.map((m) => [m.label, m.camp, m.formula, m.range || '', m.note || '', m.key === method ? 'Y' : ''])

  const flow = dlRankFlow(sector)

  return {
    base: fileName('통계전체', sector, method),
    title: `${SECTORS[sector].name} 통계 전체`,
    sub: `${N}개 시군구 · 표준화 ${methodOf(method).label}`,
    cols,
    rows,
    note: foot(sector, method),
    sheets: [
      { name: '통계 전체', cols, rows },
      { name: '순위 이동', cols: flow.cols, rows: flow.rows },
      { name: '지표 설명', cols: indCols, rows: indRows },
      { name: '표준화 방법', cols: mCols, rows: mRows },
    ],
  }
}

export const rowsKeyed = () => ROWS.map(rowKey)

/* ── 형식 고르기 ───────────────────────────────────────────────────── */
// dl* 가 돌려준 값 묶음 하나를 골라 잡은 형식으로 저장한다.
// PNG는 캔버스에 그리느라 비동기라서 전체를 async로 둔다.

export const FORMATS = [
  { key: 'csv', label: 'CSV', ext: '.csv', hint: '쉼표로 나눈 표. 어디서나 열림' },
  { key: 'xlsx', label: 'Excel', ext: '.xlsx', hint: '서식·열 너비까지 들어간 엑셀 표' },
  { key: 'png', label: 'PNG', ext: '.png', hint: '문서·슬라이드에 바로 붙이는 그림' },
]

export async function saveAs(fmt, pack, opts = {}) {
  if (!pack) return false
  const { base } = pack

  if (fmt === 'csv') {
    download(`${base}.csv`, csv(pack.cols, pack.rows))
    return true
  }

  if (fmt === 'xlsx') {
    const sheets = pack.sheets || [{ name: pack.title || '데이터', cols: pack.cols, rows: pack.rows }]
    saveBytes(`${base}.xlsx`, xlsx(sheets), XLSX_MIME)
    return true
  }

  if (fmt === 'png') {
    // 차트 카드는 화면에 그려진 그림을 그대로 뜬다. 표 카드는 값에서 다시 그린다.
    const el = opts.el
    const blob = chartSvgOf(el)
      ? await chartPng({ el, title: pack.title, sub: pack.sub, note: pack.note })
      : await tablePng({
        title: pack.title,
        sub: pack.sub,
        cols: pack.pngCols ? pack.cols.slice(0, pack.pngCols) : pack.cols,
        rows: pack.pngCols ? pack.rows.map((r) => r.slice(0, pack.pngCols)) : pack.rows,
        note: pack.note,
      })
    return savePng(blob, base)
  }

  return false
}
