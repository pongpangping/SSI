// 통계 패널 손잡이 — 지도 왼쪽 모서리에 붙어 있는 세로 탭.
// 접혀 있든 펼쳐져 있든 같은 자리에 남아 있어서 "닫았더니 여는 법을 모르겠다"가 없다.
// 위쪽 화살표가 방향(접기 ‹ / 펼치기 ›)을, 아래 세로 글자가 대상(통계)을 말한다.
export default function PanelTab({ open, label, onToggle }) {
  return (
    <button className={`ptab${open ? ' open' : ''}`} onClick={onToggle}
      title={`${label} 패널 ${open ? '접기' : '펼치기'}`}
      aria-expanded={open} aria-label={`${label} 패널 ${open ? '접기' : '펼치기'}`}>
      <span className="ptab-ar">{open ? '‹' : '›'}</span>
      <span className="ptab-tx">{label}</span>
    </button>
  )
}
