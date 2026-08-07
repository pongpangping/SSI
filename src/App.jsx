import { useEffect, useMemo, useState } from 'react'
import {
  SECTORS, SECTOR_KEYS, applyPicks, defaultPicks, indsOf, picksOf,
} from './lib/ssi.js'
import { SERIES, runPipeline, defaultCfg } from './lib/pipeline.js'
import LandingPage from './components/LandingPage.jsx'
import IndicatorPicker from './components/IndicatorPicker.jsx'
import DataDefsModal from './components/DataDefsModal.jsx'
import GlossaryModal from './components/GlossaryModal.jsx'
import SectorIcon from './components/SectorIcon.jsx'
import CursorFx from './components/CursorFx.jsx'
import Step1Explore from './components/Step1Explore.jsx'
import Step2Transform from './components/Step2Transform.jsx'
import Step3Standardize from './components/Step3Standardize.jsx'
import Step4Weights from './components/Step4Weights.jsx'
import Step5Result from './components/Step5Result.jsx'
import ShiftTab from './components/ShiftTab.jsx'
import ReportView from './components/ReportView.jsx'
import NationalMap from './components/NationalMap.jsx'

// v3 (22차) — EDA 파이프라인으로 전면 개편.
//
// 화면은 세 탭이다.
//   분석 플로우   0 지표 선택 → 1 지표 탐색 → 2 변환·방향 → 3 표준화
//                → 4 가중치 → 5 종합점수(순위표 · 지도 · 방사 차트)
//   순위 이동     표준화 민감도 검증 — 플로우에서 아예 따로 뺐다
//   리포트        인쇄용 최종 화면 (브라우저 인쇄 → PDF)
//
// 설정은 지표(자료 열) 단위로 붙는다 — 부문을 오가도, 같은 지표를 다시 골라도
// 방향·변환·윈저라이징·가중치가 그대로 남는다.

// 백지도 배경용 빈 메트릭 — 값이 확정되기 전에는 지도에 칠할 것이 없다(21차 규칙).
const BLANK_METRIC = {
  key: 'blank', scale: 'blue', label: '', fmt: () => '—', get: () => null,
}

// 시트 머리에 적는 단계별 설명 — 이 단계에서 무엇을 결정하는가 한 줄.
const STEP_DESC = {
  0: '부문에서 계산에 넣을 지표와 연도를 정합니다.',
  1: '지표마다 기술통계와 분포를 보고, 이대로 표준화해도 되는 모양인지 확인합니다.',
  2: '지표마다 방향(P/N) · 윈저라이징 · 로그화 여부를 정합니다.',
  3: '다섯 가지 표준화 방법의 분포를 비교하고 기본 방법을 고릅니다.',
  4: '지표별 가중치를 정합니다. 기본은 동일 가중, 합은 항상 100입니다.',
}

const STEPS = [
  { n: 0, t: '지표 선택', d: '부문 · 연도 · 지표' },
  { n: 1, t: '지표 탐색', d: '기술통계 · 분포' },
  { n: 2, t: '변환 · 방향', d: 'P/N · 로그화 · 윈저라이징' },
  { n: 3, t: '표준화', d: '5개 방법 · 분포 비교' },
  { n: 4, t: '가중치', d: '합 100 분할' },
  { n: 5, t: '종합점수', d: '지도 · 순위 · 방사 차트' },
]

export default function App() {
  const [started, setStarted] = useState(false)
  const [sector, setSector] = useState(SECTOR_KEYS[0])
  const [tab, setTab] = useState('flow')            // flow | shift | report
  const [step, setStep] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [ver, setVer] = useState(0)                 // applyPicks 반영 신호

  // 지표(열) 단위 설정 — 방향·변환·윈저·표준화 여부 / 가중치
  const [cfgBy, setCfgBy] = useState({})
  const [weightsBy, setWeightsBy] = useState({})
  const [method, setMethod] = useState('minmax')
  const [alpha, setAlpha] = useState(5)
  const [gradeMode, setGradeMode] = useState('decile')
  const [palette, setPalette] = useState('blue')
  const [selected, setSelected] = useState(null)

  const entries = useMemo(() => indsOf(sector), [sector, ver])

  // 고른 지표마다 설정이 반드시 있게 채운다 (없으면 지표체계의 기본 방향)
  const cfg = useMemo(() => {
    const o = {}
    entries.forEach((e) => { o[e.col] = cfgBy[e.col] || defaultCfg(e.dir) })
    return o
  }, [entries, cfgBy])
  const setCfg = (col, c) => setCfgBy((prev) => ({ ...prev, [col]: c }))

  const weights = useMemo(() => {
    const o = {}
    entries.forEach((e) => {
      o[e.col] = Number.isFinite(weightsBy[e.col]) ? weightsBy[e.col] : 100 / (entries.length || 1)
    })
    return o
  }, [entries, weightsBy])

  const result = useMemo(() => runPipeline(
    entries.map((e) => ({ col: e.col, id: e.id, label: e.label, year: e.year, unit: e.unit, dir: e.dir })),
    cfg, alpha, weights, gradeMode,
  ), [entries, cfg, alpha, weights, gradeMode])

  const seriesOf = (col) => SERIES[col] || []

  const pickSector = (k) => {
    if (!indsOf(k).length) applyPicks(k, defaultPicks(k))
    setSector(k)
    setStarted(true)
    setTab('flow')
    setStep(0)
    setVer((v) => v + 1)
  }
  const applyDraft = (draft, next) => {
    Object.entries(draft).forEach(([k, picks]) => applyPicks(k, picks))
    setSector(next)
    setVer((v) => v + 1)
  }

  useEffect(() => { setSelected(null) }, [sector])

  if (!started) return (
    <>
      <CursorFx />
      <LandingPage onPick={pickSector} />
    </>
  )

  const canGo = entries.length > 0
  const s = SECTORS[sector]

  return (
    <div className="v3-shell">
      <CursorFx />
      <div className="v3-atmo" aria-hidden="true" />

      {/* ── 머리줄 — 유리 알약 ── */}
      <header className="v3-head glass noprint">
        <div className="v3h-left">
          <div className="v3h-logo mono">SAL</div>
          <div className="v3h-title">국토종합진단지수 <em>EDA 대시보드</em></div>
          <button className="v3h-sector" onClick={() => setStarted(false)} title="다른 부문 고르기">
            <SectorIcon k={sector} state="on" size={15} />
            <b>{s.name}</b><u>바꾸기</u>
          </button>
        </div>
        <nav className="v3h-tabs">
          <button className={tab === 'flow' ? 'on' : ''} onClick={() => setTab('flow')}>분석 플로우</button>
          <button className={tab === 'shift' ? 'on' : ''} disabled={!canGo}
            onClick={() => setTab('shift')}>순위 이동</button>
          <button className={tab === 'report' ? 'on' : ''} disabled={!canGo}
            onClick={() => setTab('report')}>리포트</button>
        </nav>
        <div className="v3h-right">
          <DataDefsModal sector={sector} />
          <GlossaryModal />
        </div>
      </header>

      {/* ── 상시 배경 지도 — 값이 확정되기 전(0~4단계)에는 백지도 ── */}
      {tab === 'flow' && step < 5 && (
        <div className="v3-backmap">
          <NationalMap sector={sector} metric={BLANK_METRIC} blank bare
            selected={selected} hovered={null} onSelect={setSelected} onHover={() => {}} tips />
        </div>
      )}

      {/* ── 본문 — 왼쪽 세로 단계 레일 + 가운데 작업 창 ── */}
      <div className="v3-body">
      {tab === 'flow' && (
        <aside className="v3-rail glass noprint">
          <div className="v3r-cap mono">분석 단계</div>
          {STEPS.map((st) => (
            <button key={st.n}
              className={`v3s${step === st.n ? ' on' : ''}${st.n < step ? ' done' : ''}${st.n > 0 && !canGo ? ' off' : ''}`}
              disabled={st.n > 0 && !canGo}
              onClick={() => setStep(st.n)}>
              <u className="mono">{st.n < step ? '✓' : st.n}</u>
              <span><b>{st.t}</b><em>{st.d}</em></span>
            </button>
          ))}
          <p className="v3r-hint">지표와 방법이 정해지면 5단계에서 지도에 색이 칠해집니다. 그 전까지는 백지도입니다.</p>
        </aside>
      )}
      <main className={`v3-main${tab === 'flow' && step === 5 ? ' wide' : ''}${tab === 'flow' && step < 5 ? ' sheetmode' : ''}`}>
        {tab === 'flow' && step < 5 && (
        <div className={`v3-sheet glass v3-sheet-s${step}`}>
        <div className="v3-sh-head">
          <span className="mono">STEP {step} / 5</span>
          <h2>{STEPS[step].t}</h2>
          <p>{STEP_DESC[step]}</p>
        </div>
        {step === 0 && (
          <div className="e0-wrap">
            <div className="e0-head">
              <b>{s.name} · 담긴 지표 {entries.length}개</b>
              <span className="e0-note">연도가 다른 같은 지표를 함께 담아 비교할 수도 있습니다.</span>
            </div>
            <div className="e0-list">
              {entries.map((e) => (
                <div key={e.col} className="e0-item">
                  <b>{e.label}</b>
                  <span className="mono">{e.year}년{e.unit ? ` · ${e.unit}` : ''}</span>
                  <em className={`dirb ${e.dir === '+' ? 'p' : 'n'}`}>{e.dir === '+' ? 'P' : 'N'}</em>
                  {e.desc && <p>{e.desc}</p>}
                </div>
              ))}
              <button className="e0-add" onClick={() => setPickerOpen(true)}>
                <i>＋</i><b>지표 추가 · 변경</b>
                <span>부문의 지표 목록에서 골라 담습니다</span>
              </button>
            </div>
          </div>
        )}

        {step === 1 && <Step1Explore entries={entries} seriesOf={seriesOf} />}
        {step === 2 && (
          <Step2Transform entries={entries} seriesOf={seriesOf} cfg={cfg} onCfg={setCfg} />
        )}
        {step === 3 && (
          <Step3Standardize entries={entries} result={result} cfg={cfg} onCfg={setCfg}
            method={method} onMethod={setMethod} alpha={alpha} onAlpha={setAlpha} />
        )}
        {step === 4 && (
          <Step4Weights entries={entries} weights={weights}
            onWeights={(w) => setWeightsBy((prev) => ({ ...prev, ...w }))} />
        )}
        <div className="v3-sheetnav">
          {step > 0
            ? <button className="ghost-btn" onClick={() => setStep(step - 1)}>← 이전 · {STEPS[step - 1].t}</button>
            : <span />}
          <button className="acc-btn" disabled={!canGo} onClick={() => setStep(step + 1)}>
            다음 단계 · {STEPS[step + 1].t} →
          </button>
        </div>
        </div>
        )}

        {tab === 'flow' && step === 5 && (
          <Step5Result sector={sector} entries={entries} result={result}
            method={method} onMethod={setMethod}
            gradeMode={gradeMode} onGradeMode={setGradeMode}
            palette={palette} onPalette={setPalette}
            selected={selected} onSelect={setSelected}
            onReport={() => setTab('report')} />
        )}

        {tab === 'shift' && <ShiftTab entries={entries} result={result} />}
        {tab === 'report' && (
          <ReportView sector={sector} entries={entries} result={result}
            method={method} alpha={alpha} gradeMode={gradeMode} palette={palette}
            onBack={() => { setTab('flow'); setStep(5) }} />
        )}
      </main>
      </div>

      {pickerOpen && (
        <IndicatorPicker sector={sector}
          picksBy={Object.fromEntries(SECTOR_KEYS.map((k) => [k, picksOf(k)]))}
          onApply={applyDraft} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
