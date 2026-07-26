import MethodCompare from './MethodCompare.jsx'
import StdTransform from './StdTransform.jsx'
import RankFlow from './RankFlow.jsx'
import DistributionCompare from './DistributionCompare.jsx'
import RawIndicators from './RawIndicators.jsx'
import SensitivityScatter from './SensitivityScatter.jsx'
import SensitiveList from './SensitiveList.jsx'
import { SECTORS, methodOf } from '../lib/ssi.js'

function Card({ n, title, sub, children }) {
  return (
    <div className="ccard">
      <div className="ccard-head">
        <div className="ccard-num">{n}</div>
        <div className="ccard-title">{title}{sub && <em className="ccard-sub">{sub}</em>}</div>
      </div>
      {children}
    </div>
  )
}

// 접힘 상태의 34px 세로 레일. 선택 지역이 바뀌면 라벨만 갱신되고,
// 지도 클릭으로 자동 펼침은 하지 않는다 (명세 §5, 원칙 P4).
export function CenterRail({ selectedRow, onOpen }) {
  const name = selectedRow ? `${selectedRow.sido} ${selectedRow.name}` : '선택 없음'
  return (
    <div className="center-rail" role="button" tabIndex={0} title="통계창 펼치기"
      onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}>
      <button className="cr-btn" aria-label="통계창 펼치기" onClick={(e) => { e.stopPropagation(); onOpen() }}>›</button>
      <div className="cr-label"><b>{name}</b></div>
      <div className="cr-tag">통계창</div>
    </div>
  )
}

export default function CenterPanel({ sector, method, metric, selectedRow, link, onCollapse }) {
  const m = methodOf(method)
  return (
    <div className="center">
      <div className="breadcrumb">
        <span className="bc-txt">
          선택<b>{selectedRow ? `${selectedRow.sido} ${selectedRow.name}` : '—'}</b>
          · 부문<b>{SECTORS[sector].name}</b>
          · 표준화<b>{m.label}</b>
          · 지도<b>{metric.label}</b>
        </span>
        {onCollapse && (
          <button className="center-collapse" title="통계창 접기 — 지도를 넓게 봅니다"
            aria-label="통계창 접기" onClick={onCollapse}>‹</button>
        )}
      </div>

      <Card n="1" title="선택 시군구 · 표준화 방법별 결과" sub="왜 민감한가">
        <MethodCompare row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
      </Card>

      <Card n="2" title="표준화 계산 과정" sub="원자료 → 표준화 → CI → 순위">
        <StdTransform row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
      </Card>

      <Card n="3" title="방법 간 순위 이동" sub="범프 차트">
        <RankFlow sector={sector} selectedRow={selectedRow} onSelect={link.onSelect} />
      </Card>

      <Card n="4" title="표준화 방법별 CI 분포" sub="같은 자료, 다른 모양">
        <DistributionCompare sector={sector} selectedRow={selectedRow} method={method} />
      </Card>

      <Card n="5" title="부문 내 원자료 지표">
        <RawIndicators row={selectedRow} sector={sector} />
      </Card>

      <Card n="6" title="전국 민감도 산점도" sub="MinMax순위 × PctRank순위">
        <SensitivityScatter sector={sector} selected={link.selected} onSelect={link.onSelect} />
      </Card>

      <Card n="7" title="민감도 상위 시군구">
        <SensitiveList sector={sector} selected={link.selected} onSelect={link.onSelect} />
      </Card>
    </div>
  )
}
