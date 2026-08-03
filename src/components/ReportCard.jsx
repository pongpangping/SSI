import { METHODS, SECTORS, N, methodOf, indsOf, indT, indRank, ciT, pctOf,
  rowIndex, rowKey, stdSeries, fmtRaw } from '../lib/ssi.js'
import { tColor, tWord, tPos, T_TICKS, T_MIN, T_MAX } from '../lib/report.js'

// 지역 진단표 — 선택한 시군구 한 곳의 지표별·부문 종합 결과를 한 표에 세운다.
// 지표 하나가 한 줄, 맨 위가 부문 종합 줄이다.
// 표준화 방법을 바꾸면 원값은 그대로인데 표준점수가 움직인다.
// 이 화면이 보여주려는 것이 바로 그 움직임이다.
//
// 막대의 눈금은 T점수다. 한가운데 굵은 선이 전국 평균 50, 눈금 한 칸이 10점이다.
// 0~100 눈금이 아니라는 것을 눈으로 알 수 있게 20~80 구간만 그린다.

const f1 = (v) => (v == null ? '—' : v.toFixed(1))

function Line({ name, note, stats, t, pct, total }) {
  const c = tColor(t)
  const p = tPos(t)
  return (
    <div className={`rp-r${total ? ' total' : ''}`}>
      <div className="rp-r1">
        <b>{name}</b>
        {note && <em>{note}</em>}
        <span className="rp-tw" style={{ color: c }}>{tWord(t)}</span>
      </div>
      <div className="rp-r2">
        {stats.map((s) => (
          <span key={s[0]} title={s[2] || ''}><em>{s[0]}</em><b>{s[1]}</b></span>
        ))}
      </div>
      <div className="rp-bar"
        title={`표준점수(T) ${f1(t)} · 평균 50 · 표준편차 10${pct == null ? '' : ` · 백분위 ${pct.toFixed(1)}%`}`}>
        {T_TICKS.map((v) => (
          <s key={v} className={v === 50 ? 'mid' : ''}
            style={{ left: `${(v - T_MIN) / (T_MAX - T_MIN) * 100}%` }} />
        ))}
        {p != null && <i style={{ left: `${p * 100}%`, background: c }} />}
        <u>{t == null ? '—' : `T ${t.toFixed(1)}`}</u>
      </div>
    </div>
  )
}

export default function ReportCard({ row, sector, method, onMethod }) {
  if (!row) return <div className="empty-hint">지도에서 시군구를 클릭하면 진단표가 나옵니다</div>

  const m = methodOf(method)
  const i = rowIndex(rowKey(row))
  const d = row[sector]
  const inds = indsOf(sector)
  if (!d) return <div className="empty-hint">지표를 하나 이상 선택해 주세요</div>

  const sRank = d.rank[method]
  const sPct = pctOf(sRank)
  const sT = ciT(sector, method)[i]

  const yr = (() => {
    const ys = []
    inds.forEach((e) => { if (!ys.includes(e.year)) ys.push(e.year) })
    ys.sort()
    return ys.length === 1 ? `${ys[0]}년` : `${ys[0]}~${ys[ys.length - 1]}년`
  })()

  return (
    <div className="rp">
      <div className="rp-top">
        <div className="rp-who">
          <b>{row.sido} {row.name}</b>
          <em>{SECTORS[sector].name} · 지표 {inds.length}개 · {yr} · {m.label} 기준</em>
        </div>
        <div className="rp-big" style={{ borderColor: tColor(sT) }}>
          <span>전국</span><b>{sRank == null ? '—' : `${sRank}위`}</b>
          <em style={{ color: tColor(sT) }}>T {f1(sT)}</em>
        </div>
      </div>

      <div className="rp-tbl">
        <Line total name="부문 종합" note={`선택 지표 ${inds.length}개 동일가중 평균`}
          t={sT} pct={sPct}
          stats={[
            ['부문점수', f1(d.ci[method]), '표준화한 지표들의 평균 = CI'],
            ['표준점수', f1(sT), 'T점수 · 평균 50 · 표준편차 10'],
            ['전국순위', sRank == null ? '—' : `${sRank}위`, `${N}개 시군구 중`],
            ['백분위', sPct == null ? '—' : `${sPct.toFixed(1)}%`, '나보다 낮은 지역의 비율'],
          ]} />

        {inds.map((ind) => {
          const rk = indRank(sector, ind.label, method)[i]
          const raw = d.raw[ind.label]
          const it = indT(sector, ind.label, method)[i]
          return (
            <Line key={ind.label} name={ind.name || ind.label}
              note={`${ind.dir === '+' ? '▲ 높을수록 좋음' : '▼ 낮을수록 좋음'} · ${ind.year}년`}
              t={it} pct={pctOf(rk)}
              stats={[
                ['원값', raw == null ? '—' : `${fmtRaw(raw)}${ind.unit || ''}`, ind.desc],
                ['표준화', f1(stdSeries(sector, ind.label, method)[i]), `${m.label}: ${m.formula}`],
                ['표준점수', f1(it), 'T점수 · 평균 50 · 표준편차 10'],
                ['지표순위', rk == null ? '—' : `${Math.round(rk)}위`, `${N}개 시군구 중`],
              ]} />
          )
        })}
      </div>

      {/* 방법을 바꾸면 결과가 어떻게 달라지는지 — 종합 순위만 한 줄로 */}
      <div className="rp-sw">
        <span className="rp-sw-c">표준화 방법을 바꿔 보기</span>
        <div className="rp-sw-l">
          {METHODS.map((x) => {
            const rk = d.rank[x.key]
            const t = ciT(sector, x.key)[i]
            return (
              <button key={x.key} className={`rp-sw-b${x.key === method ? ' on' : ''}`}
                onClick={() => onMethod?.(x.key)}
                title={`${x.label}으로 보면 ${rk == null ? '—' : `${rk}위`} · 표준점수 ${f1(t)}`}>
                <em>{x.label}</em>
                <b>{rk == null ? '—' : `${rk}위`}</b>
                <i style={{ background: tColor(t) }}>{t == null ? '—' : Math.round(t)}</i>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rp-foot">
        <span>원값은 그대로인데 표준점수와 순위는 방법마다 달라집니다. 어느 방법이 옳으냐가
          아니라, 이 지역의 순위가 표준화 방법에 얼마나 의존하는지를 확인하는 표입니다.
          전체 {N}개 시군구 표는 카드 오른쪽 위 [CSV]로 받습니다.</span>
      </div>
    </div>
  )
}
