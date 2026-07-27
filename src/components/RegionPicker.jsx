import { useEffect, useMemo, useRef, useState } from 'react'
import { SIDOS, rowsOfSido, rowKey, shortSido, sidoCount, ROWS } from '../lib/ssi.js'

// 행정구역 선택 — "제품 조작부" 방식.
// 한 줄에 [라벨 ······ 현재값 ∨] 만 보이고, 누르면 그 줄 아래에서 목록이 펼쳐진다.
// 두 줄은 대등하지 않다. 위(시·도)가 정해져야 아래(시·군·구)가 열린다.
function Row({ id, open, onOpen, label, value, placeholder, locked, hint, children }) {
  return (
    <div className={`ctl-row${open ? ' open' : ''}${locked ? ' locked' : ''}`} data-ctl={id}>
      <button className="ctl-head" onClick={() => !locked && onOpen(open ? null : id)}
        disabled={locked} aria-expanded={open}>
        <span className="ctl-chev">{open ? '⌄' : '›'}</span>
        <span className="ctl-lab">{label}</span>
        <span className={`ctl-val${value ? '' : ' ph'}`}>{value || placeholder}</span>
      </button>
      {open && <div className="ctl-body">{children}</div>}
      {!open && hint && <div className="ctl-hint">{hint}</div>}
    </div>
  )
}

export default function RegionPicker({ sido, onSido, selected, onSelect }) {
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')
  const boxRef = useRef(null)

  const cur = useMemo(() => ROWS.find((r) => rowKey(r) === selected), [selected])
  // 시군구 목록의 범위 — 고른 시도, 없으면 지도에서 클릭한 지역의 시도
  const scope = sido || cur?.sido || null
  const list = useMemo(() => (scope ? rowsOfSido(scope) : []), [scope])
  const locked = !scope
  const shown = useMemo(
    () => (q ? list.filter((r) => r.name.includes(q)) : list),
    [list, q],
  )

  useEffect(() => { setQ('') }, [open, scope])
  // 바깥을 누르면 닫는다 — 조작부가 계속 열려 있어 시야를 먹지 않도록
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="rp2" ref={boxRef}>
      <Row id="sido" open={open === 'sido'} onOpen={setOpen}
        label="시 · 도" value={sido ? shortSido(sido) : '전국'}>
        <div className="opt-grid">
          <button className={`opt${!sido ? ' on' : ''}`}
            onClick={() => { onSido(null); setOpen(null) }}>
            <b>전국</b><i>{ROWS.length}</i>
          </button>
          {SIDOS.map((s) => (
            <button key={s} className={`opt${sido === s ? ' on' : ''}`}
              onClick={() => { onSido(s); setOpen('sgg') }}>
              <b>{shortSido(s)}</b><i>{sidoCount(s)}</i>
            </button>
          ))}
        </div>
      </Row>

      <div className={`ctl-link${locked ? ' locked' : ''}`} aria-hidden="true"><i /></div>

      <Row id="sgg" open={open === 'sgg'} onOpen={setOpen} locked={locked}
        label="시 · 군 · 구"
        value={cur && cur.sido === scope ? cur.name : null}
        placeholder={locked ? '시 · 도부터' : `${shortSido(scope)} 안에서`}
        hint={locked ? '시 · 도를 먼저 고르세요' : null}>
        {list.length > 8 && (
          <input className="opt-find" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`${shortSido(scope)} ${list.length}곳 중 찾기`} autoFocus />
        )}
        <div className="opt-list">
          {shown.map((r) => (
            <button key={rowKey(r)}
              className={`opt-li${rowKey(r) === selected ? ' on' : ''}`}
              onClick={() => { onSelect(rowKey(r)); setOpen(null) }}>
              {r.name}
            </button>
          ))}
          {!shown.length && <div className="opt-none">찾는 이름이 없습니다</div>}
        </div>
      </Row>

      {sido && (
        <button className="ctl-reset" onClick={() => onSido(null)}>
          지도 <b>{shortSido(sido)}</b>만 보는 중 · 전국으로
        </button>
      )}
      {!sido && scope && (
        <div className="ctl-note">지도는 전국 · 목록은 <b>{shortSido(scope)}</b> 기준</div>
      )}
    </div>
  )
}
