import { useMemo } from 'react'
import SvgMap from './SvgMap.jsx'
import { ROWS, N, methodOf, describe, pctFromRank, TRANSFORMS } from '../lib/pipeline.js'
import { rowKey, rowIndex, shortSido, SECTORS } from '../lib/ssi.js'
import { rampOf } from '../lib/palettes.js'
import { breaksOf, classOf } from '../lib/classify.js'

// 최종 리포트 — 인쇄용 화면.
//
// 화면 그대로 브라우저 인쇄(⌘P / Ctrl+P)를 눌러 PDF로 저장한다. 별도 프로그램이
// 필요 없도록 지도는 SVG로 다시 그리고, 바탕은 종이에 맞는 밝은 색으로 바꾼다.
//
// 담는 것 — ① 설정 요약(무엇을 어떻게 계산했는가) ② 지수 지도 ③ 상위·하위 10
// ④ 십분위 분포 ⑤ 표준화 민감도 요약 ⑥ 전체 순위표. 순서대로 읽으면 그대로
// 부록으로 쓸 수 있는 구성이다.

const num = (x) => x != null && Number.isFinite(x)
const f1 = (v) => (v == null ? '—' : v.toFixed(1))
const trLabel = (k) => TRANSFORMS.find((t) => t.key === k)?.label || '변환 없음'

export default function ReportView({ sector, entries, result, method, alpha, gradeMode, palette, onBack }) {
  const m = methodOf(method)
  const sName = SECTORS[sector]?.name || sector
  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  }, [])

  const rows = useMemo(() => {
    const out = ROWS.map((r, i) => ({
      key: rowKey(r), sido: r.sido, name: r.name,
      ci: result.ci[method]?.[i], t: result.ciT[method]?.[i],
      rank: result.rank[method]?.[i], grade: result.grade[method]?.[i],
      camp: result.camp[i], flag: result.flag[i],
    })).filter((r) => num(r.rank))
    out.sort((a, b) => a.rank - b.rank)
    return out
  }, [result, method])

  const st = useMemo(() => describe(result.ci[method] || []), [result, method])
  const ramp = rampOf(palette, 7)
  const vals = result.ci[method] || []
  const colorOf = useMemo(() => {
    const ok = vals.filter(num)
    if (!ok.length) return () => '#EEE'
    const breaks = breaksOf(vals, 'quantile', 7)
    const at = classOf(breaks)
    return (i) => {
      const v = i == null ? null : vals[i]
      const c = at(v)
      return c < 0 ? '#E5E7EB' : ramp[Math.min(ramp.length - 1, c)]
    }
  }, [vals, ramp])

  const gradeCount = useMemo(() => {
    const c = Array.from({ length: 10 }, () => 0)
    rows.forEach((r) => { if (r.grade) c[r.grade - 1]++ })
    return c
  }, [rows])
  const maxG = Math.max(...gradeCount, 1)

  const highs = rows.filter((r) => r.flag === 'high')
  const movers = [...rows].sort((a, b) => (b.camp ?? 0) - (a.camp ?? 0)).slice(0, 10)

  const wSum = result.weights.reduce((a, b) => a + b, 0) || 1

  return (
    <div className="rp-wrap">
      <div className="rp-tools noprint">
        <button className="ghost-btn" onClick={onBack}>← 5단계로 돌아가기</button>
        <button className="acc-btn" onClick={() => window.print()}>인쇄 · PDF로 저장</button>
        <span className="rp-hint">브라우저 인쇄 창에서 'PDF로 저장'을 고르면 파일로 남습니다.</span>
      </div>

      <div className="rp-page">
        {/* ── 머리 ── */}
        <header className="rp-head">
          <div className="rp-kicker">국토종합진단지수 · EDA 대시보드 분석 리포트</div>
          <h1>{sName} 부문지수 산출 결과</h1>
          <div className="rp-meta">
            <span>기준 {today}</span><span>전국 {N}개 시군구</span>
            <span>표준화 {m.label}{method === 'minmaxA' ? ` (α=${alpha})` : ''}</span>
            <span>등급 {gradeMode === 'decile' ? '십분위' : '등간격'} 10등급</span>
          </div>
        </header>

        {/* ── ① 설정 요약 ── */}
        <section className="rp-sec">
          <h2>1. 산출 설정</h2>
          <table className="rp-tbl">
            <thead><tr>
              <th>지표</th><th>연도</th><th>방향</th><th>윈저라이징</th><th>변환</th><th>표준화</th><th>가중치</th>
            </tr></thead>
            <tbody>
              {result.stages.map((s, j) => (
                <tr key={s.pick.col}>
                  <td className="l">{s.pick.label}</td>
                  <td>{s.pick.year}</td>
                  <td>{s.cfg.dir === '+' ? 'P (높을수록 좋음)' : 'N (낮을수록 좋음)'}</td>
                  <td>{s.cfg.winsor.on ? `${s.cfg.winsor.lo}% · ${s.cfg.winsor.hi}%` : '안 함'}</td>
                  <td>{trLabel(s.cfg.transform)}</td>
                  <td>{s.cfg.std ? m.label : '미적용'}</td>
                  <td>{(result.weights[j] / wSum * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rp-note">
            부문지수 = 위 설정으로 표준화한 지표들의 가중 평균. 표준화 식 {m.formula} · 범위 {m.range}.
            빈칸 지표가 있는 지역은 남은 지표의 가중치를 다시 100으로 맞춰 평균했다.
          </p>
        </section>

        {/* ── ② 지도 ── */}
        <section className="rp-sec">
          <h2>2. 부문지수 지도 <em>분위수 7구간 · {m.label}</em></h2>
          <div className="rp-maprow">
            <SvgMap colorOf={colorOf} strokeColor="#ffffff" height={470} />
            <div className="rp-legend">
              <div className="rp-ramp">{ramp.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
              <div className="rp-ends"><span>낮음</span><span>높음</span></div>
              {st && (
                <dl className="rp-stats">
                  <div><dt>평균</dt><dd>{f1(st.mean)}</dd></div>
                  <div><dt>중위</dt><dd>{f1(st.med)}</dd></div>
                  <div><dt>최소</dt><dd>{f1(st.lo)}</dd></div>
                  <div><dt>최대</dt><dd>{f1(st.hi)}</dd></div>
                  <div><dt>표준편차</dt><dd>{f1(st.sd)}</dd></div>
                  <div><dt>왜도</dt><dd>{st.skew == null ? '—' : st.skew.toFixed(2)}</dd></div>
                </dl>
              )}
            </div>
          </div>
        </section>

        {/* ── ③ 상·하위 ── */}
        <section className="rp-sec rp-two">
          <div>
            <h2>3. 상위 10개 시군구</h2>
            <table className="rp-tbl">
              <thead><tr><th>순위</th><th>지역</th><th>지수</th><th>T점수</th><th>등급</th></tr></thead>
              <tbody>
                {rows.slice(0, 10).map((r) => (
                  <tr key={r.key}>
                    <td>{Math.round(r.rank)}</td><td className="l">{shortSido(r.sido)} {r.name}</td>
                    <td>{f1(r.ci)}</td><td>{f1(r.t)}</td><td>{r.grade}등급</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2>하위 10개 시군구</h2>
            <table className="rp-tbl">
              <thead><tr><th>순위</th><th>지역</th><th>지수</th><th>T점수</th><th>등급</th></tr></thead>
              <tbody>
                {rows.slice(-10).map((r) => (
                  <tr key={r.key}>
                    <td>{Math.round(r.rank)}</td><td className="l">{shortSido(r.sido)} {r.name}</td>
                    <td>{f1(r.ci)}</td><td>{f1(r.t)}</td><td>{r.grade}등급</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── ④ 등급 분포 ── */}
        <section className="rp-sec">
          <h2>4. 10등급 분포 <em>{gradeMode === 'decile' ? '십분위 — 각 등급 약 10%' : '등간격 — 값 범위 10등분'}</em></h2>
          <div className="rp-gbar">
            {gradeCount.map((c, i) => (
              <div key={i} className="rp-g">
                <i style={{ height: `${(c / maxG) * 64 + 4}px`, background: rampOf(palette, 10)[9 - i] }} />
                <b>{c}</b><u>{i + 1}등급</u>
              </div>
            ))}
          </div>
        </section>

        {/* ── ⑤ 민감도 ── */}
        <section className="rp-sec">
          <h2>5. 표준화 민감도 <em>Min-Max ↔ 백분위순위 순위 이동</em></h2>
          <p className="rp-note">
            같은 설정에서 표준화 방법만 바꿨을 때 순위가 10계단 이상 움직인 지역(민감)은
            전국 {N}곳 가운데 <b>{highs.length}곳</b>이다. 이동 폭 상위 10곳:
          </p>
          <table className="rp-tbl">
            <thead><tr><th>지역</th><th>Min-Max 순위</th><th>백분위순위 순위</th><th>이동 폭</th></tr></thead>
            <tbody>
              {movers.map((r) => (
                <tr key={r.key}>
                  <td className="l">{shortSido(r.sido)} {r.name}</td>
                  <td>{Math.round(result.rank.minmax?.[rowIndex(r.key)] ?? 0)}위</td>
                  <td>{Math.round(result.rank.pctrank?.[rowIndex(r.key)] ?? 0)}위</td>
                  <td>{r.camp}계단</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── ⑥ 전체 표 ── */}
        <section className="rp-sec">
          <h2>6. 전체 순위표 <em>{N}개 시군구 · {m.label}</em></h2>
          <div className="rp-full">
            {rows.map((r) => (
              <div key={r.key} className="rp-fr">
                <u>{Math.round(r.rank)}</u>
                <span>{shortSido(r.sido)} {r.name}</span>
                <b>{f1(r.ci)}</b>
                <i>{r.grade}</i>
              </div>
            ))}
          </div>
          <p className="rp-note">각 줄: 순위 · 지역 · 부문지수 · 10등급. 백분위 = (229 − 순위) ÷ 229 × 100.</p>
        </section>

        <footer className="rp-foot">
          <span>SAL · SPATIAL ANALYSIS LAB</span>
          <span>국토종합진단지수 EDA 대시보드 · {today}</span>
        </footer>
      </div>
    </div>
  )
}
