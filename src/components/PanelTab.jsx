// 통계창 접기·펴기 손잡이 — 덱(조작부+통계창) 오른쪽 위에 물려 나온 책갈피.
// 덱과 같은 바탕·테두리를 쓰고 맞닿는 왼쪽 변만 지워, 덱에서 뻗어 나온 것처럼 읽힌다.
// 밖으로 나와 있어 눈에 바로 띄고, 접혀 있든 펼쳐져 있든 같은 자리에 남는다.
// 위쪽 화살표가 방향(접기 ‹ / 펼치기 ›)을, 아래 세로 글자가 대상(통계)을 말한다.
export default function PanelTab({ open, label, onToggle }) {
  return (
    <button className={`ptab${open ? ' open' : ''}`} onClick={onToggle}
      title={`${label} ${open ? '접기' : '펼치기'}`}
      aria-expanded={open} aria-label={`${label} 패널 ${open ? '접기' : '펼치기'}`}>
      <span className="ptab-ar">{open ? '‹' : '›'}</span>
      <span className="ptab-tx">{label}</span>
    </button>
  )
}
