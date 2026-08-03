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
import SectorIcon from './SectorIcon.jsx'
import DlMenu from './DlMenu.jsx'
import Drawer from './Drawer.jsx'
import { Chevron } from './Glyph.jsx'
import { SECTORS, methodOf, indsOf, N } from '../lib/ssi.js'
import {
  dlReport, dlMethods, dlRaw, dlTransform, dlDist, dlRankFlow,
  dlScatter, dlSensScatter, dlSensList, dlAll,
  dlDistribution, dlTopBottom, dlBySido, dlContribution, dlSummaryAll,
  dlRawAll,
} from '../lib/statscsv.js'

// 통계창.
//
// 15차까지는 탭 세 개였다. 부문 종합 · 표준화 민감도 · 원데이터가 나란히 붙어
// 있었고, 부문 종합 탭만 조금 넓게 그려 두었다. 그 20px 차이로는 어느 것이
// 주가 되는지 읽히지 않았다. 게다가 지도에서 시군구를 눌러도 그 결과가 부문
// 종합 탭의 맨 아래에 붙어 있어, 화면상으로는 아무 일도 일어나지 않은 것처럼
// 보였다.
//
// 그래서 탭을 없앴다. 순서와 생김새로 위계를 만든다.
//
//   0 흐름줄        지금 무엇을 보고 있는가
//   1 선택 지역     지도에서 고른 곳이 있을 때만. 맨 위
//   2 부문 종합     본문. 항상 펼쳐 둔다 (지역을 고르면 접힌다)
//   3 표준화 민감도  서랍 · 처음부터 펴 둔다 (17차)
//   4 원데이터      서랍 · 처음부터 펴 둔다 (17차)
//
// 층을 옮겨도 고른 것(부문·지표·방법·선택 지역)은 그대로다. 보는 각도만 바뀐다.
//
// 여기 있지 않은 것 — 지표 정의·산식·출처. 값의 뜻을 읽는 일은 네 층 어디서나
// 똑같이 필요하므로 층 안에 두지 않고 머리줄 오른쪽 '데이터 설명'으로 뺐다(18차).
// 같은 이유로 용어 사전과 전체 데이터표도 머리줄에 있다.
//
// 색 있는 세로 선도 여기 없다. 17차까지 선택 지역 칸의 왼쪽에 3px 파란 선을
// 세워 두었는데, 카드가 여럿 쌓이면 선이 통계창 높이만큼(2,700px 남짓) 이어져
// 무엇을 묶는 선인지 알 수 없었다. 층의 구분은 머리줄 하나로 충분하다(18차).

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

// 본문 칸의 머리. 서랍 머리와 일부러 다르게 그린다.
function BodyHead({ title, plain, foldable, open, onToggle, right }) {
  const Tag = foldable ? 'button' : 'div'
  return (
    <Tag
      type={foldable ? 'button' : undefined}
      className={`csect-head${foldable ? ' csect-fold' : ''}${foldable && !open ? ' shut' : ''}`}
      aria-expanded={foldable ? open : undefined}
      onClick={foldable ? () => onToggle(!open) : undefined}
    >
      {foldable && <Chevron open={open} size={13} />}
      <span className="csect-t">{title}{plain && <em>{plain}</em>}</span>
      {right}
      {foldable && <span className="csect-act">{open ? '접기' : '펼치기'}</span>}
    </Tag>
  )
}

export default function CenterPanel({
  sector, method, metric, selectedRow, link, ver = 0,
  xKey, yKey, onAxis, onOpenPicker,
  drawers = {}, onDrawer, sumOpen = true, onSumOpen,
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
          <span className="fb-step fb-opt"><b>{metric.full || metric.label}</b><u>지도 색</u></span>
          {name && (
            <button className="fb-step fb-opt fb-sel fb-btn"
              title="선택을 풀고 전국 화면으로 돌아갑니다"
              onClick={() => link.onSelect(null)}>
              <b>{name}</b><u>✕ 전국으로</u>
            </button>
          )}
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

      {/* ── 1 선택 지역 — 지도에서 고른 곳이 있을 때만, 맨 위 ───────────── */}
      {selectedRow && (
        <section className="csect csect-sel">
          <BodyHead
            title={name}
            plain="지도에서 고른 시군구"
            right={<button className="csect-x" onClick={() => link.onSelect(null)}
              title="선택을 풀고 전국 화면으로 돌아갑니다">← 전국으로 돌아가기</button>}
          />
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
        </section>
      )}

      {/* ── 2 부문 종합 — 본문 ─────────────────────────────────────────── */}
      <section className={`csect csect-main${sumOpen ? '' : ' shut'}`}>
        <BodyHead
          title="부문 종합"
          plain={`전국 ${N}개 시군구`}
          foldable={!!selectedRow}
          open={sumOpen}
          onToggle={onSumOpen}
        />
        {sumOpen && (
          <>
            {/* 지도를 누르기 전에는 전국 통계가 곧바로 나온다.
                16차까지 이 자리에 '지도에서 시군구를 클릭하면…' 안내 상자를 두었는데,
                통계창을 열자마자 보이는 첫 칸이 통계가 아니라 안내문이라, 전국 통계는
                아래로 밀리고 화면은 아직 아무것도 없는 것처럼 보였다.
                같은 안내는 흐름줄 한 줄로 이미 하고 있으므로 상자는 없앤다. */}
            <NationalSummary sector={sector} method={method} selected={link.selected}
              selectedRow={selectedRow} onSelect={link.onSelect} ver={ver} dlOf={nsDl} />
            <div className="nsum-all">
              <span>전국 요약 네 칸을 한 파일로</span>
              <DlMenu cls="fb-dl" label="내려받기" wide
                pack={() => dlSummaryAll(sector, method)}
                tip="분포 요약 · 상위·하위 · 시도별 평균 · 지표별 기여도" />
            </div>
          </>
        )}
      </section>

      {/* ── 3 표준화 민감도 — 서랍 ─────────────────────────────────────── */}
      <Drawer id="sens" title="표준화 민감도" plain="방법별 부문점수와 순위 이동"
        count={5} open={!!drawers.sens} onToggle={(v) => onDrawer('sens', v)}>
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
      </Drawer>

      {/* ── 4 원데이터 — 서랍 ──────────────────────────────────────────── */}
      {/* 지표 정의 · 산식 · 출처는 여기 있지 않다. 값의 뜻을 읽는 일은 이 서랍의
          어느 표에서나 똑같이 필요하므로 머리줄 오른쪽 '데이터 설명'으로 옮겼다. */}
      <Drawer id="raw" title="원데이터" plain="표준화하기 전의 값"
        count={3} open={!!drawers.raw} onToggle={(v) => onDrawer('raw', v)}>
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
            표가 커서 화면에는 싣지 않습니다. 오른쪽 위 내려받기로 CSV·Excel 파일을 받으세요.
            머리줄의 <b>전체 데이터표</b>에서도 같은 값을 볼 수 있습니다.
          </div>
        </Card>
        <Card title="지표 간 산점도" sub="가로·세로축 직접 지정"
          dl={() => dlScatter(sector, method, xKey, yKey)} dlTip="지금 축 두 개의 값">
          <ScatterPlot sector={sector} method={method} selected={link.selected}
            onSelect={link.onSelect} xKey={xKey} yKey={yKey} onAxis={onAxis} ver={ver} />
        </Card>
      </Drawer>
    </div>
  )
}
