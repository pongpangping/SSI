import { ALL_SECTOR_KEYS, SECTORS, indicatorsOf, META } from '../lib/ssi.js'
import SectorIcon from './SectorIcon.jsx'
import labLogo from '../assets/sal_lab_logo.png'
import SsiMark from './SsiMark.jsx'

// 시작 화면 — "어느 부문을 볼 것인가" 하나만 묻는다.
//
// 예전에는 부문 열 개가 조작부 1번 칸의 작은 격자에 들어 있었다. 이 화면을 쓰는
// 사람은 대개 한 분야의 실무자라, 자기 부문 하나만 정하면 나머지 열 개는 볼
// 이유가 없다. 그런데 격자는 지표 선택·지도 색 기준·표준화 방법과 같은 무게로
// 놓여 있어 '이것부터 고르는 것'이라는 순서가 드러나지 않았다.
//
// 그래서 부문 고르기를 화면 전체로 떼어 냈다. 여기서 하나를 고르면 그 부문의
// 화면으로 들어가고, 머리줄의 부문 이름을 누르면 다시 이 화면으로 돌아온다.
// 자료가 아직 없는 넷은 아래에 작게 두어, 곧 들어온다는 사실만 알린다.
//
// 주소에 부문이 담겨 있을 때도 이 화면을 건너뛰지 않는다. 대신 그 부문 카드를
// 맨 앞으로 옮기고 '이어보던 부문' 띠를 붙인다. 화면을 여는 문은 늘 하나이고,
// 이어 보던 자리는 그 문 앞에 표시로 남는다.
export default function LandingPage({ onPick, resume = null }) {
  const all = ALL_SECTOR_KEYS.filter((k) => SECTORS[k].ready)
  const back = resume && SECTORS[resume] && SECTORS[resume].ready ? resume : null
  const ready = back ? [back, ...all.filter((k) => k !== back)] : all
  const soon = ALL_SECTOR_KEYS.filter((k) => !SECTORS[k].ready)

  const yearsOf = (k) => {
    const ys = []
    indicatorsOf(k).forEach((i) => i.years.forEach((y) => { if (!ys.includes(y)) ys.push(y) }))
    ys.sort()
    if (ys.length === 0) return ''
    return ys.length === 1 ? `${ys[0]}년` : `${ys[0]}~${ys[ys.length - 1]}년`
  }

  return (
    <div className="lp">
      <div className="lp-inner">
        <div className="lp-head">
          <SsiMark size={46} />
          <h1>국토종합진단지수</h1>
          <p>
            전국 {META?.n || 229}개 시군구를 부문별로 표준화해 비교하고,<br />
            표준화 방법을 바꿨을 때 순위가 얼마나 흔들리는지까지 함께 봅니다.
          </p>
          <div className="lp-ask">어느 부문을 보시겠습니까?</div>
        </div>

        <div className="lp-grid">
          {ready.map((k) => {
            const s = SECTORS[k]
            const inds = indicatorsOf(k)
            return (
              <button key={k} className={`lp-card${k === back ? ' lp-back' : ''}`} onClick={() => onPick(k)}>
                {k === back && <span className="lpc-resume">이어보던 부문</span>}
                <span className="lpc-top">
                  <SectorIcon k={k} state="on" size={30} />
                  <b>{s.name}</b>
                </span>
                <span className="lpc-meta">지표 {inds.length}개 · {yearsOf(k)}</span>
                <span className="lpc-chips">
                  {inds.slice(0, 5).map((i) => <em key={i.id}>{i.label}</em>)}
                  {inds.length > 5 && <em className="lpc-more">외 {inds.length - 5}개</em>}
                </span>
                <span className="lpc-go">{k === back ? '이어서 보기 →' : '이 부문 보기 →'}</span>
              </button>
            )
          })}
        </div>

        <div className="lp-soon">
          <div className="lps-cap">자료 준비중</div>
          <div className="lps-row">
            {soon.map((k) => {
              const s = SECTORS[k]
              const n = (s.planned || []).length
              return (
                <span key={k} className="lps-item" title={(s.planned || []).map((p) => p.label).join(' · ')}>
                  <SectorIcon k={k} state="lock" size={15} />
                  <b>{s.name}</b>
                  {n > 0 && <u>지표 {n}개 예정</u>}
                </span>
              )
            })}
          </div>
        </div>

        {/* 만든 곳 — 여느 웹처럼 맨 아래에 연구실 표시를 남긴다 */}
        <div className="lp-foot">
          <img className="lpf-logo" src={labLogo} alt="Spatial Analysis Lab" />
          <div className="lpf-txt">
            <b>공간분석연구실 · Spatial Analysis Lab</b>
            <span>국립한국교통대학교 · © {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
