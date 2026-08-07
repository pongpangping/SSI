import { SECTORS, METHODS, methodOf, metricsFor, sectorSummary, indsOf, GRP_ORDER, N } from '../lib/ssi.js'
import { RankCard, rankRows } from './StatsExtras.jsx'
import DlMenu from './DlMenu.jsx'

// 결과 화면의 새 뼈대 (31차 IA) — 조작부 사이드바를 걷어내고 세 가지로 나눴다.
//
//   JourneyBar  머리줄 아래 여정 바. 0~5단계가 한 줄로 늘어서고, 지나온 단계에
//               체크가 붙는다. 어느 단계든 눌러 오간다.
//   RankPanel   결과 화면 왼쪽 — 지역별 점수 순위(작업요령 5단계의 왼쪽 표).
//   MapBar      지도 위 명령바 — 지도 값(네 묶음) · 표준화 방법 · 2종 비교.
//               조작을 결과(지도) 바로 옆에 둔다. 조작–결과 거리 최소화.

export const JOURNEY = [
  { v: 'step0', t: '지표 선택', d: '부문 · 연도 · 지표' },
  { v: 'step1', t: '지표 탐색', d: '기술통계 · 분포' },
  { v: 'step2', t: '변환 · 방향', d: 'P/N · 로그화 · 윈저' },
  { v: 'step3', t: '표준화', d: '4방법 분포 비교' },
  { v: 'step4', t: '가중치', d: '합 100 분할' },
  { v: 'result', t: '종합점수 · 지도', d: '순위 · 통계 · 내보내기' },
]

// 38차 — 머리줄 안으로 들어가며 홀쭉해졌다. 두 줄짜리 칩(제목+설명)이
// 한 줄 칩이 되고, 설명은 툴팁으로 물러난다. 지금 단계 칩만 설명을 함께 쓴다.
export function JourneyBar({ view, visited, onGo, canGo }) {
  return (
    <div className="jb">
      {JOURNEY.map((st, i) => {
        const on = view === st.v
        const done = visited.includes(st.v) && !on
        const locked = i > 0 && !canGo
        return (
          <button key={st.v}
            className={`jb-step${on ? ' on' : ''}${done ? ' done' : ''}`}
            disabled={locked} title={`${st.t} — ${st.d}`}
            onClick={() => onGo(st.v)}>
            <u>{done ? '✓' : i}</u>
            <span><b>{st.t}</b>{on && <em>{st.d}</em>}</span>
          </button>
        )
      })}
    </div>
  )
}

export function RankPanel({ sector, method, confirmed, selected, onSelect, ver }) {
  const s = sectorSummary(sector)
  const inds = indsOf(sector)
  const rankPack = () => ({
    base: `${SECTORS[sector].name}_지역별_점수순위_${methodOf(method).label}`,
    title: `지역별 점수 순위 · ${methodOf(method).label}`,
    sub: `전국 ${N}개 시군구 · 가중 합성 부문점수(CI)`,
    cols: ['순위', '시도', '시군구', '부문점수'],
    rows: rankRows(sector, method).map((r) => [Math.round(r.rank), r.sido, r.name,
      r.ci == null ? null : Math.round(r.ci * 10) / 10]),
  })
  return (
    <aside className="rkp">
      <div className="rkp-head">
        <div><b>지역별 점수 순위</b>
          <em>{SECTORS[sector].name} · {methodOf(method).label}</em></div>
        {confirmed && inds.length > 0 && <DlMenu pack={rankPack} cls="ccard-dl" tip="순위표 전체 CSV·Excel·PNG" />}
      </div>
      {confirmed && inds.length ? (
        <>
          <div className="rkp-body">
            <RankCard sector={sector} method={method} selected={selected} onSelect={onSelect} ver={ver} tall />
          </div>
          <div className="rkp-foot">
            <div><span>시군구</span><b>{s.n}</b></div>
            <div><span>평균 이동</span><b>{s.avg.toFixed(1)}</b></div>
            <div><span>10계단↑</span><b>{s.over10}</b></div>
            <div><span>민감</span><b>{s.high}</b></div>
          </div>
        </>
      ) : (
        <div className="rkp-wait">
          <b>아직 계산 전입니다</b>
          <span>0단계에서 지표를 확정하면 순위표가 채워지고 지도에 색이 칠해집니다.</span>
        </div>
      )}
    </aside>
  )
}

// 지도 명령바 (36차) — 지도 위에 떠 있던 작은 상자를 걷어내고, 여정 바 바로
// 아래 한 줄짜리 도킹 바로 바꿨다. 떠 있던 시절에는 통계창 흐름줄과 겹쳐 보였고
// 9px 딱지 밑에 좁은 select가 붙어 있어 무엇을 고르는 칸인지 읽기 어려웠다.
// 이제 '지도 값 → 표준화 방법 → 2종 비교'가 왼쪽부터 순서대로 놓이고,
// 어떤 것과도 겹치지 않는다. 비교 모드에서는 같은 자리가 안내문과
// '단일 지도로 되돌리기'로 바뀐다 — 바 자체는 늘 같은 높이로 서 있다.
export function MapBar({ sector, method, onMethod, metricKey, onMetric, compare, onCompare, onReport }) {
  const items = metricsFor(sector, method)
  const groups = GRP_ORDER.map((g) => [g, items.filter((x) => x.group === g)]).filter(([, l]) => l.length)
  const cur = items.find((x) => x.key === metricKey)
  const m = methodOf(method)
  if (compare) {
    return (
      <div className="cmdbar">
        <div className="cb-grp"><label>지도</label><b className="cb-now">2종 동시 비교</b></div>
        <span className="cb-sep" />
        <span className="cb-note">왼쪽·오른쪽 지도의 값 · 표준화 방법 · 색을 각자 바꿔 나란히 봅니다.</span>
        <span className="cb-flex" />
        <button className="cb-rep" onClick={onReport}
          title="지표 구성·전국 요약·순위를 한 벌 문서로 — 인쇄해 PDF로 저장">보고서</button>
        <button className="cb-back" onClick={() => onCompare(false)}>단일 지도로 되돌리기</button>
      </div>
    )
  }
  return (
    <div className="cmdbar">
      <div className="cb-grp">
        <label htmlFor="cb-metric">지도 값</label>
        <select id="cb-metric" value={metricKey} onChange={(e) => onMetric(e.target.value)}
          title="지도에 칠할 값 — 네 묶음 안에서 고릅니다">
          {groups.map(([g, list]) => (
            <optgroup key={g} label={g}>
              {list.map((x) => (
                <option key={x.key} value={x.key}>{x.sub ? `${x.sub} · ` : ''}{x.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {cur?.group && <em className="cb-tag">{cur.group}</em>}
      </div>
      <span className="cb-sep" />
      <div className="cb-grp">
        <label>표준화 방법</label>
        <div className="cb-seg">
          {METHODS.map((mm) => (
            <button key={mm.key} className={method === mm.key ? 'on' : ''}
              onClick={() => onMethod(mm.key)} title={`${mm.formula} · ${mm.range}`}>{mm.label}</button>
          ))}
        </div>
        <em className="cb-hint">{m.formula} · {m.range}</em>
      </div>
      <span className="cb-flex" />
      <button className="cb-cmp" onClick={() => onCompare(true)}
        title="같은 지도를 두 장 띄워 값·방법·색을 달리해 비교">2종 동시 비교</button>
      <button className="cb-rep" onClick={onReport}
        title="지표 구성·전국 요약·순위를 한 벌 문서로 — 인쇄해 PDF로 저장">보고서 저장</button>
    </div>
  )
}
