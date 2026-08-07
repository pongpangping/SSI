import { METHODS, methodOf } from '../lib/pipeline.js'
import { HistBars } from './EdaHist.jsx'

// 3단계 — 표준화.
//
// 2단계에서 변환·방향 정렬이 끝난 지표를 받아 다섯 방법(Min-Max · Min-Max ±α ·
// 거리기반 · 백분위순위 · 로지스틱)으로 각각 표준화하고, 229개 시군구 표준화값의
// 분포를 지표 × 방법 격자로 늘어놓는다. 여기서는 합성하지 않는다 — 방법마다
// 분포 모양이 어떻게 달라지는지 지표 단위로 먼저 보는 화면이다.
//
// 지표별로 '표준화 안 함'도 고를 수 있다. 이미 지수·점수 형태(0~100)로 들어온
// 자료를 그대로 쓰고 싶을 때를 위한 선택지다. 안 하면 그 지표는 방향 정렬까지만
// 된 값이 그대로 합성에 들어가므로, 눈금이 다른 지표와 섞이지 않게 경고를 붙인다.

export default function Step3Standardize({ entries, result, cfg, onCfg, method, onMethod, alpha, onAlpha }) {
  if (!entries.length) return <div className="v3-empty">0단계에서 지표를 먼저 골라 주세요.</div>
  const m = methodOf(method)
  return (
    <div className="e3-wrap">
      <div className="v3-lede">
        다섯 방법의 표준화값 분포를 지표별로 비교합니다. 열 하나가 방법 하나이고,
        열 머리를 누르면 그 방법이 선택됩니다. 합성은 다음 단계(가중치)에서 합니다.
      </div>

      <div className="e3-bar g-card">
        <u className="e2-cap">표준화 방법 — 아래 표의 열 머리를 눌러 고릅니다</u>
        <p className="e3-desc mono">지금 방법: {m.label} · {m.formula} · 범위 {m.range}</p>
        {method === 'minmaxA' && (
          <label className="e3-alpha mono">α =
            <input type="number" min="0.5" max="49" step="0.5" value={alpha}
              onChange={(e) => onAlpha(+e.target.value)} />
            (범위 α ~ 100−α, α &gt; 0)
          </label>
        )}
      </div>

      <div className="e3-grid" style={{ '--mcols': METHODS.length }}>
        <div className="e3-hrow">
          <div className="e3-hname">지표</div>
          {METHODS.map((mm) => (
            <button key={mm.key} className={`e3-hcell${method === mm.key ? ' cur' : ''}`}
              onClick={() => onMethod(mm.key)}
              title={`${mm.formula} · 범위 ${mm.range}`}>
              <i className="e3-dot" aria-hidden="true" />
              <b>{mm.label}</b><span className="mono">{mm.range}</span>
            </button>
          ))}
        </div>
        {result.stages.map((s) => {
          const e = s.pick
          return (
            <div key={e.col} className={`e3-row${s.cfg.std ? '' : ' off'}`}>
              <div className="e3-name">
                <b>{e.label}</b>
                <span className="mono">
                  {s.cfg.transform !== 'none' && <em>{s.cfg.transform === 'log' ? '로그화' : '반로그화'}</em>}
                  {s.cfg.winsor.on && <em>윈저 {s.cfg.winsor.lo}·{s.cfg.winsor.hi}%</em>}
                  <em className={s.cfg.dir === '+' ? 'p' : 'n'}>{s.cfg.dir === '+' ? 'P' : 'N'}</em>
                </span>
                <div className="seg mini">
                  <button className={s.cfg.std ? 'on' : ''}
                    onClick={() => onCfg(e.col, { ...s.cfg, std: true })}>표준화</button>
                  <button className={!s.cfg.std ? 'on' : ''}
                    onClick={() => onCfg(e.col, { ...s.cfg, std: false })}>안 함</button>
                </div>
                {!s.cfg.std && <div className="e2-note warn">방향 정렬까지만 한 값이 그대로 합성에 들어갑니다. 눈금이 0~100이 아니면 다른 지표와 비중이 어긋납니다.</div>}
              </div>
              {METHODS.map((mm) => (
                <div key={mm.key} className={`e3-cell${method === mm.key ? ' cur' : ''}`}>
                  {s.cfg.std
                    ? <HistBars values={s.std[mm.key]} bins={22} h={56} color="var(--acc)" />
                    : <div className="e3-skip mono">미적용</div>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
