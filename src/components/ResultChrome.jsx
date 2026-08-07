import { SECTORS, METHODS, methodOf, metricsFor, sectorSummary, indsOf, GRP_ORDER, N } from '../lib/ssi.js'
import { RankCard, rankRows } from './StatsExtras.jsx'
import DlMenu from './DlMenu.jsx'
import { Diamond } from './Glyph.jsx'

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
            disabled={locked}
            onClick={() => onGo(st.v)}>
            <u>{done ? '✓' : i}</u>
            <span><b>{st.t}</b><em>{st.d}</em></span>
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

export function MapBar({ sector, method, onMethod, metricKey, onMetric, compare, onCompare, deckW }) {
  const items = metricsFor(sector, method)
  const groups = GRP_ORDER.map((g) => [g, items.filter((x) => x.group === g)]).filter(([, l]) => l.length)
  // 비교 모드 — 좌우 지도가 각자 조작부를 갖고 있으므로 되돌아오기만 남긴다
  if (compare) {
    return (
      <div className="mapbar mapbar-mini">
        <button className="mb-cmp on" onClick={() => onCompare(false)}>단일 지도로 되돌리기</button>
      </div>
    )
  }
  return (
    <div className="mapbar" style={{ left: `${deckW + 10}px` }}>
      <div className="mb-grp">
        <u>지도 값</u>
        <select value={metricKey} onChange={(e) => onMetric(e.target.value)} title="지도에 칠할 값 — 네 묶음">
          {groups.map(([g, list]) => (
            <optgroup key={g} label={g}>
              {list.map((m) => (
                <option key={m.key} value={m.key}>{m.sub ? `${m.sub} · ` : ''}{m.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <span className="mb-sep" />
      <div className="mb-grp">
        <u>표준화 방법 <i className="mb-dyn"><Diamond size={8} title="방법을 바꾸면 지도·통계가 다시 계산됨" /></i></u>
        <div className="mb-seg">
          {METHODS.map((mm) => (
            <button key={mm.key} className={method === mm.key ? 'on' : ''}
              onClick={() => onMethod(mm.key)} title={`${mm.formula} · ${mm.range}`}>{mm.label}</button>
          ))}
        </div>
      </div>
      <span className="mb-sep" />
      <button className={`mb-cmp${compare ? ' on' : ''}`} onClick={() => onCompare(!compare)}>
        {compare ? '단일 지도로' : '2종 동시 비교'}
      </button>
    </div>
  )
}
