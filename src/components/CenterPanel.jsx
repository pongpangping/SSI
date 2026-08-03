import { useRef } from 'react'
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
import NationalSummary from './NationalSummary.jsx'
import IndicatorDefs from './IndicatorDefs.jsx'
import SectorIcon from './SectorIcon.jsx'
import DlMenu from './DlMenu.jsx'
import { SECTORS, methodOf, indsOf, N } from '../lib/ssi.js'
import {
  dlReport, dlMethods, dlRaw, dlTransform, dlDist, dlRankFlow,
  dlScatter, dlSensScatter, dlSensList, dlAll,
  dlDistribution, dlTopBottom, dlBySido, dlContribution, dlSummaryAll,
  dlIndicatorDefs, dlRawAll,
} from '../lib/statscsv.js'

// 통계창.
//
// 예전에는 A(선택 지역) · B(표준화 방법) · C(전국 분포) 세 단이 위에서 아래로
// 죽 이어져 있었다. 전부 같은 무게로 놓여 있으니 '이 부문의 결과'와 '방법을
// 바꿨을 때의 흔들림'과 '지표 원값'이 구분되지 않고, 정작 먼저 봐야 할 부문
// 종합이 스크롤 중간에 묻혔다.
//
// 그래서 세 칸으로 나눴다.
//   부문 종합    전국 요약이 먼저. 지도에서 고른 곳이 있으면 그 아래 붙는다.
//   표준화 민감도 방법을 바꾸면 순위가 어떻게 달라지는가 — 이 도구의 본론이지만
//                결과를 보러 온 사람에게는 두 번째 이야기다.
//   원데이터     지표가 무엇이고 원래 값이 얼마였는가.
//
// 칸을 옮겨도 고른 것(부문·지표·방법·선택 지역)은 그대로다. 보는 각도만 바뀐다.

function Card({ title, sub, dl, dlTip, children }) {
  const body = useRef(null)
  return (
    <div className="ccard">
      <div className="ccard-head">
        <div className="ccard-title">{title}{sub && <em className="ccard-sub">{sub}</em>}</div>
        {dl && <DlMenu pack={dl} elRef={body} tip={dlTip} />}
      </div>
      <div className="ccard-body" ref={body}>{children}</div>
    </div>
  )
}

function Sect({ title, plain, children }) {
  return (
    <section className="csect">
      <div className="csect-head">
        <span className="csect-t">{title}<em>{plain}</em></span>
      </div>
      {children}
    </section>
  )
}

const TABS = [
  { k: 'sum', label: '부문 종합', hint: '전국 요약과 선택 지역 결과' },
  { k: 'sens', label: '표준화 민감도', hint: '방법을 바꾸면 순위가 얼마나 흔들리는가' },
  { k: 'raw', label: '원데이터', hint: '지표 정의와 원래 값' },
]

export default function CenterPanel({
  sector, method, metric, selectedRow, link, ver = 0,
  xKey, yKey, onAxis, onOpenPicker, tab = 'sum', onTab,
}) {
  const m = methodOf(method)
  const name = selectedRow ? `${selectedRow.sido} ${selectedRow.name}` : null
  const inds = indsOf(sector)

  const years = []
  inds.forEach((e) => { if (!years.includes(e.year)) years.push(e.year) })
  years.sort()
  const yr = years.length === 1 ? `${years[0]}년` : years.length > 1 ? `${years[0]}~${years[years.length - 1]}년` : ''

  const one = (fn) => () => (selectedRow ? fn(sector, method, selectedRow) : null)

  // 전국 요약 네 칸의 내려받기. 이쪽은 recharts가 아니라 직접 그린 막대라
  // elRef를 넘기지 않는다 — PNG는 값에서 표를 다시 그리는 쪽으로 간다.
  const NS_DL = {
    dist: [() => dlDistribution(sector, method), '구간별 시군구 수와 요약 통계'],
    tb: [() => dlTopBottom(sector, method), '상위·하위 열 곳'],
    sido: [() => dlBySido(sector, method), '17개 시도 평균·범위'],
    con: [() => dlContribution(sector, method), '지표별 평균·편차·상관·몫'],
  }
  const nsDl = (k) => {
    const [pack, tip] = NS_DL[k]
    return <DlMenu pack={pack} tip={tip} cls="ccard-dl" />
  }

  // 지도에서 고르기 전에는 지역 카드를 아예 그리지 않는다. 빈 카드 세 장이
  // '시군구를 선택하세요'만 띄우고 있으면, 아직 덜 된 화면처럼 보인다.
  const RegionCards = () => (
    !selectedRow ? (
      <div className="csect-wait">
        <b>지도에서 시군구를 클릭하면 이 자리에 나옵니다</b>
        <span>지역 진단표 · 표준화 방법별 점수와 순위 · 계산 과정</span>
      </div>
    ) : (
      <>
        <Card title="지역 진단표" sub="원값 · 표준점수(T) · 백분위"
          dl={() => dlReport(sector, method)} dlTip={`${N}개 시군구 진단표 전체`}>
          <ReportCard row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="표준화 방법별 점수와 순위" dl={one(dlMethods)} dlTip="선택 지역의 방법별 점수·순위">
          <MethodCompare row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
        <Card title="계산 과정" sub="원값 → 표준화 → 부문점수 → 순위"
          dl={one(dlTransform)} dlTip="선택 지역의 계산 과정">
          <StdTransform row={selectedRow} sector={sector} method={method} onMethod={link.onMethod} />
        </Card>
      </>
    )
  )

  return (
    <div className="center">
      {/* 지금 무엇을 보고 있는지 되짚는 줄. 꼭 골라야 하는 것(지표·표준화 방법)만
          번호를 달고, 없어도 화면이 나오는 것(지도 색 기준·선택 지역)은 번호 없이
          옆에 둔다. 번호가 붙은 칸이 곧 '해야 하는 일'이다. */}
      <div className="flowbar">
        <div className="fb-steps">
          <button className="fb-step fb-btn" onClick={onOpenPicker} title="선택 지표 바꾸기">
            <i>1</i><b><SectorIcon k={sector} state="on" size={13} />지표 {inds.length}개{yr && ` · ${yr}`}</b>
          </button>
          <span className="fb-step"><i>2</i><b>{m.label}</b></span>
          <span className="fb-step fb-opt"><b>{metric.label}</b><u>지도 색</u></span>
          {name && <span className="fb-step fb-opt fb-sel"><b>{name}</b><u>선택 지역</u></span>}
        </div>
        <div className="fb-dlrow">
          <span className="fb-dlab">통계 전체</span>
          <DlMenu
            cls="fb-dl"
            label="내려받기"
            wide
            pack={() => dlAll(sector, method)}
            tip={`${SECTORS[sector].name} · ${m.label} 기준 ${N}개 시군구 · 지표 원값과 표준화값, 방법별 CI·순위, 민감도를 한 표로`}
          />
        </div>
      </div>

      <div className="ctabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.k} role="tab" aria-selected={tab === t.k} title={t.hint}
            className={`ctab${tab === t.k ? ' on' : ''}${t.k === 'sum' ? ' main' : ''}`}
            onClick={() => onTab && onTab(t.k)}>
            <b>{t.label}</b><em>{t.hint}</em>
          </button>
        ))}
      </div>

      {tab === 'sum' && (
        <>
          <NationalSummary sector={sector} method={method} selected={link.selected}
            selectedRow={selectedRow} onSelect={link.onSelect} ver={ver} dlOf={nsDl} />
          <div className="nsum-all">
            <span>전국 요약 네 칸을 한 파일로</span>
            <DlMenu cls="fb-dl" label="내려받기" wide
              pack={() => dlSummaryAll(sector, method)}
              tip="분포 요약 · 상위·하위 · 시도별 평균 · 지표별 기여도" />
          </div>
          <Sect title="선택 지역" plain="지도에서 고른 시군구 하나">
            <RegionCards />
          </Sect>
        </>
      )}

      {tab === 'sens' && (
        <Sect title="표준화 민감도" plain="같은 자료를 다른 방법으로 표준화하면">
          <Card title="선택한 표준화 방법" sub="정의 · 수식 · 범위 · 방법을 바꿨을 때의 변화">
            <MethodDetail sector={sector} method={method} onMethod={link.onMethod} />
          </Card>
          <Card title="방법별 부문점수 분포" sub="같은 조합 기준"
            dl={() => dlDist(sector)} dlTip={`${N}개 시군구 × 4개 방법 부문점수`}>
            <DistributionCompare sector={sector} selectedRow={selectedRow} method={method} ver={ver} />
          </Card>
          <Card title="방법 간 순위 이동" sub="범프 차트"
            dl={() => dlRankFlow(sector)} dlTip={`${N}개 시군구 × 4개 방법 순위`}>
            <RankFlow sector={sector} selectedRow={selectedRow} onSelect={link.onSelect} ver={ver} />
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
      )}

      {tab === 'raw' && (
        <Sect title="원데이터" plain="표준화하기 전의 값">
          <Card title="선택 지표 설명" sub={`${inds.length}개 · ${yr}`}
            dl={() => dlIndicatorDefs(sector)} dlTip="지표 정의 · 산식 · 출처">
            <IndicatorDefs sector={sector} />
          </Card>
          <Card title="선택 지역 지표 원값" sub={yr}
            dl={one(dlRaw)} dlTip="선택 지역의 지표별 원값·표준화값">
            {selectedRow
              ? <RawIndicators row={selectedRow} sector={sector} />
              : <div className="csect-wait sm">
                <b>지도에서 시군구를 클릭하면 이 자리에 나옵니다</b>
                <span>고른 곳의 지표 원값과 전국 대비 위치</span>
              </div>}
          </Card>
          <Card title="전국 지표 원값" sub={`${N}개 시군구 × 지표 ${inds.length}개`}
            dl={() => dlRawAll(sector, method)} dlTip="전국 원값·표준화값 표">
            <div className="ns-say">
              화면에 다 담기에는 표가 큽니다. 오른쪽 위 내려받기로 CSV·Excel 파일을 받으세요.
              머리줄의 <b>전체 데이터표</b>에서도 같은 값을 볼 수 있습니다.
            </div>
          </Card>
          <Card title="지표 간 산점도" sub="가로·세로축 직접 지정"
            dl={() => dlScatter(sector, method, xKey, yKey)} dlTip="지금 축 두 개의 값">
            <ScatterPlot sector={sector} method={method} selected={link.selected}
              onSelect={link.onSelect} xKey={xKey} yKey={yKey} onAxis={onAxis} ver={ver} />
          </Card>
        </Sect>
      )}
    </div>
  )
}
