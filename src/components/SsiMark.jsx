// 서비스 표식 — 웹의 이름은 SSI(국토종합진단지수)다.
//
// 머리줄과 시작 화면에 'SAL'이 박혀 있었는데, SAL은 만든 연구실 이름이지
// 이 웹의 이름이 아니다. 만든 곳은 시작 화면 맨 아래 푸터와 보고서 꼬리에
// 남기고, 화면의 표식은 SSI로 통일한다. 탭의 파비콘과 같은 얼굴:
// 파란 그라데이션 네모 + SSI + 아래에 지도 범례를 닮은 세 칸 띠.
export default function SsiMark({ size = 32 }) {
  const font = '"Pretendard Variable", Pretendard, system-ui, -apple-system, "Segoe UI", sans-serif'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="SSI" style={{ display: 'block', flex: 'none' }}>
      <defs>
        <linearGradient id="ssi-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#35A6FF" />
          <stop offset="1" stopColor="#0B5BD3" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#ssi-mark-g)" />
      <text x="32" y="39.5" textAnchor="middle" fontFamily={font} fontSize="24.5"
        fontWeight="800" fill="#fff" letterSpacing="0.4">SSI</text>
      {/* 범례 띠 — 밝음→진함 세 칸, 표준화 지도의 얼굴 */}
      <rect x="17" y="46.5" width="9" height="4.5" rx="2.2" fill="#fff" opacity="0.42" />
      <rect x="27.8" y="46.5" width="9" height="4.5" rx="2.2" fill="#fff" opacity="0.68" />
      <rect x="38.6" y="46.5" width="9" height="4.5" rx="2.2" fill="#fff" opacity="0.95" />
    </svg>
  )
}
