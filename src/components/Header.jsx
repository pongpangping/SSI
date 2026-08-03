import GlossaryModal from './GlossaryModal.jsx'
import DataDefsModal from './DataDefsModal.jsx'
import SectorIcon from './SectorIcon.jsx'
import { SECTORS } from '../lib/ssi.js'

// 머리줄. 지금 보고 있는 부문을 왼쪽에 띄우고, 그 칸이 곧 시작 화면으로
// 돌아가는 단추다 — 부문을 바꾸는 길이 화면마다 따로 있으면 헷갈린다.
//
// 오른쪽에는 '어느 지점에서 보든 똑같이 필요한 참고 자료' 셋을 나란히 둔다.
//   데이터 설명   지금 고른 지표의 정의 · 산식 · 출처
//   용어 · 방법론  용어 사전 · 4개 표준화 방법 · 32개 지표 전체 사전
//   전체 데이터표  229개 시군구 × 모든 열
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
        {s && <DataDefsModal sector={sector} />}
        <GlossaryModal />
        <button className="src-btn" onClick={onTable}>▤ 전체 데이터표</button>
      </div>
    </header>
  )
}
