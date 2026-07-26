import { useMemo } from 'react'
import { SIDOS, rowsOfSido, rowKey, shortSido, sidoCount, ROWS } from '../lib/ssi.js'

// 행정구역 선택 — 반드시 시·도를 먼저 고르고, 그 다음 그 안의 시·군·구를 고른다.
// 시·도를 고르기 전에는 시·군·구 칸이 잠겨 있다(229개를 한 줄에 늘어놓지 않는다).
export default function RegionPicker({ sido, onSido, selected, onSelect }) {
  const cur = useMemo(() => ROWS.find((r) => rowKey(r) === selected), [selected])
  // 시군구 목록의 범위 — 고른 시도, 없으면 지도에서 클릭한 지역의 시도
  const scope = sido || cur?.sido || null
  const list = useMemo(() => (scope ? rowsOfSido(scope) : []), [scope])
  const locked = !scope

  return (
    <div className="rp">
      <div className="rp-row sido">
        <label className="rp-lab">시 · 도</label>
        <select className="rp-sel" value={sido || ''}
          onChange={(e) => onSido(e.target.value || null)}>
          <option value="">전국 {ROWS.length}곳</option>
          {SIDOS.map((s) => (
            <option key={s} value={s}>{shortSido(s)} ({sidoCount(s)})</option>
          ))}
        </select>
      </div>

      <div className={`rp-arw${locked ? ' locked' : ''}`} aria-hidden="true">↓</div>

      <div className={`rp-row sgg${locked ? ' locked' : ''}`}>
        <label className="rp-lab">시·군·구</label>
        <select className="rp-sel" disabled={locked}
          value={cur && cur.sido === scope ? selected : ''}
          onChange={(e) => e.target.value && onSelect(e.target.value)}>
          {locked
            ? <option value="">← 시 · 도부터 고르세요</option>
            : <>
                {!(cur && cur.sido === scope) && <option value="">{shortSido(scope)} 안에서 고르기</option>}
                {list.map((r) => (
                  <option key={rowKey(r)} value={rowKey(r)}>{r.name}</option>
                ))}
              </>}
        </select>
      </div>

      {sido
        ? <button className="rp-clear" onClick={() => onSido(null)}>
            지도 <b>{shortSido(sido)}</b>만 보는 중 · 전국으로 되돌리기
          </button>
        : scope && <div className="rp-scope">지도는 전국 · 목록은 <b>{shortSido(scope)}</b> 기준</div>}
    </div>
  )
}
