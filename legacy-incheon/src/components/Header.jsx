import { useState } from 'react'
import { pct } from '../lib/format.js'
import DataSourceModal from './DataSourceModal.jsx'

export default function Header({ summary }) {
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href) }
    catch (e) { /* noop */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <header className="header">
      <div className="hd-left">
        <div className="hd-logo">인천</div>
        <div className="hd-title">
          인천광역시 1인가구 · 세대구조
          <small>KOSIS 인구총조사(2023) · 행정안전부 주민등록(2025) 외</small>
        </div>
        <DataSourceModal />
        <button className="src-btn" onClick={copyLink}>{copied ? '✓ 복사됨' : '🔗 링크 복사'}</button>
      </div>
      <div className="hd-right">
        <div className="hd-chips">
          <span className="hd-chip">1인가구<b>{pct(summary.onePersonRate)}</b></span>
          <span className="hd-chip">세대당 인구<b>{summary.avgHouseholdSize}명</b></span>
          <span className="hd-chip">고령 1인가구<b>{pct(summary.agedOneShareOfOne)}</b></span>
        </div>
      </div>
    </header>
  )
}
