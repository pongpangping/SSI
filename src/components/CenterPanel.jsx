import ReportCard from './ReportCard.jsx'
import MethodCompare from './MethodCompare.jsx'
import MethodDetail from './MethodDetail.jsx'
import StdTransform from './StdTransform.jsx'
import RankFlow from './RankFlow.jsx'
import DistributionCompare from './DistributionCompare.jsx'
import RawIndicators from './RawIndicators.jsx'
import ScatterPlot from './ScatterPlot.jsx'
import SensitivityScatter from './SensitivityScatter.jsx'
import SensitiveList from './SensitiveList.jsx'
import SectorIcon from './SectorIcon.jsx'
import { SECTORS, methodOf, indsOf, N } from '../lib/ssi.js'
import {
  download, dlReport, dlMethods, dlRaw, dlTransform, dlDist, dlRankFlow,
  dlScatter, dlSensScatter, dlSensList, dlAll,
} from '../lib/statscsv.js'

// 카드마다 오른쪽 위에 CSV 단추를 둔다. 화면에서 읽은 값을 그대로 파일로 받을 수
// 있어야 보고서에 옮겨 적을 때 숫자를 다시 세지 않는다.
function Card({ title, sub, dl, dlTip, children }) {
  const save = () => { const f = dl(); if (f) download(f.name, f.text) }
  return (
    <div className="ccard">
      <div className="ccard-head">
        <div className="ccard-title">{title}{sub && <em className="ccard-sub">{sub}</em>}</div>
        {dl && (
          <button className="ccard-dl" onClick={save} title={dlTip || 'CSV로 내려받기'}>
            <span>↓</span>CSV
          </button>
        )}
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

  const one = (fn) => () => (selectedRow ? fn(sector, method, selectedRow) : null)

  return (
    <div className="center">
      {/* 조작부에서 고른 것을 그대로 되짚는 흐름 막대 */}
      <div className="flowbar">
        <div className="fb-steps">
          <span className="fb-step"><i>1</i><b>{name}</b></span>
          <span className="fb-arw">›</span>
          <button className="fb-step fb-btn" onClick={onOpenPicker} title="선택 지표 바꾸기">
            <i>2</i><b><SectorIcon k={sector} state="on" size={13} />{SECTORS[sector].name} · 지표 {inds.length}개{yr && ` · ${yr}`}</b>
          </button>
          <span className="fb-arw">›</span>
          <span className="fb-step"><i>3</i><b>{m.label}</b></span>
          <span className="fb-arw">›</span>
          <span className="fb-step on"><i>4</i><b>{metric.label}</b></span>
        </div>
        <button className="fb-dl" onClick={() => { const f = dlAll(sector, method); download(f.name, f.text) }}
          title={`${SECTORS[sector].name} · ${m.label} 기준 ${N}개 시군구 · 지표 원값과 표준화값, 방법별 CI·순위, 민감도를 한 표로`}>
          ↓ 통계 전체 CSV
        </button>
      </div>

      <Sect k="A" title="선택 지역" plain="시군구 단위 결과">
        <Card title="지역 진단표" sub="원값 · 표준점수(T) · 백분위"
          dl={() => dlReport(sector, method)} dlTip={`${N}개 시군구 진단표 전체`}>
          <ReportCard row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="표준화 방법별 점수와 순위" dl={one(dlMethods)} dlTip="선택 지역의 방법별 점수·순위">
          <MethodCompare row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="선택 지표 원값" sub={yr} dl={one(dlRaw)} dlTip="선택 지역의 지표별 원값·표준화값">
          <RawIndicators row={selectedRow} sector={sector} />
        </Card>
      </Sect>

      <Sect k="B" title="표준화 방법 비교" plain="방법별 점수 · 순위 차이">
        <Card title="선택한 표준화 방법" sub="정의 · 수식 · 범위 · 방법을 바꿨을 때의 변화">
          <MethodDetail sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="계산 과정" sub="원값 → 표준화 → 부문점수 → 순위"
          dl={one(dlTransform)} dlTip="선택 지역의 계산 과정">
          <StdTransform row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="방법별 부문점수 분포" sub="같은 조합 기준"
          dl={() => dlDist(sector)} dlTip={`${N}개 시군구 × 4개 방법 부문점수`}>
          <DistributionCompare sector={sector} selectedRow={selectedRow} method={method} ver={ver} />
        </Card>
        <Card title="방법 간 순위 이동" sub="범프 차트"
          dl={() => dlRankFlow(sector)} dlTip={`${N}개 시군구 × 4개 방법 순위`}>
          <RankFlow sector={sector} selectedRow={selectedRow} onSelect={link.onSelect} ver={ver} />
        </Card>
      </Sect>

      <Sect k="C" title="전국 분포" plain={`${N}개 시군구 기준`}>
        <Card title="지표 간 산점도" sub="가로·세로축 직접 지정"
          dl={() => dlScatter(sector, method, xKey, yKey)} dlTip="지금 축 두 개의 값">
          <ScatterPlot sector={sector} method={method} selected={link.selected}
            onSelect={link.onSelect} xKey={xKey} yKey={yKey} onAxis={onAxis} ver={ver} />
        </Card>
        <Card title="표준화 민감도 산점도" sub="Min-Max 순위 × 백분위순위 순위"
          dl={() => dlSensScatter(sector)} dlTip="두 진영 대표 순위와 순위 이동">
          <SensitivityScatter sector={sector} selected={link.selected} onSelect={link.onSelect} ver={ver} />
        </Card>
        <Card title="순위 이동이 큰 시군구" sub="상위 15곳 표시 · 파일은 전체"
          dl={() => dlSensList(sector)} dlTip={`${N}개 시군구 순위 이동 전체`}>
          <SensitiveList sector={sector} selected={link.selected} onSelect={link.onSelect} ver={ver} />
        </Card>
      </Sect>
    </div>
  )
}
