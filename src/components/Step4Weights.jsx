import { useMemo } from 'react'

// 4단계 — 가중치.
//
// 기본은 동일 가중(현상 유지). 여기에 더해, 합이 100이 되는 가중치를 지표별로
// 직접 나눠 줄 수 있다(krihs 인터랙티브 리포트의 방식). 슬라이더를 움직이면
// 나머지 지표들이 남은 몫을 비율대로 나눠 가져 합은 언제나 100으로 유지된다.

const r1 = (x) => Math.round(x * 10) / 10

export default function Step4Weights({ entries, weights, onWeights }) {
  if (!entries.length) return <div className="v3-empty">0단계에서 지표를 먼저 골라 주세요.</div>
  const cols = entries.map((e) => e.col)
  const cur = cols.map((c) => (Number.isFinite(weights?.[c]) ? weights[c] : 100 / cols.length))
  const total = cur.reduce((a, b) => a + b, 0)
  const equal = useMemo(() => cur.every((w) => Math.abs(w - 100 / cols.length) < 0.05), [cur, cols.length])

  // 한 지표를 v로 바꾸면, 나머지가 (100 − v)를 기존 비율대로 나눠 가진다
  const setOne = (idx, v) => {
    const val = Math.max(0, Math.min(100, v))
    const restSum = cur.reduce((a, b, i) => (i === idx ? a : a + b), 0)
    const next = {}
    cols.forEach((c, i) => {
      if (i === idx) next[c] = r1(val)
      else next[c] = r1(restSum > 0 ? cur[i] * (100 - val) / restSum : (100 - val) / (cols.length - 1))
    })
    onWeights(next)
  }
  const reset = () => onWeights(Object.fromEntries(cols.map((c) => [c, r1(100 / cols.length)])))

  return (
    <div className="e4-wrap">
      <div className="v3-lede">
        기본은 동일 가중입니다. 슬라이더를 움직이면 나머지 지표가 남은 몫을 비율대로
        나눠 가져, 합은 항상 100으로 유지됩니다.
        <button className="ghost-btn" onClick={reset}>동일 가중으로 되돌리기</button>
      </div>

      <div className="g-card e4-card">
        <div className="e4-head mono">
          <span>합계 <b className={Math.abs(total - 100) < 0.5 ? 'ok' : 'warn'}>{r1(total)}</b> / 100</span>
          <span>{equal ? '동일 가중 (현상 유지)' : '사용자 가중'}</span>
        </div>
        {entries.map((e, i) => (
          <div key={e.col} className="e4-row">
            <div className="e4-name"><b>{e.label}</b><span className="mono">{e.year}년</span></div>
            <input type="range" min="0" max="100" step="0.5" value={cur[i]}
              onChange={(ev) => setOne(i, +ev.target.value)} />
            <label className="e4-num mono">
              <input type="number" min="0" max="100" step="0.5" value={r1(cur[i])}
                onChange={(ev) => setOne(i, +ev.target.value)} />%
            </label>
            <div className="e4-fill" style={{ width: `${cur[i]}%` }} />
          </div>
        ))}
        <p className="e4-note">빈칸(자료 없음)인 지표가 있는 지역은 남은 지표의 가중치를 다시 100으로 맞춰 평균합니다.</p>
      </div>
    </div>
  )
}
