import MethodCompare from './MethodCompare.jsx'
import StdTransform from './StdTransform.jsx'
import RankFlow from './RankFlow.jsx'
import DistributionCompare from './DistributionCompare.jsx'
import RawIndicators from './RawIndicators.jsx'
import SensitivityScatter from './SensitivityScatter.jsx'
import SensitiveList from './SensitiveList.jsx'
import { SECTORS, methodOf } from '../lib/ssi.js'

function Card({ title, sub, children }) {
  return (
    <div className="ccard">
      <div className="ccard-head">
        <div className="ccard-title">{title}{sub && <em className="ccard-sub">{sub}</em>}</div>
      </div>
      {children}
    </div>
  )
}

// A·B·C 3단 흐름. 조작부(1~5단계)에서 고른 것이 여기서 순서대로 풀린다.
function Sect({ k, title, plain, children }) {
  return (
    <section className="csect">
      <div className="csect-head">
        <span className="csect-k">{k}</span>
        <span className="csect-t">{title}<em>{plain}</em></span>
      </div>
      {children}
    </section>
  )
}

// 접힘 상태 — 세로 글씨 없이 지도 왼쪽에 붙는 얇은 손잡이.
export function CenterRail({ onOpen }) {
  return (
    <button className="panel-tab" onClick={onOpen}
      title="판독창 펼치기" aria-label="판독창 펼치기">
      <span className="pt-ico">›</span>
      <span className="pt-bar" />
    </button>
  )
}

export default function CenterPanel({ sector, method, metric, selectedRow, link, onCollapse }) {
  const m = methodOf(method)
  const name = selectedRow ? `${selectedRow.sido} ${selectedRow.name}` : '—'

  return (
    <div className="center">
      {/* 조작부 1~4단계를 그대로 되짚는 흐름 막대 */}
      <div className="flowbar">
        <div className="fb-steps">
          <span className="fb-step"><i>1</i><b>{name}</b></span>
          <span className="fb-arw">›</span>
          <span className="fb-step"><i>2</i><b>{SECTORS[sector].name}</b></span>
          <span className="fb-arw">›</span>
          <span className="fb-step"><i>3</i><b>{m.label}</b></span>
          <span className="fb-arw">›</span>
          <span className="fb-step on"><i>4</i><b>{metric.label}</b></span>
        </div>
        {onCollapse && (
          <button className="center-collapse" title="판독창 접기 — 지도를 넓게 봅니다"
            aria-label="판독창 접기" onClick={onCollapse}>‹</button>
        )}
      </div>

      <Sect k="A" title="이 지역은 어떤가" plain="선택한 시군구">
        <Card title="표준화 방법별 점수와 순위">
          <MethodCompare row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="부문 안의 원자료 지표">
          <RawIndicators row={selectedRow} sector={sector} />
        </Card>
      </Sect>

      <Sect k="B" title="방법이 만든 차이" plain="왜 순위가 흔들리나">
        <Card title="계산 과정" sub="원자료 → 표준화 → CI → 순위">
          <StdTransform row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="같은 자료, 다른 모양" sub="방법별 CI 분포">
          <DistributionCompare sector={sector} selectedRow={selectedRow} method={method} />
        </Card>
        <Card title="방법을 바꿀 때 순위 이동" sub="범프 차트">
          <RankFlow sector={sector} selectedRow={selectedRow} onSelect={link.onSelect} />
        </Card>
      </Sect>

      <Sect k="C" title="전국 속 위치" plain="229개 시군구 안에서">
        <Card title="민감도 산점도" sub="MinMax 순위 × 백분위순위 순위">
          <SensitivityScatter sector={sector} selected={link.selected} onSelect={link.onSelect} />
        </Card>
        <Card title="순위 이동이 큰 시군구">
          <SensitiveList sector={sector} selected={link.selected} onSelect={link.onSelect} />
        </Card>
      </Sect>
    </div>
  )
}
