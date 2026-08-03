// 화면 구조를 알려 주는 표식 모음.
//
// 여닫기 표시와 연동 표시를 글꼴 문자(− + ◆ ◎)로 찍어 두었더니, 그 문자가 없는
// 글꼴이 걸린 환경에서 빈 네모로 나왔다. 뜻을 나르는 표식이 깨지면 그 칸이
// 무엇을 하는 칸인지 알 수 없다. 그래서 도형으로 직접 그린다.
//
// 색은 currentColor를 쓴다. 붙는 자리의 글자색을 그대로 따라가므로,
// 켜짐·꺼짐·흐림 같은 상태를 표식이 따로 알 필요가 없다.

const box = (size) => ({
  width: size, height: size, viewBox: '0 0 16 16',
  fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  focusable: 'false', 'aria-hidden': 'true',
})

// 펼침·접힘 — 아래를 가리키면 펼쳐진 상태, 오른쪽을 가리키면 접힌 상태.
export function Chevron({ open, size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl gl-chev${open ? ' on' : ''} ${className}`.trim()}>
      {open
        ? <path d="M3.5 6 8 10.5 12.5 6" />
        : <path d="M6 3.5 10.5 8 6 12.5" />}
    </svg>
  )
}

// 묶음 여닫기 — 더하기와 빼기. 예전 − + 문자를 대신한다.
export function PlusMinus({ open, size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl gl-pm${open ? ' on' : ''} ${className}`.trim()}>
      <path d="M3.5 8h9" />
      {!open && <path d="M8 3.5v9" />}
    </svg>
  )
}

// 표준화 방법을 바꾸면 지도가 함께 바뀌는 항목. 예전 ◆ 문자를 대신한다.
export function Diamond({ size = 9, className = '', title }) {
  return (
    <svg {...box(size)} className={`gl gl-dia ${className}`.trim()} fill="currentColor" strokeWidth={0}>
      {title && <title>{title}</title>}
      <path d="M8 1.6 14.4 8 8 14.4 1.6 8Z" />
    </svg>
  )
}

// 지금 보고 있는 자리 표시.
export function Dot({ size = 8, className = '' }) {
  return (
    <svg {...box(size)} className={`gl gl-dot ${className}`.trim()} fill="currentColor" strokeWidth={0}>
      <circle cx="8" cy="8" r="4.2" />
    </svg>
  )
}

// 닫기 — 예전 ✕ 문자를 대신한다. 글꼴에 따라 굵기가 제각각이던 자리다.
export function Cross({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl gl-x ${className}`.trim()}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

export default Chevron
