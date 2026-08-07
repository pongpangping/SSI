import { useMemo, useState } from 'react'
import {
  SECTORS, METHODS, N, methodOf, indsOf, sectorSummary,
  fmtRaw, stdSeries, indT, indRank, ciT, pctOf, rowIndex, rowKey,
} from '../lib/ssi.js'
import { cfgOf, weightOf, TRANSFORMS } from '../lib/eda.js'
import { rankRows } from './StatsExtras.jsx'

// 진단 보고서 (37차) — 작업요령 마지막 항목 "최종 레포트로 출력".
//
// 화면에 흩어져 있는 결과(지표 구성 · 전처리 · 표준화 방법 · 전국 요약 ·
// 민감도 · 선택 지역 진단 · 전체 순위)를 종이 한 벌로 정리한다.
// [인쇄 · PDF 저장]을 누르면 브라우저 인쇄 대화상자가 뜨고, 거기서
// 'PDF로 저장'을 고르면 파일이 된다. 표·수치는 지금 화면의 계산 결과
// 그대로다 — 보고서를 위해 다시 계산하지 않는다.

const f1 = (v) => (v == null ? '—' : v.toFixed(1))
const trLabel = (k) => TRANSFORMS.find((t) => t.key === k)?.label || '변환 없음'

function describe(vals) {
  const ok = vals.filter((x) => x != null && Number.isFinite(x))
  if (!ok.length) return null
  const n = ok.length
  const mean = ok.reduce((a, b) => a + b, 0) / n
  const s = [...ok].sort((a, b) => a - b)
  const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
  const sd = Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  return { n, mean, med, sd, min: s[0], max: s[n - 1] }
}

// 담을 내용 고르기 (38차) — 절 하나가 스위치 하나. 끄면 미리보기에서 바로
// 빠지고, 인쇄에도 나가지 않는다. 절 번호는 남은 절끼리 다시 매긴다.
const SEC_DEF = [
  ['cfg', '지표 구성 · 전처리'],
  ['method', '표준화 방법'],
  ['nation', '전국 요약 · 상하위 10곳'],
  ['sens', '표준화 민감도'],
  ['region', '선택 지역 진단'],
  ['ranks', '전체 순위표'],
]

export default function ReportDoc({ sector, method, selectedRow, onClose }) {
  const m = methodOf(method)
  const [sec, setSec] = useState({ cfg: true, method: true, nation: true, sens: true, region: true, ranks: true })
  const flip = (k) => setSec((s) => ({ ...s, [k]: !s[k] }))
  const inds = indsOf(sector)
  const rows = useMemo(() => rankRows(sector, method), [sector, method])
  const stat = useMemo(() => describe(rows.map((r) => r.ci)), [rows])
  const sum = sectorSummary(sector)
  const today = new Date()
  const dstr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

  const years = []
  inds.forEach((e) => { if (!years.includes(e.year)) years.push(e.year) })
  years.sort()
  const yr = years.length === 1 ? `${years[0]}년` : years.length > 1 ? `${years[0]}~${years[years.length - 1]}년` : ''

  // 선택 지역 진단에 쓸 값들
  const selIdx = selectedRow ? rowIndex(rowKey(selectedRow)) : -1
  const selD = selectedRow ? selectedRow[sector] : null

  // 절 번호 — 켜진 절끼리 위에서부터 다시 매긴다
  let no = 0
  const nx = () => { no += 1; return no }

  return (
    <div className="repo-veil" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="repo-tools">
        <div className="repo-tools-r1">
          <b>진단 보고서</b>
          <span>담을 내용을 고른 뒤 저장하세요. 인쇄 대화상자에서 'PDF로 저장'을 고르면 파일로 남습니다.</span>
          <button className="repo-print" onClick={() => window.print()}>인쇄 · PDF 저장</button>
          <button className="repo-x" onClick={onClose}>닫기 ✕</button>
        </div>
        <div className="repo-pick">
          <u>담을 내용</u>
          {SEC_DEF.map(([k, label]) => {
            const dead = k === 'region' && !(selectedRow && selD)
            return (
              <label key={k} className={`repo-ck${sec[k] && !dead ? ' on' : ''}${dead ? ' dead' : ''}`}
                title={dead ? '지도나 순위표에서 시군구를 골라 두면 담을 수 있습니다' : ''}>
                <input type="checkbox" checked={sec[k] && !dead} disabled={dead}
                  onChange={() => flip(k)} />
                {label}
              </label>
            )
          })}
        </div>
      </div>

      <div className="repo-doc">
        {/* 표지 머리 */}
        <div className="repo-head">
          <div className="repo-brand">SAL · Spatial Analysis Lab</div>
          <h1>국토종합진단지수 진단 보고서</h1>
          <div className="repo-sub">{SECTORS[sector].name}</div>
          <div className="repo-meta">
            <span>지표 {inds.length}개 · {yr}</span>
            <span>표준화 {m.label}</span>
            <span>전국 {N}개 시군구</span>
            <span>작성 {dstr}</span>
          </div>
        </div>

        {/* 지표 구성과 전처리 */}
        {sec.cfg && (
        <section>
          <h2>{nx()}. 지표 구성과 전처리</h2>
          <table className="repo-tbl">
            <thead><tr>
              <th>지표</th><th>연도</th><th>단위</th><th>방향</th><th>변환</th><th>윈저라이징</th><th>가중치</th>
            </tr></thead>
            <tbody>
              {inds.map((e) => {
                const c = cfgOf(e.col, e.dir)
                const w = weightOf(sector, e.col, inds.length)
                return (
                  <tr key={e.col}>
                    <td className="tl">{e.name || e.label}</td>
                    <td>{e.year}</td>
                    <td>{e.unit || '—'}</td>
                    <td>{c.dir === '+' ? 'P (높을수록 좋음)' : 'N (낮을수록 좋음)'}{c.dir !== e.dir ? ' *' : ''}</td>
                    <td>{trLabel(c.transform)}</td>
                    <td>{c.winsor?.on ? `${c.winsor.lo}~${c.winsor.hi}%` : '—'}</td>
                    <td>{(Math.round(w * 10) / 10)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="repo-note">* 표시는 기본 방향을 사용자가 바꾼 지표입니다. 변환·윈저라이징·가중치는
            2 · 4단계에서 정한 값이며, 지도·순위·통계가 모두 이 설정으로 계산되었습니다.</p>
        </section>
        )}

        {/* 표준화 방법 */}
        {sec.method && (
        <section>
          <h2>{nx()}. 표준화 방법</h2>
          <table className="repo-tbl">
            <thead><tr><th>방법</th><th>산식</th><th>범위</th></tr></thead>
            <tbody>
              {METHODS.map((x) => (
                <tr key={x.key} className={x.key === method ? 'on' : ''}>
                  <td className="tl">{x.label}{x.key === method ? ' (이 보고서 기준)' : ''}</td>
                  <td className="tl">{x.formula}</td>
                  <td>{x.range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        )}

        {/* 전국 요약 */}
        {sec.nation && (
        <section>
          <h2>{nx()}. 전국 요약 · {m.label} 부문점수</h2>
          {stat && (
            <div className="repo-stats">
              <div><span>평균</span><b>{f1(stat.mean)}</b></div>
              <div><span>중앙값</span><b>{f1(stat.med)}</b></div>
              <div><span>표준편차</span><b>{f1(stat.sd)}</b></div>
              <div><span>최고</span><b>{f1(stat.max)}</b></div>
              <div><span>최저</span><b>{f1(stat.min)}</b></div>
            </div>
          )}
          <div className="repo-2col">
            <div>
              <h3>상위 10곳</h3>
              <table className="repo-tbl slim">
                <thead><tr><th>순위</th><th>지역</th><th>점수</th></tr></thead>
                <tbody>
                  {rows.slice(0, 10).map((r) => (
                    <tr key={r.key}><td>{Math.round(r.rank)}</td>
                      <td className="tl">{r.sido} {r.name}</td><td>{f1(r.ci)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3>하위 10곳</h3>
              <table className="repo-tbl slim">
                <thead><tr><th>순위</th><th>지역</th><th>점수</th></tr></thead>
                <tbody>
                  {rows.slice(-10).map((r) => (
                    <tr key={r.key}><td>{Math.round(r.rank)}</td>
                      <td className="tl">{r.sido} {r.name}</td><td>{f1(r.ci)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        )}

        {/* 표준화 민감도 */}
        {sec.sens && (
        <section>
          <h2>{nx()}. 표준화 민감도</h2>
          <div className="repo-stats">
            <div><span>시군구</span><b>{sum.n}</b></div>
            <div><span>방법 간 평균 순위 이동</span><b>{sum.avg.toFixed(1)}계단</b></div>
            <div><span>10계단 이상 이동</span><b>{sum.over10}곳</b></div>
            <div><span>민감 지역</span><b>{sum.high}곳</b></div>
          </div>
          <p className="repo-note">네 가지 표준화 방법(Min-Max · 거리기반 · 백분위순위 · 로지스틱)으로 각각
            순위를 매겼을 때의 이동 폭입니다. 이동이 큰 지역일수록 순위가 방법 선택에 의존합니다.</p>
        </section>
        )}

        {/* 선택 지역 진단 */}
        {sec.region && selectedRow && selD && (
          <section>
            <h2>{nx()}. 선택 지역 진단 · {selectedRow.sido} {selectedRow.name}</h2>
            <div className="repo-stats">
              <div><span>전국 순위</span><b>{selD.rank[method] == null ? '—' : `${selD.rank[method]}위`}</b></div>
              <div><span>부문점수</span><b>{f1(selD.ci[method])}</b></div>
              <div><span>표준점수(T)</span><b>{f1(ciT(sector, method)[selIdx])}</b></div>
              <div><span>백분위</span><b>{pctOf(selD.rank[method]) == null ? '—' : `${pctOf(selD.rank[method]).toFixed(1)}%`}</b></div>
            </div>
            <table className="repo-tbl">
              <thead><tr><th>지표</th><th>원값</th><th>표준화값</th><th>표준점수(T)</th><th>지표순위</th></tr></thead>
              <tbody>
                {inds.map((e) => {
                  const rk = indRank(sector, e.label, method)[selIdx]
                  return (
                    <tr key={e.col}>
                      <td className="tl">{e.name || e.label}</td>
                      <td>{selD.raw[e.label] == null ? '—' : `${fmtRaw(selD.raw[e.label])}${e.unit || ''}`}</td>
                      <td>{f1(stdSeries(sector, e.label, method)[selIdx])}</td>
                      <td>{f1(indT(sector, e.label, method)[selIdx])}</td>
                      <td>{rk == null ? '—' : `${Math.round(rk)}위`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="repo-note">방법별 종합 순위 — {METHODS.map((x) =>
              `${x.label} ${selD.rank[x.key] == null ? '—' : `${selD.rank[x.key]}위`}`).join(' · ')}</p>
          </section>
        )}

        {/* 전체 순위표 */}
        {sec.ranks && (
        <section className="repo-full">
          <h2>{nx()}. 전체 순위 · {N}개 시군구</h2>
          <div className="repo-ranks">
            {rows.map((r) => (
              <div key={r.key} className="repo-rk">
                <u>{Math.round(r.rank)}</u><span>{r.sido} {r.name}</span><b>{f1(r.ci)}</b>
              </div>
            ))}
          </div>
        </section>
        )}

        {no === 0 && (
          <p className="repo-note" style={{ textAlign: 'center', padding: '30px 0' }}>
            담을 내용이 없습니다 — 위에서 하나 이상 골라 주세요.</p>
        )}

        <div className="repo-foot">
          국토종합진단지수 · {SECTORS[sector].name} · {m.label} 기준 · {dstr} ·
          Spatial Analysis Lab (SAL)
        </div>
      </div>
    </div>
  )
}
