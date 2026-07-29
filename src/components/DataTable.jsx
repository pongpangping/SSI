import { useMemo, useState } from 'react'
import { ROWS, rowKey, sheetOrder, colMeta, flatValue, toCSV, META, SECTORS, SECTOR_KEYS } from '../lib/ssi.js'

// 부문 묶음은 데이터에서 만든다 — 부문이 8개로 늘어나면 단추도 8개가 된다.
const GROUPS = ['전체', ...SECTOR_KEYS.map((k) => `${k} ${SECTORS[k].name.replace(/\s/g, '')}`)]
const SECT_RE = new RegExp(`^(${SECTOR_KEYS.join('|')})_`)

export default function DataTable({ sector, onClose, selected, onSelect, ver = 0 }) {
  const [q, setQ] = useState('')
  const [grp, setGrp] = useState(GROUPS.find((g) => g.startsWith(sector)) || GROUPS[0])
  const [sortCol, setSortCol] = useState(`${sector}_SSI_camp`)
  const [desc, setDesc] = useState(true)
  const [onlyHigh, setOnlyHigh] = useState(false)

  const cols = useMemo(() => {
    const all = sheetOrder()
    if (grp === '전체') return all
    const p = grp.split(' ')[0]
    return all.filter((c) => c === '시도' || c === '시군구' || new RegExp(`^${p}_`).test(c))
  }, [grp, ver])

  const rows = useMemo(() => {
    let list = ROWS
    if (q.trim()) {
      const t = q.trim()
      list = list.filter((r) => r.name.includes(t) || r.sido.includes(t))
    }
    if (onlyHigh) list = list.filter((r) => r[sector]?.flag === 'high')
    const s = [...list].sort((a, b) => {
      const x = flatValue(a, sortCol), y = flatValue(b, sortCol)
      if (x == null) return 1
      if (y == null) return -1
      if (typeof x === 'string') return desc ? String(y).localeCompare(x, 'ko') : String(x).localeCompare(y, 'ko')
      return desc ? y - x : x - y
    })
    return s
  }, [q, onlyHigh, sortCol, desc, sector, ver])

  const download = () => {
    const blob = new Blob([toCSV(cols, rows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `표준화민감도_${grp.replace(/\s/g, '')}_${rows.length}행.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const head = (c) => {
    const m = colMeta(c)
    return `${c}\n${m ? `${m.desc}\n단위/범위: ${m.unit}\n산출: ${m.how}${m.note ? `\n비고: ${m.note}` : ''}` : ''}`
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>전체 데이터표 · 담은 조합으로 계산한 결과</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="dt-bar">
          <input className="dt-q" placeholder="시군구 · 시도 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="dt-seg">
            {GROUPS.map((g) => (
              <button key={g} className={grp === g ? 'on' : ''} onClick={() => setGrp(g)}>{g}</button>
            ))}
          </div>
          <button className={`dt-chk${onlyHigh ? ' on' : ''}`} onClick={() => setOnlyHigh(!onlyHigh)}>
            민감(high)만
          </button>
          <span className="dt-cnt">{rows.length} / {META.n}행 · {cols.length}열</span>
          <button className="dt-dl" onClick={download}>⬇ CSV 내보내기</button>
        </div>

        <div className="dt-scroll">
          <table className="dt-tbl">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c} title={head(c)}
                    className={`${sortCol === c ? 'on' : ''}${c === '시도' || c === '시군구' ? ' stick' : ''}`}
                    onClick={() => { if (sortCol === c) setDesc(!desc); else { setSortCol(c); setDesc(true) } }}>
                    {c.replace(SECT_RE, '')}
                    {sortCol === c && <i>{desc ? '▼' : '▲'}</i>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const k = rowKey(r)
                return (
                  <tr key={k} className={k === selected ? 'on' : ''} onClick={() => onSelect(k)}>
                    {cols.map((c) => {
                      const v = flatValue(r, c)
                      return (
                        <td key={c} className={`${c === '시도' || c === '시군구' ? 'stick' : ''}${v === 'high' ? ' hi' : ''}`}>
                          {typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(3)) : (v ?? '')}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="gl-note">
          열 머리글에 마우스를 올리면 설명·단위·산출방법·비고가 표시됩니다. 클릭하면 정렬, 행을 클릭하면 지도에서 선택됩니다. 원값 열은 지금 담아 둔 지표만 나옵니다.
        </div>
      </div>
    </div>
  )
}
