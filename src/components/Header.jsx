import { SECTORS, sectorSummary, methodOf, META } from '../lib/ssi.js'
import GlossaryModal from './GlossaryModal.jsx'

export default function Header({ sector, method, onTable }) {
  const s = sectorSummary(sector)
  const m = methodOf(method)
  return (
    <header className="header">
      <div className="hd-left">
        <div className="hd-logo">SSI</div>
        <div className="hd-title">
          국토종합진단지수 · 표준화 방법 민감도 진단
          <small>전국 {META.n}개 시군구 · 부문지수(CI) 4개 표준화 방법 비교 · 파일럿(S1·S8)</small>
        </div>
        <GlossaryModal />
        <button className="src-btn" onClick={onTable}>▤ 전체 데이터표 (40개 컬럼)</button>
      </div>
      <div className="hd-right">
        <div className="hd-chips">
          <span className="hd-chip">부문<b>{SECTORS[sector].name}</b></span>
          <span className="hd-chip" style={{ borderColor: m.camp === '순위전용형' ? '#F5760D' : '#0B93EE' }}>
            표준화<b>{m.label}</b>
          </span>
          <span className="hd-chip">SSI_camp 평균<b>{s.avg.toFixed(1)}계단</b></span>
          <span className="hd-chip">최대<b>{s.max}계단</b></span>
          <span className="hd-chip hd-chip-warn">민감(high)<b>{s.high}개</b></span>
        </div>
      </div>
    </header>
  )
}
