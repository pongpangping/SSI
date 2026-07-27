// 통계창 접기·펴기 — 덱(조작부+통계창)의 오른쪽 위 '안쪽'에 눕혀 놓은 버튼.
// 밖으로 튀어나오지 않고 덱 테두리 안에 들어가 있어서 덧붙인 혹처럼 보이지 않는다.
// 펼쳐져 있을 땐 통계창 머리(흐름 막대)의 오른쪽 끝, 접혀 있을 땐 조작부 머리의 오른쪽 끝.
// 어느 쪽이든 같은 자리·같은 모양이라 "닫았더니 여는 법을 모르겠다"가 없다.
export default function PanelTab({ open, label, onToggle }) {
  return (
    <button className={`ptab${open ? ' open' : ''}`} onClick={onToggle}
      title={`${label} ${open ? '접기' : '펼치기'}`}
      aria-expanded={open} aria-label={`${label} 패널 ${open ? '접기' : '펼치기'}`}>
      <span className="ptab-tx">{label}</span>
      <span className="ptab-ar">{open ? '‹' : '›'}</span>
    </button>
  )
}
