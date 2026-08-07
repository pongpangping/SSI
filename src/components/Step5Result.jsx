import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts'
import NationalMap from './NationalMap.jsx'
import { HistBars } from './EdaHist.jsx'
import MiniScatter from './MiniScatter.jsx'
import { ROWS, N, METHODS, methodOf, pctFromRank, describe } from '../lib/pipeline.js'
import { rowKey, rowIndex, shortSido, fmtRaw } from '../lib/ssi.js'
import { PALETTES, paletteOf, rampOf, divRamp } from '../lib/palettes.js'
import DlMenu from './DlMenu.jsx'

// 5단계 — 종합점수.
//
// 왼쪽에 지역별 점수·순위 표, 가운데에 지도, 오른쪽에 고른 지역의 지표 구성
// (방사 차트 + 기여도)이 놓인다. 표준화 방법을 바꿔 가며 결과가 어떻게 달라지는지
// 보고, 지도 두 장을 나란히 놓아 방법끼리 직접 견줄 수도 있다.
//
// 보기 값은 셋 — 점수(연속) · 10등급 · 순위. 10등급은 십분위(고르게 10칸)와
// 등간격(값 범위 10등분)을 오갈 수 있고, 팔레트도 사용자가 고른다.

const num = (x) => x != null && Number.isFinite(x)
const f1 = (v) => (v == null ? '—' : v.toFixed(1))

// 방사 차트 축 이름 — 길면 접는다
const shortLab = (s) => (s.length > 7 ? s.slice(0, 6) + '…' : s)

function median(arr) {
  const ok = arr.filter(num).sort((a, b) => a - b)
  if (!ok.length) return null
  return ok.length % 2 ? ok[(ok.length - 1) / 2] : (ok[ok.length / 2 - 1] + ok[ok.length / 2]) / 2
}

export default function Step5Result({
  sector, entries, result, method, onMethod, gradeMode, onGradeMode,
  palette, onPalette, selected, onSelect, onReport,
}) {
  const [mval, setMval] = useState('ci')          // 지도 값 — 4묶음 22값 (v2 지도 색 기준 복원)
  const [mvalB, setMvalB] = useState('ci')        // 비교 모드 B 지도의 값
  const [onlyHigh, setOnlyHigh] = useState(false) // 민감 지역만 보기
  const [compare, setCompare] = useState(false)
  const [methodB, setMethodB] = useState('pctrank')
  const [paletteB, setPaletteB] = useState('purple')  // 비교 모드의 오른쪽 지도 색
  const [leftOpen, setLeftOpen] = useState(true)      // 순위 패널 접기
  const [rightOpen, setRightOpen] = useState(true)    // 구성 패널 접기
  const [q, setQ] = useState('')
  const [hovered, setHovered] = useState(null)
  const listRef = useRef(null)

  const mk = method
  const m = methodOf(mk)

  // ── 지도 값 카탈로그 — v2 지도 색 기준 네 묶음 복원 ─────────────────────
  //   ① 부문 종합 6  ② 원데이터 지표별 4  ③ 표준화 민감도 3  ④ 참고 플래그 2
  const OTHER = (mm) => (mm === 'pctrank' ? 'minmax' : 'pctrank')
  const metricFor = (mv, mm) => {
    const lab = methodOf(mm).label
    const ind = mv.match(/^ind:(\d+):(raw|std|it|ir)$/)
    if (ind) {
      const j = +ind[1], st = result.stages[j]
      if (!st) return metricFor('ci', mm)
      const e = st.pick
      if (ind[2] === 'raw') return {
        key: mv, scale: 'blue', label: `${e.label} · 원값`, full: `${e.label} · 원값${e.unit ? ` (${e.unit})` : ''}`,
        fmt: (v) => (v == null ? '—' : `${fmtRaw(v)}${e.unit || ''}`), get: (r, i) => st.raw[i] ?? null,
      }
      if (ind[2] === 'std') return {
        key: mv, scale: 'blue', label: `${e.label} · 표준화 · ${lab}`, full: `${e.label} · 표준화값 (${lab})`,
        fmt: f1, get: (r, i) => st.std[mm]?.[i] ?? null,
      }
      if (ind[2] === 'it') return {
        key: mv, scale: 'blue', label: `${e.label} · T점수 · ${lab}`, full: `${e.label} · 표준점수 T (${lab})`,
        fmt: f1, get: (r, i) => result.indT[mm]?.[j]?.[i] ?? null,
      }
      return {
        key: mv, scale: 'rank', label: `${e.label} · 지표 순위`, full: `${e.label} · 지표 전국 순위`,
        fmt: (v) => (v == null ? '—' : `${Math.round(v)}위`), get: (r, i) => result.indRank[mm]?.[j]?.[i] ?? null,
      }
    }
    switch (mv) {
      case 'grade': return {
        key: 'grade', scale: 'rank', discrete: 10,
        label: `10등급 · ${lab}`, full: `부문지수 10등급 (${gradeMode === 'decile' ? '십분위' : '등간격'}) · ${lab}`,
        fmt: (v) => (v == null ? '—' : `${v}등급`), ends: ['10등급', '1등급'],
        get: (r, i) => result.grade[mm]?.[i] ?? null,
      }
      case 'rank': return {
        key: 'rank', scale: 'rank',
        label: `전국 순위 · ${lab}`, full: `부문지수 전국 순위 · ${lab}`,
        fmt: (v) => (v == null ? '—' : `${Math.round(v)}위`),
        get: (r, i) => result.rank[mm]?.[i] ?? null,
      }
      case 'ciT': return {
        key: 'ciT', scale: 'blue', label: `T점수 · ${lab}`, full: `부문지수 표준점수 T (전국 평균 50) · ${lab}`,
        fmt: f1, get: (r, i) => result.ciT[mm]?.[i] ?? null,
      }
      case 'pct': return {
        key: 'pct', scale: 'blue', label: `백분위 · ${lab}`, full: `부문지수 백분위 (100 = 최상위) · ${lab}`,
        fmt: (v) => (v == null ? '—' : `${v.toFixed(1)}%`),
        get: (r, i) => pctFromRank(result.rank[mm]?.[i]),
      }
      case 'shift': {
        const ot = OTHER(mm)
        return {
          key: 'shift', scale: 'div',
          label: `순위 변화 · ${lab} → ${methodOf(ot).label}`,
          full: `순위 변화 · ${lab} → ${methodOf(ot).label}`,
          ends: ['◀ 순위 상승', '순위 하락 ▶'],
          fmt: (v) => (v == null ? '—' : v > 0 ? `▲${Math.round(v)}계단 하락` : v < 0 ? `▼${-Math.round(v)}계단 상승` : '변동 없음'),
          get: (r, i) => {
            const a = result.rank[mm]?.[i], b = result.rank[ot]?.[i]
            return num(a) && num(b) ? b - a : null
          },
        }
      }
      case 'camp': return {
        key: 'camp', scale: 'blue', label: '순위 이동 폭', full: '순위 이동 폭 (Min-Max ↔ 백분위순위)',
        fmt: (v) => (v == null ? '—' : `${Math.round(v)}계단`), get: (r, i) => result.camp[i] ?? null,
      }
      case 'range': return {
        key: 'range', scale: 'blue', label: '순위 최대-최소 차', full: `순위 최대-최소 차 (${METHODS.length}개 방법)`,
        fmt: (v) => (v == null ? '—' : `${Math.round(v)}계단`), get: (r, i) => result.range[i] ?? null,
      }
      case 'rstd': return {
        key: 'rstd', scale: 'blue', label: '순위 표준편차', full: `순위 표준편차 (${METHODS.length}개 방법)`,
        fmt: (v) => (v == null ? '—' : v.toFixed(2)), get: (r, i) => result.rstd[i] ?? null,
      }
      case 'spread': return {
        key: 'spread', scale: 'blue', label: '지표 간 순위 격차', full: '지표 간 순위 격차 (백분위 순위 최대−최소, %p)',
        fmt: (v) => (v == null ? '—' : `${v.toFixed(1)}%p`), get: (r, i) => result.spread[i] ?? null,
      }
      case 'tradeoff': return {
        key: 'tradeoff', scale: 'blue',
        label: '트레이드오프 지역', full: `트레이드오프 지역 (격차 상위 10%${result.tradeoffCut != null ? ` · ${result.tradeoffCut.toFixed(1)}%p 이상` : ''})`,
        fmt: (v) => (v ? '해당' : '해당 없음'), get: (r, i) => result.tradeoff[i] ?? 0,
      }
      default: return {
        key: 'ci', scale: 'blue',
        label: `부문지수 · ${lab}`, full: `가중 합성 부문지수 · ${lab}`,
        fmt: f1, get: (r, i) => result.ci[mm]?.[i] ?? null,
      }
    }
  }
  const mvalOf = (which) => (which === 'B' ? mvalB : mval)
  const metricOf = (mm, which = 'A') => metricFor(mvalOf(which), mm)
  const k10 = (which = 'A') => (mvalOf(which) === 'grade' ? 10 : 7)
  const rampFor = (which) => {
    if (mvalOf(which) === 'shift') return divRamp(7)
    return rampOf(which === 'B' ? paletteB : palette, k10(which))
  }
  const metric = useMemo(() => metricFor(mval, mk), [mval, mk, result, gradeMode])

  // 지도 값 고르기 목록 — 네 묶음
  const MVAL_GROUPS = useMemo(() => {
    const g = [
      ['부문 종합', [
        ['ci', '부문지수 (점수)'], ['grade', '10등급'], ['rank', '전국 순위'],
        ['ciT', 'T점수'], ['pct', '백분위'], ['shift', '순위 변화 (방법 전환)'],
      ]],
      ['원데이터', result.stages.flatMap((st, j) => [
        [`ind:${j}:raw`, `${st.pick.label} · 원값`],
        [`ind:${j}:std`, `${st.pick.label} · 표준화값`],
        [`ind:${j}:it`, `${st.pick.label} · T점수`],
        [`ind:${j}:ir`, `${st.pick.label} · 지표 순위`],
      ])],
      ['표준화 민감도', [
        ['camp', '순위 이동 폭 (MM ↔ 백분위)'], ['range', '순위 최대-최소 차'], ['rstd', '순위 표준편차'],
      ]],
    ]
    if (result.stages.length >= 2) g.push(['참고 플래그', [
      ['spread', '지표 간 순위 격차'], ['tradeoff', '트레이드오프 지역'],
    ]])
    return g
  }, [result])
  const info = (r, i) => [
    ['전국 순위', result.rank[mk]?.[i] != null ? `${Math.round(result.rank[mk][i])}위 / ${N}` : '—'],
    ['10등급', result.grade[mk]?.[i] != null ? `${result.grade[mk][i]}등급` : '—'],
  ]
  const exportExtra = (r, i) => ({
    CI: result.ci[mk]?.[i] ?? null,
    RANK: result.rank[mk]?.[i] ?? null,
    TSCORE: result.ciT[mk]?.[i] ?? null,
    PCTILE: pctFromRank(result.rank[mk]?.[i]),
    SSI_CAMP: result.camp[i] ?? null,
    SENSITIVE: result.flag[i] === 'high' ? 'Y' : 'N',
  })

  // ── 왼쪽 순위표 ─────────────────────────────────────────────────────────
  const table = useMemo(() => {
    const rows = ROWS.map((r, i) => ({
      key: rowKey(r), sido: r.sido, name: r.name,
      ci: result.ci[mk]?.[i], rank: result.rank[mk]?.[i],
      grade: result.grade[mk]?.[i], t: result.ciT[mk]?.[i],
    })).filter((r) => num(r.rank))
    rows.sort((a, b) => a.rank - b.rank)
    const t = q.trim()
    return t ? rows.filter((r) => r.name.includes(t) || r.sido.includes(t)) : rows
  }, [result, mk, q])

  useEffect(() => {
    if (!selected || !listRef.current) return
    const el = listRef.current.querySelector('[data-on="1"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selected, mk])

  const gradeColor = (g) => (g == null ? 'transparent' : rampOf(palette, 10)[10 - g])
  const gradeInk = (g) => {
    if (g == null) return 'inherit'
    const h = gradeColor(g)
    const L = 0.299 * parseInt(h.slice(1, 3), 16) + 0.587 * parseInt(h.slice(3, 5), 16) + 0.114 * parseInt(h.slice(5, 7), 16)
    return L < 150 ? '#FFFFFF' : '#12314A'
  }

  // ── 오른쪽 — 고른 지역의 지표 구성 ──────────────────────────────────────
  const selIdx = selected ? rowIndex(selected) : null
  const selRow = selIdx != null ? ROWS[selIdx] : null
  const radar = useMemo(() => {
    if (selIdx == null) return null
    return result.stages.map((s) => ({
      axis: shortLab(s.pick.label), fullAxis: s.pick.label,
      region: num(s.std[mk][selIdx]) ? Math.round(s.std[mk][selIdx] * 10) / 10 : 0,
      nation: (() => { const md = median(s.std[mk]); return md == null ? 0 : Math.round(md * 10) / 10 })(),
    }))
  }, [result, mk, selIdx])
  const wSum = result.weights.reduce((a, b) => a + b, 0) || 1

  // 통계 패널 — 분포 요약 · 시도별 평균 · 산점도 축 후보 (v2 통계창 내용 복원)
  const dist = useMemo(() => describe(result.ci[mk] || []), [result, mk])
  const sidoAvg = useMemo(() => {
    const bag = {}
    ROWS.forEach((r, i) => {
      const v = result.ci[mk]?.[i]
      if (num(v)) (bag[r.sido] ||= []).push(v)
    })
    const out = Object.entries(bag).map(([sd, arr]) => ({
      sd, n: arr.length, m: arr.reduce((a, b) => a + b, 0) / arr.length,
    }))
    out.sort((a, b) => b.m - a.m)
    return out
  }, [result, mk])
  const scatterOpts = useMemo(() => {
    const o = [
      { key: 'ci', label: `부문지수 · ${m.label}`, vals: result.ci[mk] || [] },
      { key: 'ciT', label: 'T점수', vals: result.ciT[mk] || [] },
    ]
    result.stages.forEach((st) => {
      o.push({ key: `std:${st.pick.col}`, label: `${st.pick.label} · 표준화`, vals: st.std[mk] })
      o.push({ key: `raw:${st.pick.col}`, label: `${st.pick.label} · 원값`, vals: st.raw })
    })
    return o
  }, [result, mk, m.label])

  // 카드별 내려받기 팩 — 화면에 그린 값 그대로 CSV·Excel·PNG (v2 방식 복원)
  const r1v = (x) => (x == null ? null : Math.round(x * 10) / 10)
  const rankPack = () => ({
    base: `SSI_순위표_${m.label}`, title: `지역별 점수 순위 · ${m.label}`,
    sub: `전국 ${N}개 시군구 · 가중 합성 부문지수`, pngCols: 7,
    cols: ['순위', '시도', '시군구', '부문지수', 'T점수', '백분위', '10등급',
      ...result.stages.map((st) => `${st.pick.label}_표준화`)],
    rows: [...ROWS.keys()]
      .filter((i) => num(result.rank[mk]?.[i]))
      .sort((a, b) => result.rank[mk][a] - result.rank[mk][b])
      .map((i) => [Math.round(result.rank[mk][i]), ROWS[i].sido, ROWS[i].name,
        r1v(result.ci[mk]?.[i]), r1v(result.ciT[mk]?.[i]), r1v(pctFromRank(result.rank[mk]?.[i])),
        result.grade[mk]?.[i] ?? null,
        ...result.stages.map((st) => r1v(st.std[mk][i]))]),
  })
  const summaryPack = () => ({
    base: `SSI_전국요약_${m.label}`, title: `전국 요약 · ${m.label}`,
    sub: `부문지수 분포와 상·하위 10 · 전국 ${N}개 시군구`,
    cols: ['구분', '값·지역', '점수'],
    rows: [
      ['평균', '', r1v(dist?.mean)], ['중앙값', '', r1v(dist?.med)], ['표준편차', '', r1v(dist?.sd)],
      ['최저', '', r1v(dist?.lo)], ['최고', '', r1v(dist?.hi)],
      ...table.slice(0, 10).map((r) => [`상위 ${Math.round(r.rank)}위`, `${r.sido} ${r.name}`, r1v(r.ci)]),
      ...table.slice(-10).map((r) => [`하위 ${Math.round(r.rank)}위`, `${r.sido} ${r.name}`, r1v(r.ci)]),
    ],
  })
  const sidoPack = () => ({
    base: `SSI_시도별평균_${m.label}`, title: `시도별 평균 비교 · ${m.label}`,
    sub: '시군구 부문지수의 시도 안 단순평균',
    cols: ['시도', '시군구 수', '평균 부문지수'],
    rows: sidoAvg.map((o) => [o.sd, o.n, r1v(o.m)]),
  })
  const regionPack = () => (selRow ? {
    base: `SSI_${selRow.name}_지표상세_${m.label}`, title: `${selRow.sido} ${selRow.name} · 지표 상세`,
    sub: `표준화 ${m.label} · 부문지수 ${f1(result.ci[mk]?.[selIdx])} · 전국 ${Math.round(result.rank[mk]?.[selIdx] ?? 0)}위`,
    cols: ['지표', '원값', '표준화값', '지표 순위'],
    rows: result.stages.map((st, j) => [st.pick.label, fmtRaw(st.raw[selIdx]),
      r1v(st.std[mk][selIdx]),
      result.indRank[mk]?.[j]?.[selIdx] != null ? Math.round(result.indRank[mk][j][selIdx]) : null]),
  } : null)

  if (!entries.length) return <div className="v3-empty">0단계에서 지표를 먼저 골라 주세요.</div>

  const mapProps = (mm, which = 'A') => ({
    sector, metric: metricOf(mm, which), method: mm, methodLabel: methodOf(mm).label,
    selected, hovered, onSelect: (kk) => onSelect(kk === selected ? null : kk), onHover: setHovered,
    ramp: rampFor(which), k: k10(which), info, exportExtra,
    onlyHigh, onlyHighToggle: () => setOnlyHigh(!onlyHigh),
    flagOf: (r, i) => result.flag[i] || null,
  })

  // 지도 값 고르기 — 네 묶음 셀렉트 (v2 지도 색 기준)
  const MvalSelect = ({ which = 'A', mini = false }) => (
    <select className={`e5-mval mono${mini ? ' mini' : ''}`}
      value={mvalOf(which)}
      onChange={(e) => (which === 'B' ? setMvalB(e.target.value) : setMval(e.target.value))}>
      {MVAL_GROUPS.map(([g, items]) => (
        <optgroup key={g} label={g}>
          {items.map(([k2, lab]) => <option key={k2} value={k2}>{lab}</option>)}
        </optgroup>
      ))}
    </select>
  )

  // 팔레트 견본 — 다섯 칸 나뉜 칩
  const Swatches = ({ cur, onPick, mini = false }) => (
    <div className="e5c-pal">
      {PALETTES.map((p) => (
        <button key={p.key} className={`palsw${mini ? ' mini' : ''}${cur === p.key ? ' on' : ''}`} title={p.label}
          onClick={() => onPick(p.key)}>
          {rampOf(p.key, 5).map((c) => <i key={c} style={{ background: c }} />)}
        </button>
      ))}
    </div>
  )

  return (
    <div className="e5-wrap">
      {/* ── 가운데 · 지도 ── */}
      <div className="e5-mid">
        <div className="e5-ctrl glass">
          {!compare && (
            <>
              <div className="e5c-group">
                <u>표준화 방법</u>
                <div className="seg">
                  {METHODS.map((mm) => (
                    <button key={mm.key} className={mk === mm.key ? 'on' : ''}
                      onClick={() => onMethod(mm.key)}>{mm.label}</button>
                  ))}
                </div>
              </div>
              <span className="e5c-sep" />
            </>
          )}
          {!compare && (
          <div className="e5c-group">
            <u>지도 값 · 네 묶음</u>
            <span>
              <MvalSelect which="A" />
              {mval === 'grade' && (
                <div className="seg">
                  <button className={gradeMode === 'decile' ? 'on' : ''} onClick={() => onGradeMode('decile')}
                    title="순위 기준으로 열 칸에 고르게 — 각 등급 약 10%씩">십분위</button>
                  <button className={gradeMode === 'equal' ? 'on' : ''} onClick={() => onGradeMode('equal')}
                    title="값의 범위를 열 칸으로 등분 — 분포가 쏠리면 몰릴 수 있음">등간격</button>
                </div>
              )}
            </span>
          </div>
          )}
          {!compare && (
            <>
              <span className="e5c-sep" />
              <div className="e5c-group">
                <u>지도 색 · {paletteOf(palette).label}</u>
                <Swatches cur={palette} onPick={onPalette} />
              </div>
              <span className="e5c-sep" />
            </>
          )}
          {compare && <span className="e5c-sep" />}
          <div className="e5c-group">
            <u>비교 · 출력</u>
            <span>
              <button className={`ghost-btn${compare ? ' on' : ''}`} onClick={() => setCompare(!compare)}>
                {compare ? '지도 한 장으로' : '2개 지도 비교'}
              </button>
              <button className="acc-btn" onClick={onReport}>최종 리포트 →</button>
            </span>
          </div>
        </div>

        <div className="e5-stage">
        {!compare ? (
          <div className="e5-map glass-edge"><NationalMap {...mapProps(mk)} /></div>
        ) : (
          <div className="e5-two">
            <div className="e5-map glass-edge">
              <div className="e5m-bar">
                <em className="mono">A</em>
                <div className="seg mini">
                  {METHODS.map((mm) => (
                    <button key={mm.key} className={mk === mm.key ? 'on' : ''}
                      onClick={() => onMethod(mm.key)}>{mm.label}</button>
                  ))}
                </div>
                <MvalSelect which="A" mini />
                <Swatches cur={palette} onPick={onPalette} mini />
              </div>
              <NationalMap {...mapProps(mk, 'A')} compact tips />
            </div>
            <div className="e5-map glass-edge">
              <div className="e5m-bar">
                <em className="mono">B</em>
                <div className="seg mini">
                  {METHODS.map((mm) => (
                    <button key={mm.key} className={methodB === mm.key ? 'on' : ''}
                      onClick={() => setMethodB(mm.key)}>{mm.label}</button>
                  ))}
                </div>
                <MvalSelect which="B" mini />
                <Swatches cur={paletteB} onPick={setPaletteB} mini />
              </div>
              <NationalMap {...mapProps(methodB, 'B')} compact tips />
            </div>
          </div>
        )}

      {/* ── 왼쪽 · 순위표 (지도 위 도킹 · 접기 가능) ── */}
      {leftOpen ? (
      <aside className="e5-left glass e5-dock e5-dock-l">
        <div className="e5l-head">
          <b>지역별 점수 순위</b>
          <span className="mono">{m.label}</span>
          <button className="e5-fold" onClick={() => setLeftOpen(false)} title="패널 접기">⟨</button>
        </div>
        <input className="e5l-q mono" placeholder="시군구 찾기…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="e5l-cols mono"><span>순위</span><span>지역</span><span>점수</span><span>등급</span></div>
        <div className="e5l-list" ref={listRef}>
          {table.map((r) => (
            <button key={r.key} data-on={r.key === selected ? '1' : '0'}
              className={`e5l-row${r.key === selected ? ' on' : ''}`}
              onClick={() => onSelect(r.key === selected ? null : r.key)}>
              <u className="mono">{Math.round(r.rank)}</u>
              <span><em>{shortSido(r.sido)}</em>{r.name}</span>
              <b className="mono">{f1(r.ci)}</b>
              <i className="e5l-g mono" style={{ background: gradeColor(r.grade), color: gradeInk(r.grade) }}>{r.grade}</i>
            </button>
          ))}
        </div>
        <div className="e5l-dl"><DlMenu pack={rankPack} up wide label="순위표 저장 (CSV·Excel·PNG)" cls="ghost-btn" /></div>
      </aside>
      ) : (
        <button className="e5-tab e5-tab-l glass" onClick={() => setLeftOpen(true)} title="순위 패널 펴기">
          <i>⟩</i><span>지역별 점수 순위</span>
        </button>
      )}

      {/* ── 오른쪽 · 지표 구성 (지도 위 도킹 · 접기 가능) ── */}
      {rightOpen ? (
      <aside className="e5-right glass e5-dock e5-dock-r">
        {selRow ? (
          <>
            <div className="e5r-head">
              <b>{selRow.sido} {selRow.name}</b>
              <span className="e5r-hbtns">
                <button className="x" onClick={() => onSelect(null)} title="선택 해제">✕</button>
                <button className="e5-fold" onClick={() => setRightOpen(false)} title="패널 접기">⟩</button>
              </span>
            </div>
            <div className="e5r-kpi">
              <div><u>부문지수</u><b className="mono">{f1(result.ci[mk]?.[selIdx])}</b></div>
              <div><u>전국 순위</u><b className="mono">{Math.round(result.rank[mk]?.[selIdx] ?? 0)}위</b></div>
              <div><u>10등급</u><b className="mono">{result.grade[mk]?.[selIdx]}등급</b></div>
              <div><u>T점수</u><b className="mono">{f1(result.ciT[mk]?.[selIdx])}</b></div>
            </div>

            <div className="e5r-cap">지표 구성 (표준화값 · {m.label})</div>
            <div className="e5r-radar">
              <ResponsiveContainer width="100%" height={230}>
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="rgba(15,23,42,0.14)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#46536B', fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'rgba(70,83,107,0.55)', fontSize: 9 }} tickCount={3} stroke="rgba(15,23,42,0.1)" />
                  <Radar name="전국 중앙값" dataKey="nation" stroke="rgba(15,23,42,0.45)"
                    fill="rgba(15,23,42,0.06)" strokeDasharray="4 3" />
                  <Radar name={selRow.name} dataKey="region" stroke="var(--acc)"
                    fill="var(--acc)" fillOpacity={0.28} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="e1-legend mono">
                <span><i className="lg-solid" />{selRow.name}</span>
                <span><i className="lg-dash" />전국 중앙값</span>
              </div>
            </div>

            <div className="e5r-cap">부문지수 분포 · 내 위치</div>
            <HistBars values={result.ci[mk] || []} h={64} color="var(--acc)"
              marks={[{ v: result.ci[mk]?.[selIdx], color: '#E8420C' }]} />

            <div className="e5r-cap withdl">지표 상세
              <DlMenu pack={regionPack} cls="e5r-dl" label="저장" wide /></div>
            <div className="e5r-tbl mono">
              <div className="e5rt-h"><span>지표</span><span>원값</span><span>표준화</span><span>순위</span></div>
              {result.stages.map((st, j) => (
                <div key={st.pick.col} className="e5rt-r">
                  <span title={st.pick.label}>{st.pick.label}</span>
                  <b>{fmtRaw(st.raw[selIdx])}</b>
                  <b>{f1(st.std[mk][selIdx])}</b>
                  <b>{result.indRank[mk]?.[j]?.[selIdx] != null ? `${Math.round(result.indRank[mk][j][selIdx])}위` : '—'}</b>
                </div>
              ))}
            </div>

            <div className="e5r-cap">지표별 값 · 기여</div>
            <div className="e5r-bars">
              {result.stages.map((s, j) => {
                const v = s.std[mk][selIdx]
                const w = result.weights[j] / wSum * 100
                return (
                  <div key={s.pick.col} className="e5r-bar">
                    <div className="e5rb-lab"><span>{s.pick.label}</span>
                      <b className="mono">{f1(v)}<em> · 가중 {Math.round(w)}%</em></b></div>
                    <div className="e5rb-track">
                      <i style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="e5r-head"><b>전국 요약</b>
              <button className="e5-fold" onClick={() => setRightOpen(false)} title="패널 접기">⟩</button></div>
            <p className="e5r-note">지도나 왼쪽 표에서 시군구를 고르면 그 지역의 지표 구성이
              방사 차트로 나옵니다.</p>
            <div className="e5r-cap withdl">부문지수 분포 · {m.label}
              <DlMenu pack={summaryPack} cls="e5r-dl" label="저장" wide /></div>
            {dist && (
              <div className="e5r-figs mono">
                <span><u>평균</u><b>{f1(dist.mean)}</b></span>
                <span><u>중앙값</u><b>{f1(dist.med)}</b></span>
                <span><u>표준편차</u><b>{f1(dist.sd)}</b></span>
                <span><u>최저</u><b>{f1(dist.lo)}</b></span>
                <span><u>최고</u><b>{f1(dist.hi)}</b></span>
                <span><u>중간 절반</u><b>{f1(dist.q1)}~{f1(dist.q3)}</b></span>
              </div>
            )}
            <HistBars values={result.ci[mk] || []} h={84} color="var(--acc)" />
            <div className="e5r-cap">상위 10</div>
            <div className="e5r-mini">
              {table.slice(0, 10).map((r) => (
                <button key={r.key} onClick={() => onSelect(r.key)}>
                  <u className="mono">{Math.round(r.rank)}</u><span>{shortSido(r.sido)} {r.name}</span>
                  <b className="mono">{f1(r.ci)}</b>
                </button>
              ))}
            </div>
            <div className="e5r-cap">하위 10</div>
            <div className="e5r-mini">
              {table.slice(-10).map((r) => (
                <button key={r.key} onClick={() => onSelect(r.key)}>
                  <u className="mono">{Math.round(r.rank)}</u><span>{shortSido(r.sido)} {r.name}</span>
                  <b className="mono">{f1(r.ci)}</b>
                </button>
              ))}
            </div>
          </>
        )}

        {/* 공통 — 시도별 평균 · 산점도 (v2 통계창 내용) */}
        <div className="e5r-cap withdl">시도별 평균 비교
          <DlMenu pack={sidoPack} cls="e5r-dl" label="저장" wide /></div>
        <div className="e5r-sido">
          {sidoAvg.map((o) => {
            const lo = sidoAvg[sidoAvg.length - 1]?.m ?? 0
            const hi = sidoAvg[0]?.m ?? 1
            const w = ((o.m - lo) / ((hi - lo) || 1)) * 82 + 14
            return (
              <div key={o.sd} className={`e5rs-row${selRow && selRow.sido === o.sd ? ' on' : ''}`}>
                <span>{shortSido(o.sd)}</span>
                <div className="e5rs-track"><i style={{ width: `${w}%` }} /></div>
                <b className="mono">{f1(o.m)}</b>
              </div>
            )
          })}
        </div>
        <div className="e5r-cap">산점도 — 두 값의 관계</div>
        <MiniScatter options={scatterOpts} selectedIdx={selIdx} />
      </aside>
      ) : (
        <button className="e5-tab e5-tab-r glass" onClick={() => setRightOpen(true)} title="구성 패널 펴기">
          <i>⟨</i><span>{selRow ? `${selRow.name} 구성` : '전국 요약'}</span>
        </button>
      )}
        </div>
      </div>
    </div>
  )
}
