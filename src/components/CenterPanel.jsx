import ReportCard from './ReportCard.jsx'
import MethodCompare from './MethodCompare.jsx'
import StdTransform from './StdTransform.jsx'
import RankFlow from './RankFlow.jsx'
import DistributionCompare from './DistributionCompare.jsx'
import RawIndicators from './RawIndicators.jsx'
import ScatterPlot from './ScatterPlot.jsx'
import SensitivityScatter from './SensitivityScatter.jsx'
import SensitiveList from './SensitiveList.jsx'
import { SECTORS, methodOf, indsOf, N } from '../lib/ssi.js'

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

// A·B·C 3단 흐름. 조작부(1~3단계)에서 고른 것이 여기서 순서대로 풀린다.
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

export default function CenterPanel({
  sector, method, metric, selectedRow, link, ver = 0,
  xKey, yKey, onAxis, onOpenPicker,
}) {
  const m = methodOf(method)
  const name = selectedRow ? `${selectedRow.sido} ${selectedRow.name}` : '—'
  const inds = indsOf(sector)

  const years = []
  inds.forEach((e) => { if (!years.includes(e.year)) years.push(e.year) })
  years.sort()
  const yr = years.length === 1 ? `${years[0]}년` : years.length > 1 ? `${years[0]}~${years[years.length - 1]}년` : ''

  return (
    <div className="center">
      {/* 조작부에서 고른 것을 그대로 되짚는 흐름 막대 */}
      <div className="flowbar">
        <div className="fb-steps">
          <span className="fb-step"><i>1</i><b>{name}</b></span>
          <span className="fb-arw">›</span>
          <button className="fb-step fb-btn" onClick={onOpenPicker} title="담은 지표 바꾸기">
            <i>2</i><b>{SECTORS[sector].name} · 지표 {inds.length}개{yr && ` · ${yr}`}</b>
          </button>
          <span className="fb-arw">›</span>
          <span className="fb-step"><i>3</i><b>{m.label}</b></span>
          <span className="fb-arw">›</span>
          <span className="fb-step on"><i>4</i><b>{metric.label}</b></span>
        </div>
      </div>

      <Sect k="A" title="선택 지역" plain="시군구 단위 결과">
        <Card title="성적표" sub="원값 · 표준점수(T) · 백분위">
          <ReportCard row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="표준화 방법별 점수와 순위">
          <MethodCompare row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="담은 지표의 원값" sub={yr}>
          <RawIndicators row={selectedRow} sector={sector} />
        </Card>
      </Sect>

      <Sect k="B" title="표준화 방법 비교" plain="방법별 점수 · 순위 차이">
        <Card title="계산 과정" sub="원값 → 표준화 → 부문점수 → 순위">
          <StdTransform row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="방법별 부문점수 분포" sub="같은 조합 기준">
          <DistributionCompare sector={sector} selectedRow={selectedRow} method={method} ver={ver} />
        </Card>
        <Card title="방법 간 순위 이동" sub="범프 차트">
          <RankFlow sector={sector} selectedRow={selectedRow} onSelect={link.onSelect} ver={ver} />
        </Card>
      </Sect>

      <Sect k="C" title="전국 분포" plain={`${N}개 시군구 기준`}>
        <Card title="두 값 견주어 보기" sub="축을 직접 고르는 산점도">
          <ScatterPlot sector={sector} method={method} selected={link.selected}
            onSelect={link.onSelect} xKey={xKey} yKey={yKey} onAxis={onAxis} ver={ver} />
        </Card>
        <Card title="민감도 산점도" sub="Min-Max 순위 × 백분위순위 순위">
          <SensitivityScatter sector={sector} selected={link.selected} onSelect={link.onSelect} ver={ver} />
        </Card>
        <Card title="순위 이동이 큰 시군구">
          <SensitiveList sector={sector} selected={link.selected} onSelect={link.onSelect} ver={ver} />
        </Card>
      </Sect>
    </div>
  )
}
