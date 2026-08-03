import { useEffect, useRef, useState } from 'react'
import { SECTORS, metricsFor, sectorSummary, indsOf, GRP_ORDER } from '../lib/ssi.js'
import MethodPicker from './MethodPicker.jsx'
import PickedSummary from './PickedSummary.jsx'
import { PlusMinus, Diamond } from './Glyph.jsx'

// 조작부 = 제품의 조작 패널. 접히지 않고 늘 열려 있다.
//
// 순서를 바꿨다. 예전에는 지도 색 기준이 2번, 표준화 방법이 3번 안쪽에 들어
// 있었는데, 실제로 계산을 바꾸는 것은 지표와 표준화 방법 둘뿐이고 지도 색은
// 이미 나온 결과를 무엇으로 칠할지 고르는 일이다. 계산에 필요한 것을 먼저,
// 보기에 관한 것을 나중에 둔다.
//
//   1 지표 선택      필수 — 무엇으로 점수를 낼 것인가
//   2 표준화 방법    필수 — 어떤 자로 잴 것인가 (기본값이 이미 잡혀 있다)
//   · 지도 색 기준   선택 — 결과 중 무엇을 색으로 볼 것인가 (안 골라도 됩니다)
//
// 아직 오지 않은 단계는 흐리게 잠가 둔다. 꼭 골라야 하는 것과 그렇지 않은 것이
// 같은 무게로 늘어서 있으면 어디까지 해야 화면이 나오는지 알 수 없다.
//
// 다만 2단계는 '멈춰 서는 칸'이 아니다. 표준화 방법은 들어올 때 이미 Min-Max로
// 잡혀 있으므로, 이미 골라져 있는 것을 한 번 더 눌러야 다음으로 넘어가는 것은
// 절차만 늘리는 일이었다. 이제 2단계에 닿으면 곧바로 3단계까지 가서 통계창을
// 연다. 방법을 바꾸고 싶으면 열린 화면에서 아무 때나 바꾸면 되고, 바꾼 즉시
// 지도와 통계가 따라 바뀐다.
export default function Sidebar({
  sector, method, onMethod, metric, metricKey, onMetric,
  onlyHigh, compare, onCompare,
  onOpenPicker, step = 3, onStep,
}) {
  const [openGrp, setOpenGrp] = useState({})
  const s = sectorSummary(sector)
  const inds = indsOf(sector)

  const items = metricsFor(sector, method)

  // 두 층짜리 목록을 만든다. 첫 층은 GRP_ORDER 넷으로 고정하고, 원데이터만
  // sub(지표 이름)로 한 층 더 나눈다. sub가 없는 묶음은 예전처럼 한 층이다.
  const groups = GRP_ORDER.map((g) => {
    const list = items.filter((x) => x.group === g)
    if (!list.length) return null
    const subs = []
    list.forEach((x) => {
      if (!x.sub) return
      let e = subs.find((s) => s.name === x.sub)
      if (!e) { e = { name: x.sub, list: [] }; subs.push(e) }
      e.list.push(x)
    })
    return { g, list, subs, nested: subs.length > 0 }
  }).filter(Boolean)

  const grpOpen = (id, hasCur) => (openGrp[id] === undefined ? hasCur : openGrp[id])
  const toggleGrp = (id, hasCur) => setOpenGrp((o) => ({ ...o, [id]: !grpOpen(id, hasCur) }))

  const metricBtn = (m) => (
    <button key={m.key}
      className={`acc2-item${metricKey === m.key ? ' on' : ''}`}
      onClick={() => onMetric(m.key)} title={m.desc}>
      {m.label}
      {m.dynamic && <i className="ac2-dyn"><Diamond size={9} title="표준화 방법을 바꾸면 지도가 바뀜" /></i>}
    </button>
  )

  // 2단계는 지나가는 칸이다 — 방법은 이미 잡혀 있으므로 곧바로 통계창까지 간다.
  useEffect(() => {
    if (step === 2 && onStep) onStep(3)
  }, [step, onStep])

  // 한 단계를 끝내면 다음 칸이 눈에 들어오도록 조작부를 그만큼 내린다.
  // 창 전체를 움직이면 지도가 흔들려 오히려 어지럽다 — 조작부 안에서만 움직인다.
  //
  // 3단계에서 멈추는 자리는 2번 칸(표준화 방법)이다. 방금 통계창이 열렸으니
  // 지금 확인해야 할 것은 '무엇으로 쟀는가'이고, 지도 색 기준은 안 골라도 되는
  // 칸이라 그 아래에 그대로 두면 된다.
  const scroll = useRef(null)
  const marks = useRef({})
  useEffect(() => {
    const el = marks.current[step >= 3 ? 2 : step]
    const box = scroll.current
    if (!el || !box || step < 2) return
    const y = el.offsetTop - box.offsetTop - 8
    box.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
  }, [step])

  const mark = (n) => (el) => { marks.current[n] = el }
  const cap = (n) => (step > n ? ' done' : step === n ? ' now' : ' wait')

  return (
    <aside className="sidebar sb2">
      <div className="sb2-scroll" ref={scroll}>
        {/* ── 1. 지표 고르기 ── */}
        <div className={`sb2-cap${cap(1)}`} ref={mark(1)}>
          <b>1</b>지표 선택<em>필수</em>
        </div>
        <PickedSummary sector={sector} onOpen={onOpenPicker} />
        {step === 1 && (
          <button className="sb2-next" disabled={!inds.length}
            onClick={() => onStep && onStep(2)}
            title={inds.length ? '이 지표 조합으로 계산하고 통계창 열기' : '지표를 한 개 이상 골라야 합니다'}>
            {inds.length ? '이 지표로 계산하기 →' : '지표를 골라 주세요'}
          </button>
        )}

        {/* ── 2. 표준화 방법 ── */}
        <div className={`sb2-cap${cap(2)}`} ref={mark(2)}>
          <b>2</b>표준화 방법<em>필수</em>
        </div>
        <div className={`sb2-block${step < 2 ? ' sb2-lock' : ''}`}>
          <MethodPicker method={method} onMethod={onMethod} />
          {step >= 3 && (
            <div className="sb2-hint">방법은 언제든 바꿀 수 있습니다.
              바꾸면 지도와 통계가 곧바로 다시 계산됩니다.</div>
          )}
        </div>

        {/* ── · 지도 색 기준 — 안 골라도 화면은 나온다 ── */}
        <div className={`sb2-cap sb2-opt${step < 3 ? ' wait' : ''}`} ref={mark(3)}>
          <b>·</b>지도 색 기준<em>선택 · {SECTORS[sector].name}</em>
        </div>
        <div className={`sb2-block sb2-metrics${step < 3 ? ' sb2-lock' : ''}`}>
          {items.length === 0 && <div className="sb2-tip">선택한 지표가 없어 그릴 값이 없습니다.</div>}
          {groups.map(({ g, list, subs, nested }) => {
            const id = `${sector}|${g}`
            const hasCur = list.some((m) => m.key === metricKey)
            const gon = grpOpen(id, hasCur)
            return (
              <div key={g} className={`acc2-grp gbox${gon ? ' open' : ''}${hasCur ? ' cur' : ''}`}>
                <button className="acc2-grp-h" onClick={() => toggleGrp(id, hasCur)}
                  aria-expanded={gon} data-grp={g}>
                  <span className="gb-t">{g}</span>
                  <span className="gb-n">{nested ? subs.length : list.length}</span>
                  <span className="gb-sign"><PlusMinus open={gon} size={12} /></span>
                </button>
                {gon && (
                  <div className="gb-body">
                    {/* 원데이터만 한 층 더 접힌다. 지표 이름이 소묶음 머리다. */}
                    {nested
                      ? subs.map((sb) => {
                        const sid = `${id}|${sb.name}`
                        const sHas = sb.list.some((m) => m.key === metricKey)
                        const son = grpOpen(sid, sHas)
                        return (
                          <div key={sb.name} className={`acc2-sub${son ? ' open' : ''}${sHas ? ' cur' : ''}`}>
                            <button className="acc2-sub-h" onClick={() => toggleGrp(sid, sHas)}
                              aria-expanded={son} data-sub={sb.name} title={sb.name}>
                              <span className="sb-t">{sb.name}</span>
                              <span className="sb-n">{sb.list.length}</span>
                              <span className="gb-sign"><PlusMinus open={son} size={11} /></span>
                            </button>
                            {son && <div className="acc2-sub-body">{sb.list.map(metricBtn)}</div>}
                          </div>
                        )
                      })
                      : list.map(metricBtn)}
                  </div>
                )}
              </div>
            )
          })}
          <div className="sb2-legend">
            <span>{metric.scale === 'rank' ? '하위' : metric.scale === 'div' ? '상승' : '낮음'}</span>
            <div className={`lg-bar ${metric.scale}`} />
            <span>{metric.scale === 'rank' ? '상위' : metric.scale === 'div' ? '하락' : '높음'}</span>
          </div>
          {/* '민감 지역만' 스위치는 지도 오른쪽 아래에 하나만 둔다.
              효과가 보이는 자리에 조작을 놓아 조작–결과 거리를 없앤다. */}
          <div className="sb2-tip">
            민감 지역만 보기 스위치는 <b>지도 오른쪽 아래</b>에 있습니다
            {onlyHigh && <em> · 지금 켜짐</em>}
          </div>
        </div>
      </div>

      {/* ── 고정 발판: 현황 요약 + 이 화면의 주 행동 하나 ── */}
      <div className="sb2-foot">
        <div className="sb2-stat">
          <div><span>시군구</span><b>{s.n}</b></div>
          <div><span>평균 이동</span><b>{s.avg.toFixed(1)}</b></div>
          <div><span>10계단↑</span><b>{s.over10}</b></div>
          <div><span>민감</span><b>{s.high}</b></div>
        </div>
        <button className={`sb2-cta${compare ? ' on' : ''}`} onClick={() => onCompare(!compare)}>
          {compare ? '단일 지도로 되돌리기' : '표준화 방법 2종 동시 비교'}
        </button>
      </div>
    </aside>
  )
}
