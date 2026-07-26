import GlossaryModal from './GlossaryModal.jsx'

export default function Header({ onTable }) {
  return (
    <header className="header">
      <div className="hd-left">
        <div className="hd-logo">SSI</div>
        <div className="hd-title">국토종합진단지수 · 표준화 방법 민감도 진단</div>
      </div>
      <div className="hd-right">
        <GlossaryModal />
        <button className="src-btn" onClick={onTable}>▤ 전체 데이터표</button>
      </div>
    </header>
  )
}
