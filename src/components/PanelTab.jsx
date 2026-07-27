// 패널 손잡이 — 열림/닫힘 상태와 무관하게 같은 자리에 남아 있는 세로 탭.
// 손잡이가 사라지지 않으므로 "접었더니 여는 법을 모르겠다"가 생기지 않는다.
// (AR6 기후 시나리오 화면의 패널 탭 방식을 참고, 라벨과 방향만 이 화면에 맞춤)
export default function PanelTab({ open, label, onToggle, side = 'left' }) {
  const arrow = open ? (side === 'left' ? '‹' : '›') : (side === 'left' ? '›' : '‹')
  return (
    <button className={`ptab${open ? ' open' : ''}`} onClick={onToggle}
      title={`${label} ${open ? '접기' : '펼치기'}`}
      aria-expanded={open} aria-label={`${label} ${open ? '접기' : '펼치기'}`}>
      <span className="ptab-ar">{arrow}</span>
      <span className="ptab-tx">{label}</span>
    </button>
  )
}
