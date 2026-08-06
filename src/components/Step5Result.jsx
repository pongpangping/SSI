import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts'
import NationalMap from './NationalMap.jsx'
import { HistBars } from './EdaHist.jsx'
import { ROWS, N, METHODS, methodOf, pctFromRank } from '../lib/pipeline.js'
import { rowKey, rowIndex, shortSido } from '../lib/ssi.js'
import { PALETTES, rampOf } from '../lib/palettes.js'

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
  const [view, setView] = useState('score')       // score | grade | rank
  const [compare, setCompare] = useState(false)
  const [methodB, setMethodB] = useState('pctrank')
  const [q, setQ] = useState('')
  const [hovered, setHovered] = useState(null)
  const listRef = useRef(null)

  const mk = method
  const m = methodOf(mk)
  const k10 = view === 'grade'
  const ramp = useMemo(() => rampOf(palette, k10 ? 10 : 7), [palette, k10])

  // ── 지도 색 기준(메트릭) — 파이프라인 결과를 그대로 읽는 임시 객체 ──────
  const metricOf = (mm) => {
    const lab = methodOf(mm).label
    if (view === 'grade') return {
      key: 'grade', scale: 'rank', discrete: 10,
      label: `10등급 · ${lab}`, full: `부문지수 10등급 (${gradeMode === 'decile' ? '십분위' : '등간격'}) · ${lab}`,
      fmt: (v) => (v == null ? '—' : `${v}등급`), ends: ['10등급', '1등급'],
      get: (r, i) => result.grade[mm]?.[i] ?? null,
    }
    if (view === 'rank') return {
      key: 'rank', scale: 'rank',
      label: `전국 순위 · ${lab}`, full: `부문지수 전국 순위 · ${lab}`,
      fmt: (v) => (v == null ? '—' : `${Math.round(v)}위`),
      get: (r, i) => result.rank[mm]?.[i] ?? null,
    }
    return {
      key: 'ci', scale: 'blue',
      label: `부문지수 · ${lab}`, full: `가중 합성 부문지수 · ${lab}`,
      fmt: f1,
      get: (r, i) => result.ci[mm]?.[i] ?? null,
    }
  }
  const metric = useMemo(metricOf, [view, mk, result, gradeMode])
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

  const csvDown = () => {
    const cols = ['시도', '시군구', '부문지수', 'T점수', '백분위', '전국순위', '10등급',
      ...result.stages.map((s) => `${s.pick.label}_표준화`)]
    const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
    const lines = ROWS.map((r, i) => [
      r.sido, r.name, f1(result.ci[mk]?.[i]), f1(result.ciT[mk]?.[i]),
      f1(pctFromRank(result.rank[mk]?.[i])), result.rank[mk]?.[i] ?? '', result.grade[mk]?.[i] ?? '',
      ...result.stages.map((s) => f1(s.std[mk][i])),
    ].map(esc).join(','))
    const blob = new Blob(['﻿' + [cols.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `SSI_종합점수_${m.short || m.key}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  if (!entries.length) return <div className="v3-empty">0단계에서 지표를 먼저 골라 주세요.</div>

  const mapProps = (mm) => ({
    sector, metric: metricOf(mm), method: mm, methodLabel: methodOf(mm).label,
    selected, hovered, onSelect: (kk) => onSelect(kk === selected ? null : kk), onHover: setHovered,
    dark: true, ramp, k: k10 ? 10 : 7, info, exportExtra, onlyHigh: false,
  })

  return (
    <div className="e5-wrap">
      {/* ── 왼쪽 · 순위표 ── */}
      <aside className="e5-left glass">
        <div className="e5l-head">
          <b>지역별 점수 순위</b>
          <span className="mono">{m.label}</span>
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
              <i className="e5l-g mono" style={{ background: gradeColor(r.grade) }}>{r.grade}</i>
            </button>
          ))}
        </div>
        <button className="ghost-btn e5l-dl" onClick={csvDown}>순위표 CSV 내려받기</button>
      </aside>

      {/* ── 가운데 · 지도 ── */}
      <div className="e5-mid">
        <div className="e5-ctrl glass">
          <div className="seg">
            {METHODS.map((mm) => (
              <button key={mm.key} className={mk === mm.key ? 'on' : ''}
                onClick={() => onMethod(mm.key)}>{mm.label}</button>
            ))}
          </div>
          <span className="e5c-sep" />
          <div className="seg">
            <button className={view === 'score' ? 'on' : ''} onClick={() => setView('score')}>점수</button>
            <button className={view === 'grade' ? 'on' : ''} onClick={() => setView('grade')}>10등급</button>
            <button className={view === 'rank' ? 'on' : ''} onClick={() => setView('rank')}>순위</button>
          </div>
          {view === 'grade' && (
            <div className="seg">
              <button className={gradeMode === 'decile' ? 'on' : ''} onClick={() => onGradeMode('decile')}
                title="순위 기준으로 열 칸에 고르게 — 각 등급 약 10%씩">십분위</button>
              <button className={gradeMode === 'equal' ? 'on' : ''} onClick={() => onGradeMode('equal')}
                title="값의 범위를 열 칸으로 등분 — 분포가 쏠리면 몰릴 수 있음">등간격</button>
            </div>
          )}
          <span className="e5c-sep" />
          <div className="e5c-pal">
            {PALETTES.map((p) => (
              <button key={p.key} className={`palsw${palette === p.key ? ' on' : ''}`} title={p.label}
                onClick={() => onPalette(p.key)}
                style={{ background: `linear-gradient(90deg, ${rampOf(p.key, 5).join(',')})` }} />
            ))}
          </div>
          <span className="e5c-sep" />
          <button className={`ghost-btn${compare ? ' on' : ''}`} onClick={() => setCompare(!compare)}>
            {compare ? '지도 한 장으로' : '2개 지도 비교'}
          </button>
          <button className="acc-btn" onClick={onReport}>최종 리포트 →</button>
        </div>

        {!compare ? (
          <div className="e5-map glass-edge"><NationalMap {...mapProps(mk)} /></div>
        ) : (
          <div className="e5-two">
            <div className="e5-map glass-edge">
              <div className="e5t-cap mono">A · {m.label}</div>
              <NationalMap {...mapProps(mk)} compact tips />
            </div>
            <div className="e5-map glass-edge">
              <div className="e5t-cap mono">
                B ·
                <select value={methodB} onChange={(e) => setMethodB(e.target.value)}>
                  {METHODS.filter((x) => x.key !== mk).map((x) => (
                    <option key={x.key} value={x.key}>{x.label}</option>
                  ))}
                </select>
              </div>
              <NationalMap {...mapProps(methodB)} compact tips />
            </div>
          </div>
        )}
      </div>

      {/* ── 오른쪽 · 지표 구성 ── */}
      <aside className="e5-right glass">
        {selRow ? (
          <>
            <div className="e5r-head">
              <b>{selRow.sido} {selRow.name}</b>
              <button className="x" onClick={() => onSelect(null)} title="선택 해제">✕</button>
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
                  <PolarGrid stroke="rgba(255,255,255,0.14)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: 'rgba(235,240,248,0.75)', fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'rgba(235,240,248,0.4)', fontSize: 9 }} tickCount={3} stroke="rgba(255,255,255,0.1)" />
                  <Radar name="전국 중앙값" dataKey="nation" stroke="rgba(255,255,255,0.5)"
                    fill="rgba(255,255,255,0.10)" strokeDasharray="4 3" />
                  <Radar name={selRow.name} dataKey="region" stroke="var(--acc)"
                    fill="var(--acc)" fillOpacity={0.28} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="e1-legend mono">
                <span><i className="lg-solid" />{selRow.name}</span>
                <span><i className="lg-dash" />전국 중앙값</span>
              </div>
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
            <div className="e5r-head"><b>전국 요약</b></div>
            <p className="e5r-note">지도나 왼쪽 표에서 시군구를 고르면 그 지역의 지표 구성이
              방사 차트로 나옵니다.</p>
            <div className="e5r-cap">부문지수 분포 · {m.label}</div>
            <HistBars values={result.ci[mk] || []} h={90} color="var(--acc)" />
            <div className="e5r-cap">상위 5</div>
            <div className="e5r-mini">
              {table.slice(0, 5).map((r) => (
                <button key={r.key} onClick={() => onSelect(r.key)}>
                  <u className="mono">{Math.round(r.rank)}</u><span>{shortSido(r.sido)} {r.name}</span>
                  <b className="mono">{f1(r.ci)}</b>
                </button>
              ))}
            </div>
            <div className="e5r-cap">하위 5</div>
            <div className="e5r-mini">
              {table.slice(-5).map((r) => (
                <button key={r.key} onClick={() => onSelect(r.key)}>
                  <u className="mono">{Math.round(r.rank)}</u><span>{shortSido(r.sido)} {r.name}</span>
                  <b className="mono">{f1(r.ci)}</b>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
