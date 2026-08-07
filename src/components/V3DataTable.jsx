import { useEffect, useMemo, useState } from 'react'
import { ROWS, N, METHODS, METHOD_KEYS, pctFromRank } from '../lib/pipeline.js'
import DlMenu from './DlMenu.jsx'

// 전체 데이터표 — 머리줄에서 열리는 표 창 (v2 DT 조각 복원).
//
// 229개 시군구 × 지금 계산의 모든 열을 정렬·검색해 직접 확인하고,
// 같은 표를 CSV·Excel로 받는다. 열은 파이프라인 결과에서 그때그때 만든다:
// 방법별 부문지수·순위, T점수·백분위·10등급, 지표별 원값·표준화값,
// 민감도 셋(이동 폭·최대-최소·표준편차), 참고 플래그 둘.

const num = (x) => x != null && Number.isFinite(x)
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10)

export default function V3DataTable({ result, method, onClose }) {
  const [q, setQ] = useState('')
  const [sortI, setSortI] = useState(2)     // 기본: 현재 방법 부문지수
  const [asc, setAsc] = useState(false)

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const { cols, rows } = useMemo(() => {
    const cols = ['시도', '시군구']
    METHODS.forEach((m) => cols.push(`부문지수_${m.short || m.label}`))
    METHODS.forEach((m) => cols.push(`순위_${m.short || m.label}`))
    cols.push('T점수', '백분위', '10등급')
    result.stages.forEach((s) => cols.push(`${s.pick.label}_원값`, `${s.pick.label}_표준화`))
    cols.push('순위이동폭', '순위범위', '순위표준편차', '민감구분')
    if (result.stages.length >= 2) cols.push('지표간격차', '트레이드오프')
    const rows = ROWS.map((r, i) => {
      const o = [r.sido, r.name]
      METHOD_KEYS.forEach((mk) => o.push(r1(result.ci[mk]?.[i])))
      METHOD_KEYS.forEach((mk) => o.push(num(result.rank[mk]?.[i]) ? Math.round(result.rank[mk][i]) : null))
      o.push(r1(result.ciT[method]?.[i]), r1(pctFromRank(result.rank[method]?.[i])), result.grade[method]?.[i] ?? null)
      result.stages.forEach((s) => o.push(r1(s.raw[i]), r1(s.std[method]?.[i])))
      o.push(result.camp[i] ?? null, result.range[i] ?? null, r1(result.rstd[i]), result.flag[i] || '')
      if (result.stages.length >= 2) o.push(r1(result.spread[i]), result.tradeoff[i] ? 'Y' : 'N')
      return o
    })
    return { cols, rows }
  }, [result, method])

  const view = useMemo(() => {
    let v = rows
    const t = q.trim()
    if (t) v = v.filter((r) => String(r[0]).includes(t) || String(r[1]).includes(t))
    const dir = asc ? 1 : -1
    v = [...v].sort((a, b) => {
      const x = a[sortI], y = b[sortI]
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), 'ko') * dir
      return (x - y) * dir
    })
    return v
  }, [rows, q, sortI, asc])

  const clickSort = (i) => {
    if (sortI === i) setAsc(!asc)
    else { setSortI(i); setAsc(i <= 1) }
  }

  const pack = () => ({
    base: '국토종합진단지수_전체표', title: '전체 데이터표',
    sub: `전국 ${N}개 시군구 × ${cols.length}열 · 화면의 계산 결과 그대로`,
    cols, rows: view, pngCols: 9,
  })

  return (
    <div className="v3-modal" onClick={onClose}>
      <div className="v3-modal-body dtb" onClick={(e) => e.stopPropagation()}>
        <div className="v3-modal-head">
          <b>전체 데이터표 <em className="mono">{N}개 시군구 × {cols.length}열</em></b>
          <span className="dtb-tools">
            <input className="e5l-q mono" placeholder="시군구 찾기…" value={q}
              onChange={(e) => setQ(e.target.value)} />
            <DlMenu pack={pack} cls="ghost-btn" label="표 저장" wide />
            <button className="x" onClick={onClose}>✕</button>
          </span>
        </div>
        <p className="dtb-note">열 머리를 누르면 그 열로 정렬합니다(다시 누르면 반대 방향).
          T점수·백분위·10등급·표준화값은 지금 고른 방법 기준이고, 부문지수·순위는 다섯 방법이 모두 실립니다.</p>
        <div className="dtb-scroll">
          <table className="dtb-tbl mono">
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th key={c} className={sortI === i ? 'on' : ''} onClick={() => clickSort(i)}>
                    {c}{sortI === i ? (asc ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr key={`${r[0]}|${r[1]}`}>
                  {r.map((v, i) => <td key={i} className={i <= 1 ? 'l' : ''}>{v == null || v === '' ? '—' : v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
