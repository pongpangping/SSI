import { Chevron } from './Glyph.jsx'

// 서랍 — 접었다 펴는 칸.
//
// 통계창에 있던 탭 세 개를 없애면서 생긴 자리다. 탭은 세 가지를 같은 무게로
// 늘어놓는 장치인데, 이 화면에서 부문 종합과 표준화 민감도와 원데이터는 같은
// 무게가 아니다. 주가 되는 것은 본문으로 펼쳐 두고, 나머지 둘은 서랍에 접어
// 아래에 둔다. 순서와 생김새가 곧 우선순위가 된다.
//
// 본문 머리와 서랍 머리는 일부러 다르게 그린다. 본문 머리는 굵은 제목에 밑줄,
// 서랍 머리는 회색 띠에 펼침 표식이다. 같은 모양이면 다시 위계가 사라진다.
export default function Drawer({ id, title, plain, count, open, onToggle, children }) {
  return (
    <section className={`drw${open ? ' open' : ''}`} data-drw={id}>
      <button
        type="button"
        className="drw-head"
        aria-expanded={open}
        aria-controls={`drw-${id}`}
        onClick={() => onToggle(!open)}
      >
        <Chevron open={open} size={13} />
        <span className="drw-t">{title}</span>
        {plain && <em className="drw-p">{plain}</em>}
        {count != null && <u className="drw-n">{count}</u>}
        <span className="drw-act">{open ? '접기' : '펼치기'}</span>
      </button>
      {open && <div className="drw-body" id={`drw-${id}`}>{children}</div>}
    </section>
  )
}
