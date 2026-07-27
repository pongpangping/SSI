import { useEffect, useMemo, useState } from 'react'
import { ROWS, metricFor, rowKey, METHOD_KEYS, SIDOS } from './lib/ssi.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import NationalMap from './components/NationalMap.jsx'
import CompareMaps from './components/CompareMaps.jsx'
import CenterPanel from './components/CenterPanel.jsx'
import PanelTab from './components/PanelTab.jsx'
import DataTable from './components/DataTable.jsx'
import CursorFx from './components/CursorFx.jsx'

// ── URL 해시 상태 공유 (#s=S1&m=minmax&k=rank&g=경기도&r=경기도|성남시) ────────
function parseHash() {
  const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  const o = {}
  if (h.get('s') === 'S1' || h.get('s') === 'S8') o.sector = h.get('s')
  if (METHOD_KEYS.includes(h.get('m'))) o.method = h.get('m')
  if (h.get('k')) o.metricKey = h.get('k')
  if (h.get('r')) o.selected = decodeURIComponent(h.get('r'))
  const g = h.get('g') ? decodeURIComponent(h.get('g')) : null
  if (g && SIDOS.includes(g)) o.sido = g
  if (h.get('c') === '1') o.compare = true
  if (h.get('p') === '0') o.panelOpen = false
  return o
}

export default function App() {
  const init = useMemo(parseHash, [])
  const [sector, setSector] = useState(init.sector || 'S1')
  const [method, setMethod] = useState(init.method || 'minmax')
  const [metricKey, setMetricKey] = useState(init.metricKey || 'rank')
  const [compare, setCompare] = useState(!!init.compare)
  // 조작부는 항상 열려 있다. 접을 수 있는 것은 통계 패널 하나뿐.
  const [panelOpen, setPanelOpen] = useState(init.panelOpen !== false)
  const [onlyHigh, setOnlyHigh] = useState(false)
  const [sido, setSido] = useState(init.sido || null)
  const [selected, setSelected] = useState(init.selected || null)
  const [hovered, setHovered] = useState(null)
  const [tableOpen, setTableOpen] = useState(false)

  const metric = metricFor(sector, method, metricKey)
  const byKey = useMemo(() => Object.fromEntries(ROWS.map((r) => [rowKey(r), r])), [])

  // 기본 선택: (시도를 골랐으면 그 안에서) 순위 이동이 가장 큰 시군구
  const topKey = useMemo(() => {
    const pool = sido ? ROWS.filter((r) => r.sido === sido) : ROWS
    const r = [...pool].sort((a, b) => (b[sector].ssiCamp || 0) - (a[sector].ssiCamp || 0))[0]
    return r ? rowKey(r) : null
  }, [sector, sido])

  // 시도를 바꾸면 선택 시군구도 그 시도 안으로 자동 정렬된다
  const ok = selected && byKey[selected] && (!sido || byKey[selected].sido === sido)
  const sel = ok ? selected : topKey
  const selectedRow = byKey[sel]

  useEffect(() => {
    const p = new URLSearchParams()
    p.set('s', sector); p.set('m', method); p.set('k', metric.key)
    if (sido) p.set('g', encodeURIComponent(sido))
    if (sel) p.set('r', encodeURIComponent(sel))
    if (compare) p.set('c', '1')
    if (!panelOpen) p.set('p', '0')
    window.history.replaceState(null, '', `#${p.toString()}`)
  }, [sector, method, metric.key, sido, sel, compare, panelOpen])

  const link = { selected: sel, hovered, onSelect: setSelected, onHover: setHovered, onMethod: setMethod }

  // 지도 위에 떠 있는 조작·통계 덱의 실제 폭(px).
  // 왼쪽 여백 14 + 덱 테두리 2 + 조작부 300 + (칸 사이 선 1 + 통계창 366)
  // + 덱 밖으로 물린 손잡이 25 + 지도와의 간격 14
  const deckW = 14 + 302 + (panelOpen ? 367 : 0) + 25 + 14

  return (
    <div className="shell">
      <Header onTable={() => setTableOpen(true)} />
      <div className="body body-3col" style={{ '--deck': `${deckW}px` }}>
        {/* 조작부 + 통계창 + 손잡이는 테두리 하나·모서리 하나를 함께 쓰는 한 덩어리다.
            따로 놀던 상자 두 개가 맞물린 것처럼 보이지 않게 하기 위한 껍데기. */}
        <div className={`deck${panelOpen ? ' open' : ''}`}>
          <Sidebar
            sector={sector} onSector={setSector}
            method={method} onMethod={setMethod}
            metric={metric} metricKey={metric.key} onMetric={setMetricKey}
            onlyHigh={onlyHigh} onOnlyHigh={setOnlyHigh}
            compare={compare} onCompare={setCompare}
            sido={sido} onSido={setSido}
            selected={sel} onSelect={setSelected}
          />
          {panelOpen && (
            <CenterPanel sector={sector} method={method} metric={metric}
              selectedRow={selectedRow} link={link} />
          )}
        </div>
        {/* 손잡이는 덱 밖으로 물려 나온 책갈피 — 덱과 같은 바탕·테두리를 쓰고
            맞닿는 왼쪽 변만 지워, 덱에서 그대로 뻗어 나온 것처럼 보이게 한다. */}
        <PanelTab open={panelOpen} label="통계" onToggle={() => setPanelOpen(!panelOpen)} />
        {compare
          ? <CompareMaps sector={sector} metricKey={metric.key} onlyHigh={onlyHigh} sido={sido}
              onlyHighToggle={() => setOnlyHigh(!onlyHigh)} {...link} />
          : <NationalMap sector={sector} metric={metric} method={method} onlyHigh={onlyHigh} sido={sido}
              padLeft={deckW} onlyHighToggle={() => setOnlyHigh(!onlyHigh)} {...link} />}
      </div>
      <CursorFx />
      {tableOpen && <DataTable sector={sector} onClose={() => setTableOpen(false)}
        selected={sel} onSelect={setSelected} />}
    </div>
  )
}
