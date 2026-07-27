import { useEffect, useMemo, useRef, useState } from 'react'
import { SIDOS, rowsOfSido, rowKey, shortSido, sidoCount, ROWS } from '../lib/ssi.js'

// 행정구역 선택 — "제품 조작부" 방식.
// 한 줄에 [라벨 ······ 현재값 ∨] 만 보이고, 누르면 그 줄 아래에서 목록이 펼쳐진다.
// 두 줄은 언제나 같은 범위를 가리킨다. 시·도가 '전국'이면 시·군·구 목록도 229곳 전부다.
// (전에는 시·도가 전국인데 아래 칸에 특정 시군구가 차 있어, 고르지도 않은 시도를 고른
//  것처럼 읽혔다. 위가 전국이면 아래도 전국에서 고른다 — 어긋날 자리를 없앤다.)
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
  // 시군구 목록의 범위 — 고른 시도가 있으면 그 안, 없으면 전국 229곳
  const scope = sido || null
  const list = useMemo(() => (scope ? rowsOfSido(scope) : ROWS), [scope])
  // 전국 목록에는 같은 이름이 여럿이다(중구·동구…). 시도 이름으로도 찾히게 한다.
  const shown = useMemo(
    () => (q ? list.filter((r) => r.name.includes(q) || shortSido(r.sido).includes(q)) : list),
    [list, q],
  )

  useEffect(() => { setQ('') }, [open, scope])
  // 펼친 목록이 조작부 아래로 잘리지 않게 그만큼 끌어올린다
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const row = boxRef.current?.querySelector('.ctl-row.open')
      // 229곳 목록이면 지금 고른 곳이 화면 밖에 있다 — 목록 안에서 먼저 찾아 놓는다
      const lst = row?.querySelector('.opt-list')
      const on = lst?.querySelector('.opt-li.on')
      if (lst && on) {
        lst.scrollTop += on.getBoundingClientRect().top - lst.getBoundingClientRect().top
          - lst.clientHeight / 2 + on.offsetHeight / 2
      }
      row?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }, 40)
    return () => clearTimeout(t)
  }, [open])
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

      <div className="ctl-link" aria-hidden="true"><i /></div>

      <Row id="sgg" open={open === 'sgg'} onOpen={setOpen}
        label="시 · 군 · 구"
        value={cur ? cur.name : null}
        placeholder={scope ? `${shortSido(scope)} 안에서` : '전국에서'}>
        {list.length > 8 && (
          <input className="opt-find" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`${scope ? shortSido(scope) : '전국'} ${list.length}곳 중 찾기`} autoFocus />
        )}
        <div className="opt-list">
          {shown.map((r) => (
            <button key={rowKey(r)}
              className={`opt-li${rowKey(r) === selected ? ' on' : ''}`}
              onClick={() => { onSelect(rowKey(r)); setOpen(null) }}>
              {r.name}
              {!scope && <em className="opt-sd">{shortSido(r.sido)}</em>}
            </button>
          ))}
          {!shown.length && <div className="opt-none">찾는 이름이 없습니다</div>}
        </div>
      </Row>

      {sido
        ? (
          <button className="ctl-reset" onClick={() => onSido(null)}>
            지도 <b>{shortSido(sido)}</b>만 보는 중 · 전국으로
          </button>
        )
        : cur && <div className="ctl-note">지도 · 목록 모두 <b>전국</b> 기준 · 고른 곳은 <b>{shortSido(cur.sido)} {cur.name}</b></div>}
    </div>
  )
}
