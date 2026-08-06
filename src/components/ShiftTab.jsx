import { Fragment, useMemo, useState } from 'react'
import { ROWS, N, METHODS, METHOD_KEYS, methodOf, spearman } from '../lib/pipeline.js'
import { rowKey, shortSido } from '../lib/ssi.js'

// 순위 이동 탭 — 표준화 민감도를 통째로 따로 뺐다.
//
// 분석 플로우(0~5단계)는 '하나의 방법으로 결과를 만드는 길'이고, 이 탭은
// '방법을 바꾸면 그 결과가 얼마나 흔들리는가'를 따지는 별도의 검증 자리다.
// 5단계까지 정한 설정(변환·윈저·가중치)을 그대로 물려받아 계산한다.
//
//   왼쪽   방법 간 순위 상관표(스피어만) — 전체가 얼마나 비슷한가
//   가운데  순위 이동이 큰 시군구 — 두 진영 대표(Min-Max ↔ 백분위순위) 기준
//   오른쪽  전체 표 — 방법별 순위와 이동 폭

const num = (x) => x != null && Number.isFinite(x)

function BumpRow({ r, maxCamp }) {
  const w = maxCamp ? Math.min(100, (r.camp / maxCamp) * 100) : 0
  return (
    <div className={`sh-row ${r.flag}`}>
      <div className="sh-name"><em>{shortSido(r.sido)}</em><b>{r.name}</b></div>
      <div className="sh-track"><i style={{ width: `${w}%` }} /></div>
      <div className="sh-nums mono">
        <span>{Math.round(r.a)}위 → {Math.round(r.b)}위</span>
        <b>{r.camp}계단</b>
      </div>
    </div>
  )
}

export default function ShiftTab({ entries, result }) {
  const [sortKey, setSortKey] = useState('camp')
  const [q, setQ] = useState('')

  const corr = useMemo(() => {
    const out = []
    for (const a of METHOD_KEYS) {
      const row = []
      for (const b of METHOD_KEYS) {
        row.push(a === b ? 1 : spearman(result.ci[a], result.ci[b]))
      }
      out.push(row)
    }
    return out
  }, [result])

  const rows = useMemo(() => {
    const out = ROWS.map((r, i) => ({
      key: rowKey(r), sido: r.sido, name: r.name,
      a: result.rank.minmax?.[i], b: result.rank.pctrank?.[i],
      camp: result.camp[i], range: result.range[i], rstd: result.rstd[i],
      flag: result.flag[i] || 'low',
      ranks: METHOD_KEYS.map((mk) => result.rank[mk]?.[i]),
    })).filter((r) => num(r.camp))
    out.sort((x, y) => (y[sortKey] ?? 0) - (x[sortKey] ?? 0))
    return out
  }, [result, sortKey])

  const movers = rows.filter((r) => r.camp >= 5).slice(0, 24)
  const maxCamp = rows.length ? Math.max(...rows.map((r) => r.camp)) : 0
  const highN = rows.filter((r) => r.flag === 'high').length
  const midN = rows.filter((r) => r.flag === 'mid').length
  const t = q.trim()
  const tbl = t ? rows.filter((r) => r.name.includes(t) || r.sido.includes(t)) : rows

  if (!entries.length) return <div className="v3-empty">분석 플로우에서 지표를 먼저 골라 주세요.</div>

  return (
    <div className="sh-wrap">
      <div className="v3-lede">
        5단계까지 정한 설정(방향·변환·윈저라이징·가중치)을 그대로 두고 표준화 방법만
        바꿨을 때 순위가 얼마나 흔들리는지 봅니다. 두 진영 대표(Min-Max ↔ 백분위순위)의
        순위 차이가 10계단 이상이면 <b className="hi">민감(high)</b>입니다 —
        지금 조합에서는 <b className="hi">{highN}곳</b>, 5계단 이상까지 넓히면 {highN + midN}곳.
      </div>

      <div className="sh-grid">
        <div className="glass sh-card">
          <div className="sh-cap">방법 간 순위 상관 (스피어만 ρ)</div>
          <div className="sh-corr mono" style={{ '--n': METHOD_KEYS.length }}>
            <span className="sc-blank" />
            {METHODS.map((m) => <span key={m.key} className="sc-h">{m.short || m.label}</span>)}
            {METHODS.map((m, i) => (
              <Fragment key={m.key}>
                <span className="sc-h">{m.short || m.label}</span>
                {METHOD_KEYS.map((b, j) => {
                  const v = corr[i][j]
                  return (
                    <span key={`${m.key}-${b}`} className="sc-c"
                      style={{ background: v == null ? 'transparent' : `rgba(51,168,255,${Math.max(0, (v - 0.8) / 0.2) * 0.55})` }}>
                      {v == null ? '—' : v.toFixed(3)}
                    </span>
                  )
                })}
              </Fragment>
            ))}
          </div>
          <p className="sh-note">1에 가까울수록 두 방법이 같은 순서를 매긴다는 뜻입니다.
            상관이 높아도 개별 지역은 크게 움직일 수 있어, 오른쪽에서 지역 단위로 확인합니다.</p>
        </div>

        <div className="glass sh-card">
          <div className="sh-cap">순위 이동이 큰 시군구 <em className="mono">Min-Max ↔ 백분위순위 · 5계단 이상</em></div>
          <div className="sh-movers">
            {movers.length
              ? movers.map((r) => <BumpRow key={r.key} r={r} maxCamp={maxCamp} />)
              : <p className="sh-note">5계단 이상 움직이는 지역이 없습니다 — 이 조합은 방법 선택에 둔감합니다.</p>}
          </div>
        </div>

        <div className="glass sh-card sh-tblcard">
          <div className="sh-cap">
            전체 표
            <span className="seg mini">
              <button className={sortKey === 'camp' ? 'on' : ''} onClick={() => setSortKey('camp')}
                title="|Min-Max 순위 − 백분위순위 순위|">이동 폭순</button>
              <button className={sortKey === 'range' ? 'on' : ''} onClick={() => setSortKey('range')}
                title="다섯 방법 순위의 최댓값 − 최솟값">최대-최소순</button>
              <button className={sortKey === 'rstd' ? 'on' : ''} onClick={() => setSortKey('rstd')}
                title="다섯 방법 순위의 표준편차">표준편차순</button>
            </span>
            <input className="e5l-q mono" placeholder="시군구 찾기…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="sh-tbl mono">
            <div className="sh-th">
              <span>지역</span>
              {METHODS.map((m) => <span key={m.key}>{m.short || m.label}</span>)}
              <span>이동</span><span>범위</span><span>σ</span>
            </div>
            <div className="sh-tb">
              {tbl.map((r) => (
                <div key={r.key} className={`sh-tr ${r.flag}`}>
                  <span className="sh-tn">{shortSido(r.sido)} {r.name}</span>
                  {r.ranks.map((x, i) => <span key={i}>{num(x) ? Math.round(x) : '—'}</span>)}
                  <b>{r.camp}</b><span>{r.range}</span><span>{r.rstd == null ? '—' : r.rstd.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="sh-note">순위는 {N}개 시군구 기준(1 = 최상위) ·
            이동 = |Min-Max − 백분위순위| · 범위 = 다섯 방법 최대−최소 · σ = 표준편차</p>
        </div>
      </div>
    </div>
  )
}
