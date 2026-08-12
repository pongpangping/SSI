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

// ── 화면 공통 표식 세트 확장 — 글꼴 문자(⬇ ▤ ⓘ ↺ ⤢ ＋ －)를 도형으로 통일 ──

// 내려받기 — 아래 화살표 + 받침.
export function Download({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl gl-dl ${className}`.trim()}>
      <path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 13h10" />
    </svg>
  )
}

// 데이터표 — 줄이 그어진 표.
export function Grid({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl gl-grid ${className}`.trim()}>
      <rect x="2.2" y="3" width="11.6" height="10" rx="1.2" />
      <path d="M2.2 6.4h11.6M6.4 6.4v6.6" />
    </svg>
  )
}

// 정의·설명 문서 — 글줄이 있는 낱장.
export function Doc({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl gl-doc ${className}`.trim()}>
      <rect x="3" y="2.2" width="10" height="11.6" rx="1.2" />
      <path d="M5.4 5.4h5.2M5.4 8h5.2M5.4 10.6h3.4" />
    </svg>
  )
}

// 안내 — 동그라미 i.
export function Info({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl gl-info ${className}`.trim()}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2v3.6" />
      <path d="M8 4.9v.2" strokeWidth="2.2" />
    </svg>
  )
}

// 확대·축소 — 십자와 가로줄.
export function Plus({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl ${className}`.trim()}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}
export function Minus({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl ${className}`.trim()}>
      <path d="M3 8h10" />
    </svg>
  )
}

// 처음으로 — 반시계 화살 고리.
export function Reset({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl ${className}`.trim()}>
      <path d="M3.2 6.2A5.3 5.3 0 1 1 2.7 9.5" />
      <path d="M3 2.6v3.8h3.8" />
    </svg>
  )
}

// 선택 지역 확대 — 바깥으로 뻗는 두 화살.
export function Expand({ size = 12, className = '' }) {
  return (
    <svg {...box(size)} className={`gl ${className}`.trim()}>
      <path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" />
    </svg>
  )
}
