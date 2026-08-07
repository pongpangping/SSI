import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ROWS, metricFor, rowKey, METHOD_KEYS, SECTOR_KEYS,
  applyPicks, defaultPicks, picksOf, picksToHash, picksFromHash,
} from './lib/ssi.js'
import Header from './components/Header.jsx'
import LandingPage from './components/LandingPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import NationalMap from './components/NationalMap.jsx'
import CompareMaps from './components/CompareMaps.jsx'
import CenterPanel from './components/CenterPanel.jsx'
import PanelTab from './components/PanelTab.jsx'
import DataTable from './components/DataTable.jsx'
import IndicatorPicker from './components/IndicatorPicker.jsx'
import CursorFx from './components/CursorFx.jsx'

// ── URL 해시 상태 공유 ────────────────────────────────────────────────
// #s=S8&m=minmax&k=rank&r=경기도|성남시&i=S8_1_23.S8_2_23&x=ci&y=ciT&d=sens
// i(선택 지표)까지 포함하기 때문에, 링크를 받은 사람은 '같은 조합으로 계산한 화면'을 본다.
//
// 다만 링크에 부문(s)이 적혀 있어도 시작 화면을 건너뛰지는 않는다. 예전에는
// 곧장 들어가게 해 두었는데, 주소창에 지난 해시가 남아 있으면 새로 열 때마다
// 부문 고르는 화면이 아예 뜨지 않았다. 지금은 시작 화면을 항상 먼저 띄우고,
// 해시에 적힌 부문 카드에 '이어보던 부문' 띠를 붙여 맨 앞에 놓는다. 그 카드를
// 누르면 방법·지표 조합·선택 지역까지 그대로 복원되므로 링크 공유는 그대로다.
//
// 시·도 범위(g)는 뺐다. 이 지수는 전국 229개 시군구를 한 번에 세우는 지수라,
// 시·도로 걸러 놓고 보면 순위·평균이 전국 기준과 어긋나 읽힌다.
// 탭(t)도 뺐다. 통계창이 탭에서 본문+서랍으로 바뀌면서 자리가 없어졌다.
// 대신 접은 서랍을 d에 적는다(기본은 둘 다 펼침). 옛 링크의 t는 읽지 않고 무시한다.
function parseHash() {
  const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  const o = {}
  if (SECTOR_KEYS.includes(h.get('s'))) o.sector = h.get('s')
  if (METHOD_KEYS.includes(h.get('m'))) o.method = h.get('m')
  if (h.get('k')) o.metricKey = h.get('k')
  if (h.get('r')) o.selected = decodeURIComponent(h.get('r'))
  if (h.get('c') === '1') o.compare = true
  if (h.get('p') === '0') o.panelOpen = false
  if (h.get('i')) o.picks = picksFromHash(h.get('i'))
  if (h.get('x')) o.xKey = h.get('x')
  if (h.get('y')) o.yKey = h.get('y')
  if (h.get('d')) {
    // d 는 '접어 둔 서랍'을 적는다. 서랍은 기본이 펼침이라, 기본 상태에서는
    // d 가 아예 붙지 않는다. (16차의 d 는 '펼친 서랍'이었다 — 규칙이 뒤집혔다.)
    o.drawers = { sens: true, raw: true }
    h.get('d').split('.').forEach((k) => { if (k === 'sens' || k === 'raw') o.drawers[k] = false })
  }
  return o
}

// 서랍 기본값 — 둘 다 펼침.
// 16차에서는 접은 채로 시작했는데, 그러면 분포·범프 차트·산점도·순위 이동 목록이
// 화면에서 통째로 사라진 것처럼 보인다. 차례(본문이 먼저, 서랍이 나중)와 머리
// 모양만으로도 무엇이 주(主)인지는 충분히 드러나므로, 접어 감출 이유가 없다.
const ALL_OPEN = () => ({ sens: true, raw: true })

// 부문별 기본 조합 = 그 부문의 모든 지표를 가장 최근 연도로.
const basePicks = () => Object.fromEntries(SECTOR_KEYS.map((k) => [k, defaultPicks(k)]))

export default function App() {
  const init = useMemo(parseHash, [])
  // 시작 화면은 언제나 먼저 뜬다. 해시에 부문이 있어도 건너뛰지 않는다.
  const [started, setStarted] = useState(false)
  const [sector, setSector] = useState(init.sector || SECTOR_KEYS[0])
  const [method, setMethod] = useState(init.method || METHOD_KEYS[0])
  const [metricKey, setMetricKey] = useState(init.metricKey || 'rank')
  const [compare, setCompare] = useState(false)
  // 조작부는 항상 열려 있다. 접을 수 있는 것은 통계 패널 하나뿐.
  // 처음 들어오면 접혀 있다가, 꼭 골라야 하는 두 가지를 정하면 열린다.
  const [panelOpen, setPanelOpen] = useState(false)
  // 어디까지 왔는가. 1 지표 · 2 표준화 방법 · 3 다 골랐음
  //
  // 이 값이 지도의 성격도 정한다(21차). 3단계 전, 곧 표준화 점수가 아직 산출되지
  // 않은 동안 지도는 백지도다. 20차까지는 부문을 고르자마자 기본 조합으로 계산한
  // 주제도가 이미 칠해져 있었는데, 사용자가 아무것도 고르지 않았는데 색이 다 칠해져
  // 있으면 그 색이 무엇을 뜻하는지 알 수 없고, 뒤이어 지표를 고르는 일도 이미 나온
  // 결과를 손보는 일처럼 보인다. 지표와 방법을 정해 점수가 나온 다음에 주제도를 그린다.
  const [step, setStep] = useState(1)
  // 통계창 아래쪽 서랍 두 개. 처음부터 둘 다 펴 둔다.
  const [drawers, setDrawers] = useState(init.drawers || ALL_OPEN())
  const [onlyHigh, setOnlyHigh] = useState(false)
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [tableOpen, setTableOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [xKey, setXKey] = useState(init.xKey || null)
  const [yKey, setYKey] = useState(init.yKey || null)

  // 선택 지표. 링크로 받은 조합이 있으면 그 부문만 갈아 끼운다.
  const [picksBy, setPicksBy] = useState(() => {
    const base = basePicks()
    if (init.picks && init.sector) {
      base[init.sector] = init.picks
      applyPicks(init.sector, init.picks)
    }
    return base
  })
  // 계산 결과는 ROWS 위에 덮어써지므로 참조가 바뀌지 않는다.
  // 화면이 다시 그려지도록 판올림 번호를 하나 둔다.
  const [pickVer, setPickVer] = useState(0)

  const applyDraft = (draft, cur) => {
    SECTOR_KEYS.forEach((k) => {
      const a = draft[k] || [], b = picksBy[k] || []
      const same = a.length === b.length && a.every((p, i) => p.id === b[i].id && p.year === b[i].year)
      if (!same) applyPicks(k, a)
    })
    setPicksBy(draft)
    setPickVer((v) => v + 1)
    // 지표가 바뀌면 산점도 축 이름도 바뀐다. 기본 축으로 되돌린다.
    setXKey(null); setYKey(null)
    if (cur && cur !== sector && SECTOR_KEYS.includes(cur)) setSector(cur)
    // 지표를 확정했으면 다음 칸(표준화 방법)으로 넘어간다.
    if (step === 1) setStep(2)
  }

  // 시작 화면에서 부문을 골랐을 때.
  //
  // 어느 부문을 고르든 언제나 1 지표 선택부터 시작한다. 16차에서는 해시에 적힌
  // 부문을 다시 고르면 '이어보기'로 보고 곧장 3단계(지도 색 기준)로 뛰었는데,
  // 그러면 부문을 고르자마자 화면이 조작부 아래쪽으로 감겨 내려가, 무엇을
  // 골라야 하는지가 아니라 색 고르는 칸이 먼저 보였다.
  //
  // 이어보기는 이제 '되살리기'만 한다 — 표준화 방법·지도 색 기준·선택 지역·
  // 산점도 축은 링크에 담긴 대로 두되, 단계는 1로 되돌리고 통계창은 접어 둔다.
  // 지표를 확인하고 넘어가면 그 자리에 그대로 이어진다.
  const openSector = (k) => {
    const resume = !!init.sector && k === init.sector
    setSector(k)
    setStarted(true)
    setCompare(false)
    setStep(1)
    setPanelOpen(false)
    if (resume) {
      setMethod(init.method || METHOD_KEYS[0])
      setMetricKey(init.metricKey || 'rank')
      setSelected(init.selected || null)
      setDrawers(init.drawers || ALL_OPEN())
      setXKey(init.xKey || null); setYKey(init.yKey || null)
    } else {
      setMethod(METHOD_KEYS[0])
      setMetricKey('rank')
      setSelected(null)
      setDrawers(ALL_OPEN())
      setXKey(null); setYKey(null)
    }
  }

  const goHome = () => {
    setStarted(false)
    setPanelOpen(false)
    setStep(1)
    setSelected(null)
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  // 단계가 끝나면 통계창을 연다. 다 고르기 전에 열어 두면, 아직 아무것도
  // 정하지 않은 화면에 숫자가 가득 차 무엇을 보라는 것인지 알 수 없다.
  const goStep = (n) => {
    setStep(n)
    if (n >= 3) setPanelOpen(true)
  }

  const toggleDrawer = (k, v) => setDrawers((d) => ({ ...d, [k]: v }))

  const metric = metricFor(sector, method, metricKey)
  const byKey = useMemo(() => Object.fromEntries(ROWS.map((r) => [rowKey(r), r])), [])

  // 지도에서 아직 아무 곳도 고르지 않았으면 선택 지역은 비워 둔다.
  // 예전에는 순위 이동이 가장 큰 곳을 임의로 골라 두었는데, 사람이 고른 것과
  // 프로그램이 고른 것이 화면에서 구분되지 않아 오해를 샀다.
  const sel = selected && byKey[selected] ? selected : null
  const selectedRow = sel ? byKey[sel] : null

  // 지역을 고르면 그 결과가 통계창 맨 위로 올라오고, 전국 요약은 화면에서
  // 빠진다(21차). 15차까지는 선택 지역 결과가 전국 요약 아래에 있어서, 지도를
  // 눌러도 화면이 그대로인 것처럼 보였다.
  const prevSel = useRef(sel)
  useEffect(() => {
    if (prevSel.current === sel) return
    prevSel.current = sel
    if (!sel) return
    const el = document.querySelector('.center')
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
  }, [sel])

  useEffect(() => {
    if (!started) return
    const p = new URLSearchParams()
    p.set('s', sector); p.set('m', method); p.set('k', metric.key)
    if (sel) p.set('r', encodeURIComponent(sel))
    if (compare) p.set('c', '1')
    if (!panelOpen) p.set('p', '0')
    const shut = ['sens', 'raw'].filter((k) => !drawers[k])
    if (shut.length) p.set('d', shut.join('.'))   // 접은 것만 적는다. 기본(둘 다 펼침)이면 안 적는다
    const cur = picksOf(sector)
    const base = defaultPicks(sector)
    const same = cur.length === base.length && cur.every((q, i) => q.id === base[i].id && q.year === base[i].year)
    if (!same) p.set('i', picksToHash(cur))       // 기본 조합이면 굳이 적지 않는다
    if (xKey) p.set('x', xKey)
    if (yKey) p.set('y', yKey)
    window.history.replaceState(null, '', `#${p.toString()}`)
  }, [started, sector, method, metric.key, sel, compare, panelOpen, drawers, pickVer, xKey, yKey])

  const link = { selected: sel, hovered, onSelect: setSelected, onHover: setHovered, onMethod: setMethod }
  const onAxis = (which, key) => (which === 'x' ? setXKey(key) : setYKey(key))

  // 지도 위에 떠 있는 조작·통계 덱의 실제 폭(px).
  // 왼쪽 여백 14 + 덱 테두리 2 + 조작부 300 + (칸 사이 선 1 + 통계창 366)
  // + 덱 밖으로 물린 손잡이 25 + 지도와의 간격 14
  const deckW = 14 + 302 + (panelOpen ? 367 : 0) + 25 + 14

  if (!started) {
    return (
      <>
        <LandingPage onPick={openSector} resume={init.sector || null} />
        <CursorFx />
      </>
    )
  }

  return (
    <div className="shell">
      <Header onTable={() => setTableOpen(true)} sector={sector} onHome={goHome} />
      <div className="body body-3col" style={{ '--deck': `${deckW}px` }}>
        {/* 조작부 + 통계창 + 손잡이는 테두리 하나·모서리 하나를 함께 쓰는 한 덩어리다.
            따로 놀던 상자 두 개가 맞물린 것처럼 보이지 않게 하기 위한 껍데기. */}
        <div className={`deck${panelOpen ? ' open' : ''}`}>
          <Sidebar
            sector={sector}
            method={method} onMethod={setMethod}
            metric={metric} metricKey={metric.key} onMetric={setMetricKey}
            onlyHigh={onlyHigh} onOnlyHigh={setOnlyHigh}
            compare={compare} onCompare={setCompare}
            onOpenPicker={() => setPickerOpen(true)}
            step={step} onStep={goStep}
          />
          {panelOpen && (
            <CenterPanel sector={sector} method={method} metric={metric}
              selectedRow={selectedRow} link={link} ver={pickVer}
              xKey={xKey} yKey={yKey} onAxis={onAxis}
              drawers={drawers} onDrawer={toggleDrawer}
              onOpenPicker={() => setPickerOpen(true)} />
          )}
        </div>
        {/* 손잡이는 덱 밖으로 물려 나온 책갈피 — 덱과 같은 바탕·테두리를 쓰고
            맞닿는 왼쪽 변만 지워, 덱에서 그대로 뻗어 나온 것처럼 보이게 한다. */}
        <PanelTab open={panelOpen} label="통계" onToggle={() => setPanelOpen(!panelOpen)} />
        {compare
          ? <CompareMaps sector={sector} method={method} metricKey={metric.key} onlyHigh={onlyHigh}
              ver={pickVer} onlyHighToggle={() => setOnlyHigh(!onlyHigh)} {...link} />
          : <NationalMap sector={sector} metric={metric} method={method} onlyHigh={onlyHigh}
              blank={step < 3}
              ver={pickVer} padLeft={deckW} onlyHighToggle={() => setOnlyHigh(!onlyHigh)} {...link} />}
      </div>
      <CursorFx />
      {tableOpen && <DataTable sector={sector} onClose={() => setTableOpen(false)}
        selected={sel} onSelect={setSelected} ver={pickVer} />}
      {pickerOpen && <IndicatorPicker sector={sector} picksBy={picksBy}
        onApply={applyDraft} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
