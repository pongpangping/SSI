import { useMemo } from 'react'
import {
  distribution, shapeText, topBottom, bySido, contribution, summaryFoot,
} from '../lib/summary.js'
import { pctOf, SECTORS, methodOf, shortSido } from '../lib/ssi.js'

// 전국 요약 — 부문을 고르고 지표·방법을 정하면 가장 먼저 나오는 화면.
//
// 지도만으로는 '전체가 어떤 모양인가'가 안 보인다. 색이 일곱 칸으로 끊겨 있어
// 한 칸 안의 벌어짐이 지워지고, 상위·하위가 어디인지도 눈으로 세어야 한다.
// 그래서 값을 네 각도에서 한 번씩 요약해 둔다. 계산은 summary.js가 하고
// 여기서는 그리기만 한다.

const f1 = (x) => (x == null ? '—' : x.toFixed(1))
const f2 = (x) => (x == null ? '—' : x.toFixed(2))

// ── 1. 분포 요약 ─────────────────────────────────────────────────────
function Distribution({ sector, method, selectedRow, ver }) {
  const d = useMemo(() => distribution(sector, method), [sector, method, ver])
  if (!d) return <div className="empty-hint">계산할 값이 없습니다</div>

  const span = (d.max - d.min) || 1
  const at = (v) => ((v - d.min) / span) * 100
  const sv = selectedRow ? (selectedRow[sector]?.ci?.[method] ?? null) : null

  // 평균과 중앙값은 대개 붙어 있어 이름표가 겹친다. 가로로 가까운 것끼리는
  // 줄을 하나씩 내려 적고, 눈금선을 그만큼 길게 빼 어느 자리인지 남긴다.
  const marks = []
  const raw = [
    { cls: 'nsm-med', label: '중앙값', at: at(d.med) },
    { cls: 'nsm-mean', label: '평균', at: at(d.mean) },
  ]
  if (sv != null) raw.push({ cls: 'nsm-sel', label: '선택 지역', at: at(sv) })
  raw.sort((p, q) => p.at - q.at).forEach((k) => {
    let row = 0
    while (marks.some((o) => o.row === row && Math.abs(o.at - k.at) < 17)) row += 1
    marks.push({ ...k, row })
  })

  return (
    <div className="ns-dist">
      <div className="ns-figs">
        <span className="ns-fig"><em>평균</em><b>{f1(d.mean)}</b></span>
        <span className="ns-fig"><em>중앙값</em><b>{f1(d.med)}</b></span>
        <span className="ns-fig"><em>표준편차</em><b>{f1(d.sd)}</b></span>
        <span className="ns-fig"><em>최고</em><b>{f1(d.max)}</b></span>
        <span className="ns-fig"><em>최저</em><b>{f1(d.min)}</b></span>
        <span className="ns-fig"><em>중간 절반</em><b>{f1(d.q1)}~{f1(d.q3)}</b></span>
      </div>

      <div className="ns-hist">
        <div className="ns-hbars">
          {d.bins.map((b) => {
            const inSel = sv != null && sv >= b.from && (sv < b.to || b.i === d.bins.length - 1)
            return (
              <i key={b.i} className={inSel ? 'sel' : ''}
                style={{ height: `${Math.max(2, (b.n / d.peak) * 100)}%` }}
                title={`${b.from.toFixed(1)} ~ ${b.to.toFixed(1)} · ${b.n}곳`} />
            )
          })}
        </div>
        <div className="ns-hmark">
          {marks.map((k) => (
            <span key={k.cls} className={`nsm ${k.cls}`} style={{ left: `${k.at}%` }}>
              <i style={{ height: `${7 + k.row * 13}px` }} /><em>{k.label}</em>
            </span>
          ))}
        </div>
        <div className="ns-hax"><span>{f1(d.min)}</span><span>부문점수</span><span>{f1(d.max)}</span></div>
      </div>

      <div className="ns-say">{shapeText(d)}</div>
    </div>
  )
}

// ── 2. 상위·하위 열 곳 ───────────────────────────────────────────────
function TopBottom({ sector, method, selected, onSelect, ver }) {
  const { top, bottom, n } = useMemo(() => topBottom(sector, method, 10), [sector, method, ver])
  if (!n) return <div className="empty-hint">계산할 값이 없습니다</div>

  const Col = ({ cap, list, kind }) => (
    <div className={`ns-tbcol ns-${kind}`}>
      <div className="ns-tbcap">{cap}</div>
      <div className="ns-tbhead"><span>순위</span><span>시군구</span><span>점수</span><span>T점수</span></div>
      {list.map((x) => (
        <button key={x.key} className={`ns-tbrow${x.key === selected ? ' on' : ''}`}
          onClick={() => onSelect && onSelect(x.key)}
          title={`${x.sido} ${x.name} · 전국 ${n}곳 중 ${x.rank}위 (상위 ${pctOf(x.rank).toFixed(0)}%) · 순위 이동 ${x.camp ?? '—'}계단`}>
          <span className="ns-tbrk">{x.rank}</span>
          <span className="ns-tbnm">{x.name}<em>{shortSido(x.sido)}</em></span>
          <span className="ns-tbci">{f1(x.ci)}</span>
          <span className="ns-tbt">{f1(x.t)}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="ns-tb">
      <Col cap="위에서 열 곳" list={top} kind="up" />
      <Col cap="아래에서 열 곳" list={bottom} kind="dn" />
    </div>
  )
}

// ── 3. 시도별 평균 ───────────────────────────────────────────────────
function BySido({ sector, method, ver }) {
  const { list, lo, hi, nat } = useMemo(() => bySido(sector, method), [sector, method, ver])
  if (!list.length) return <div className="empty-hint">계산할 값이 없습니다</div>

  // 가로 눈금은 시도 평균이 놓인 폭보다 조금 넓게 잡는다. 막대 끝이 칸에
  // 딱 붙으면 어디가 최대인지 읽기 어렵다.
  const pad = ((hi - lo) || 1) * 0.18
  const a = lo - pad, b = hi + pad
  const at = (v) => ((v - a) / (b - a)) * 100

  return (
    <div className="ns-sido">
      <div className="ns-sdnote">
        시도 평균은 그 시도에 속한 시군구 부문점수의 단순 평균입니다. 인구나 면적으로
        가중하지 않았습니다 — 이 지수가 시군구를 한 단위로 세는 지수이기 때문입니다.
        시군구 수가 적은 시도는 한두 곳에 평균이 크게 흔들립니다.
      </div>
      <div className="ns-sdwrap">
        {list.map((s) => (
          <div key={s.sido} className="ns-sdrow" title={`${s.sido} · ${s.n}개 시군구 · 평균 ${f1(s.mean)} · 범위 ${f1(s.min)}~${f1(s.max)}`}>
            <span className="ns-sdrk">{s.order}</span>
            <span className="ns-sdnm">{shortSido(s.sido)}<em>{s.n}</em></span>
            <span className="ns-sdbar">
              <i style={{ width: `${at(s.mean)}%` }} />
              <u style={{ left: `${at(s.min)}%`, width: `${Math.max(0.6, at(s.max) - at(s.min))}%` }} />
              {/* 전국 평균 기준선 — 막대마다 같은 자리에 그어 어긋남을 막는다 */}
              <b style={{ left: `${at(nat)}%` }} />
            </span>
            <span className="ns-sdv">{f1(s.mean)}</span>
            <span className={`ns-sdgap${s.gap >= 0 ? ' up' : ' dn'}`}>
              {s.gap >= 0 ? '+' : '−'}{Math.abs(s.gap).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      <div className="ns-sdleg">
        <span><i className="lg-bar" />시도 평균</span>
        <span><i className="lg-rng" />그 시도 안의 최저~최고</span>
        <span><i className="lg-nat" />전국 평균 {f1(nat)}</span>
      </div>
    </div>
  )
}

// ── 4. 지표별 기여도 ─────────────────────────────────────────────────
function Contribution({ sector, method, ver }) {
  const rows = useMemo(() => contribution(sector, method), [sector, method, ver])
  if (!rows.length) return <div className="empty-hint">선택된 지표가 없습니다</div>

  const maxSd = Math.max(...rows.map((r) => r.sd || 0)) || 1

  return (
    <div className="ns-con">
      <div className="ns-connote">
        부문점수는 선택한 지표 {rows.length}개의 표준화값을 같은 무게로 평균한 값입니다.
        그래서 <b>몫</b>(평균을 얼마나 끌어올리는가)과 <b>순위 영향</b>(지역 간 차이를 얼마나
        만드는가)은 서로 다른 이야기입니다. 몫이 비슷해도, 편차가 큰 지표가 순위를 좌우합니다.
      </div>
      <div className="ns-ctbl">
        <div className="ns-cth">
          <span>지표</span><span>평균</span><span>편차</span>
          <span>순위 영향</span><span>몫</span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="ns-ctr" title={`${r.label}${r.year ? ` · ${r.year}년` : ''}${r.unit ? ` · ${r.unit}` : ''} · ${r.dir === '+' ? '높을수록 좋음' : '낮을수록 좋음'}`}>
            <span className="ns-cnm">
              <i className={r.dir === '+' ? 'up' : 'dn'}
                title={r.dir === '+' ? '높을수록 좋음' : '낮을수록 좋음'}>
                {r.dir === '+' ? '▲' : '▼'}</i>
              {r.name || r.label}{r.year && <em>{r.year}</em>}
            </span>
            <span className="ns-cnum">{f1(r.mean)}</span>
            <span className="ns-csd">
              <i style={{ width: `${Math.round(((r.sd || 0) / maxSd) * 100)}%` }} />
              <u>{f1(r.sd)}</u>
            </span>
            <span className="ns-ccor">
              <i style={{ width: `${Math.round(Math.abs(r.corr || 0) * 100)}%` }} />
              <u>{f2(r.corr)}</u>
            </span>
            <span className="ns-cshr">{r.share == null ? '—' : `${r.share.toFixed(1)}%`}</span>
          </div>
        ))}
      </div>
      <div className="ns-cfoot">
        <b>▲ ▼</b> 지표 방향 — ▼는 표준화 전에 값을 뒤집는 지표.&nbsp;
        <b>편차</b> 표준화값의 표준편차 — 이 지표가 지역을 얼마나 벌려 놓는가.&nbsp;
        <b>순위 영향</b> 지표 표준화값과 부문점수의 상관계수 — 1에 가까울수록 부문점수가
        이 지표를 따라간다.&nbsp;
        <b>몫</b> 지표 평균을 모두 더한 값에서 이 지표가 차지하는 비율.
      </div>
    </div>
  )
}

// ── 묶음 ─────────────────────────────────────────────────────────────
const BLOCKS = [
  { k: 'dist', t: '분포 요약', s: '전국 부문점수가 어떤 모양으로 퍼져 있는가', C: Distribution },
  { k: 'tb', t: '상위·하위 열 곳', s: '위아래 끝에 어디가 있는가 — 누르면 지도에서 선택됩니다', C: TopBottom },
  { k: 'sido', t: '시도별 평균 비교', s: '17개 시도를 평균으로 줄 세우면', C: BySido },
  { k: 'con', t: '지표별 기여도', s: '이 점수를 실제로 움직이는 지표는 무엇인가', C: Contribution },
]

export default function NationalSummary({
  sector, method, selected, selectedRow, onSelect, ver = 0, dlOf = null,
}) {
  return (
    <div className="nsum">
      <div className="nsum-head">
        <div className="nsh-t">
          <b>전국 요약</b>
          <em>{SECTORS[sector]?.name} · 표준화 {methodOf(method)?.label}</em>
        </div>
        <div className="nsh-s">
          지도에서 시군구를 고르기 전에, 전국이 어떤 모양인지부터 봅니다.
        </div>
      </div>

      {BLOCKS.map(({ k, t, s, C }) => (
        <section className="nsb" key={k}>
          <div className="nsb-h">
            <div className="nsb-tt"><b>{t}</b><em>{s}</em></div>
            {dlOf && dlOf(k)}
          </div>
          <C sector={sector} method={method} selected={selected}
            selectedRow={selectedRow} onSelect={onSelect} ver={ver} />
        </section>
      ))}

      <div className="nsum-foot">{summaryFoot(sector, method)}</div>
    </div>
  )
}
