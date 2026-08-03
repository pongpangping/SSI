import GlossaryModal from './GlossaryModal.jsx'
import SectorIcon from './SectorIcon.jsx'
import { SECTORS } from '../lib/ssi.js'

// 머리줄. 지금 보고 있는 부문을 왼쪽에 띄우고, 그 칸이 곧 시작 화면으로
// 돌아가는 단추다 — 부문을 바꾸는 길이 화면마다 따로 있으면 헷갈린다.
export default function Header({ onTable, sector, onHome }) {
  const s = sector ? SECTORS[sector] : null
  return (
    <header className="header">
      <div className="hd-left">
        <div className="hd-logo">SSI</div>
        <div className="hd-title">국토종합진단지수 · 표준화 방법 민감도 진단</div>
        {s && (
          <button className="hd-sector" onClick={onHome} title="다른 부문 고르기 — 시작 화면으로">
            <SectorIcon k={sector} state="on" size={16} />
            <b>{s.name}</b>
            <u>부문 바꾸기</u>
          </button>
        )}
      </div>
      <div className="hd-right">
        <GlossaryModal />
        <button className="src-btn" onClick={onTable}>▤ 전체 데이터표</button>
      </div>
    </header>
  )
}
