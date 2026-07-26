import { useEffect, useMemo, useState } from 'react'
import { ROWS, metricFor, rowKey, METHOD_KEYS } from './lib/ssi.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import NationalMap from './components/NationalMap.jsx'
import CompareMaps from './components/CompareMaps.jsx'
import CenterPanel, { CenterRail } from './components/CenterPanel.jsx'
import DataTable from './components/DataTable.jsx'

// ── URL 해시 상태 공유 (#s=S1&m=minmax&k=rank&r=경기도|성남시) ──────────────
function parseHash() {
  const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  const o = {}
  if (h.get('s') === 'S1' || h.get('s') === 'S8') o.sector = h.get('s')
  if (METHOD_KEYS.includes(h.get('m'))) o.method = h.get('m')
  if (h.get('k')) o.metricKey = h.get('k')
  if (h.get('r')) o.selected = decodeURIComponent(h.get('r'))
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
  const [panelOpen, setPanelOpen] = useState(init.panelOpen !== false)
  const [onlyHigh, setOnlyHigh] = useState(false)
  const [selected, setSelected] = useState(init.selected || null)
  const [hovered, setHovered] = useState(null)
  const [tableOpen, setTableOpen] = useState(false)

  const metric = metricFor(sector, method, metricKey)
  const byKey = useMemo(() => Object.fromEntries(ROWS.map((r) => [rowKey(r), r])), [])

  // 기본 선택: 부문 내 SSI_camp 최상위
  const topKey = useMemo(() => {
    const r = [...ROWS].sort((a, b) => (b[sector].ssiCamp || 0) - (a[sector].ssiCamp || 0))[0]
    return r ? rowKey(r) : null
  }, [sector])
  const sel = (selected && byKey[selected]) ? selected : topKey
  const selectedRow = byKey[sel]

  useEffect(() => {
    const p = new URLSearchParams()
    p.set('s', sector); p.set('m', method); p.set('k', metric.key)
    if (sel) p.set('r', encodeURIComponent(sel))
    if (compare) p.set('c', '1')
    if (!panelOpen) p.set('p', '0')
    window.history.replaceState(null, '', `#${p.toString()}`)
  }, [sector, method, metric.key, sel, compare, panelOpen])

  const link = { selected: sel, hovered, onSelect: setSelected, onHover: setHovered, onMethod: setMethod }

  return (
    <div className="shell">
      <Header sector={sector} method={method} onTable={() => setTableOpen(true)} />
      <div className="body body-3col">
        <Sidebar
          sector={sector} onSector={setSector}
          method={method} onMethod={setMethod}
          metric={metric} metricKey={metric.key} onMetric={setMetricKey}
          onlyHigh={onlyHigh} onOnlyHigh={setOnlyHigh}
          compare={compare} onCompare={setCompare}
          panelOpen={panelOpen} onPanelOpen={setPanelOpen}
        />
        {panelOpen
          ? <CenterPanel sector={sector} method={method} metric={metric}
              selectedRow={selectedRow} link={link} onCollapse={() => setPanelOpen(false)} />
          : <CenterRail selectedRow={selectedRow} onOpen={() => setPanelOpen(true)} />}
        {compare
          ? <CompareMaps sector={sector} metricKey={metric.key} onlyHigh={onlyHigh} {...link} />
          : <NationalMap sector={sector} metric={metric} method={method} onlyHigh={onlyHigh} {...link} />}
      </div>
      {tableOpen && <DataTable sector={sector} onClose={() => setTableOpen(false)}
        selected={sel} onSelect={setSelected} />}
    </div>
  )
}
