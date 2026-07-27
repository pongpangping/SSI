import { METHODS, SECTORS, N, methodOf, indsOf, indT, indRank, ciT, pctOf, gradeOf,
  rowIndex, rowKey, stdSeries, reportCSV } from '../lib/ssi.js'
import { gradeColor } from '../lib/report.js'

// 성적표 — 모의고사 성적표를 그대로 옮겨 놓은 표.
// 지표 하나가 '과목' 한 줄, 부문 종합이 '총점' 줄이다.
// 표준화 방법을 바꾸면 원점수는 그대로인데 표준점수·등급이 움직인다.
// 이 화면이 보여주려는 것이 바로 그 움직임이다.

const f1 = (v) => (v == null ? '—' : v.toFixed(1))

function Line({ name, note, stats, pct, grade, total }) {
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  const c = gradeColor(grade)
  return (
    <div className={`rp-r${total ? ' total' : ''}`}>
      <div className="rp-r1">
        <b>{name}</b>
        {note && <em>{note}</em>}
        <span className="rp-gd" style={{ background: c }}>{grade == null ? '—' : `${grade}등급`}</span>
      </div>
      <div className="rp-r2">
        {stats.map((s) => (
          <span key={s[0]} title={s[2] || ''}><em>{s[0]}</em><b>{s[1]}</b></span>
        ))}
      </div>
      <div className="rp-bar" title={`백분위 ${p.toFixed(1)}% — 나보다 점수가 낮은 지역의 비율`}>
        <i style={{ width: `${p}%`, background: c }} />
        <u>{pct == null ? '—' : `${p.toFixed(1)}%`}</u>
      </div>
    </div>
  )
}

export default function ReportCard({ row, sector, method, onMethod }) {
  if (!row) return <div className="empty-hint">지도에서 시군구를 클릭하면 성적표가 나옵니다</div>

  const m = methodOf(method)
  const i = rowIndex(rowKey(row))
  const d = row[sector]
  const inds = indsOf(sector)

  const sRank = d.rank[method]
  const sPct = pctOf(sRank)
  const sGrade = gradeOf(sRank)

  const save = () => {
    const blob = new Blob([reportCSV(sector, method)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `성적표_${sector}_${m.label}_${N}행.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="rp">
      <div className="rp-top">
        <div className="rp-who">
          <b>{row.sido} {row.name}</b>
          <em>{SECTORS[sector].name} · {m.label} 기준</em>
        </div>
        <div className="rp-big" style={{ borderColor: gradeColor(sGrade) }}>
          <span>전국</span><b>{sRank}위</b>
          <em style={{ color: gradeColor(sGrade) }}>{sGrade}등급</em>
        </div>
      </div>

      <div className="rp-tbl">
        <Line total name="부문 종합" note={`지표 ${inds.length}개 동일가중 평균`}
          pct={sPct} grade={sGrade}
          stats={[
            ['부문점수', f1(d.ci[method]), '표준화한 지표들의 평균 = CI'],
            ['표준점수', f1(ciT(sector, method)[i]), '전국 평균 50 · 표준편차 10'],
            ['전국순위', `${sRank}위`, `${N}개 시군구 중`],
            ['백분위', sPct == null ? '—' : `${sPct.toFixed(1)}%`, '나보다 낮은 지역의 비율'],
          ]} />

        {inds.map((ind) => {
          const rk = indRank(sector, ind.label, method)[i]
          const raw = d.raw[ind.label]
          return (
            <Line key={ind.label} name={ind.label}
              note={ind.dir === '+' ? '높을수록 좋음' : '낮을수록 좋음'}
              pct={pctOf(rk)} grade={gradeOf(rk)}
              stats={[
                ['원점수', raw == null ? '—' : `${raw}${ind.unit || ''}`, ind.desc],
                ['표준화', f1(stdSeries(sector, ind.label, method)[i]), `${m.label}으로 0~100 눈금에 올린 값`],
                ['표준점수', f1(indT(sector, ind.label, method)[i]), '전국 평균 50 · 표준편차 10'],
                ['지표순위', rk == null ? '—' : `${Math.round(rk)}위`, `${N}개 시군구 중`],
              ]} />
          )
        })}
      </div>

      {/* 방법을 바꾸면 성적표가 어떻게 달라지는지 — 종합 순위·등급만 한 줄로 */}
      <div className="rp-sw">
        <span className="rp-sw-c">표준화 방법을 바꿔 보기</span>
        <div className="rp-sw-l">
          {METHODS.map((x) => {
            const rk = row[sector].rank[x.key]
            const g = gradeOf(rk)
            return (
              <button key={x.key} className={`rp-sw-b${x.key === method ? ' on' : ''}`}
                onClick={() => onMethod?.(x.key)}
                title={`${x.label}으로 보면 ${rk}위 · ${g}등급`}>
                <em>{x.short || x.label}</em>
                <b>{rk}위</b>
                <i style={{ background: gradeColor(g) }}>{g}</i>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rp-foot">
        <span>원점수는 그대로인데 표준점수와 등급은 방법마다 달라집니다.
          어느 방법이 옳으냐보다, 이 지역의 자리가 방법에 얼마나 기대고 있는지를 읽는 표입니다.</span>
        <button className="rp-dl" onClick={save}
          title={`${SECTORS[sector].name} · ${m.label} 기준 ${N}개 시군구 성적표 전체`}>
          ⬇ 전체 {N}행 내려받기
        </button>
      </div>
    </div>
  )
}
