import { useMemo } from 'react'
import { SIDOS, rowsOfSido, rowKey, shortSido, sidoCount, ROWS } from '../lib/ssi.js'

// 행정구역으로 직접 찾아가는 조작부. 시도 → 시군구 2단 선택.
export default function RegionPicker({ sido, onSido, selected, onSelect }) {
  const list = useMemo(() => rowsOfSido(sido), [sido])
  const cur = useMemo(() => ROWS.find((r) => rowKey(r) === selected), [selected])

  return (
    <div className="rp">
      <div className="rp-row">
        <label className="rp-lab">시 · 도</label>
        <select className="rp-sel" value={sido || ''} onChange={(e) => onSido(e.target.value || null)}>
          <option value="">전국 {ROWS.length}</option>
          {SIDOS.map((s) => (
            <option key={s} value={s}>{shortSido(s)} {sidoCount(s)}</option>
          ))}
        </select>
      </div>
      <div className="rp-row">
        <label className="rp-lab">시 · 군 · 구</label>
        <select className="rp-sel" value={selected || ''}
          onChange={(e) => e.target.value && onSelect(e.target.value)}>
          {!cur && <option value="">선택</option>}
          {list.map((r) => (
            <option key={rowKey(r)} value={rowKey(r)}>
              {sido ? r.name : `${shortSido(r.sido)} ${r.name}`}
            </option>
          ))}
        </select>
      </div>
      {sido && (
        <button className="rp-clear" onClick={() => onSido(null)}>
          <b>{shortSido(sido)}</b>만 보는 중 · 전국으로
        </button>
      )}
    </div>
  )
}
