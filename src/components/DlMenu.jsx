import { useEffect, useRef, useState } from 'react'
import { FORMATS, saveAs } from '../lib/statscsv.js'
import { Download } from './Glyph.jsx'

// 카드마다 붙는 내려받기 단추.
//
// 형식이 하나였을 때는 단추를 누르면 바로 떨어지는 편이 빨랐지만, 셋이 되면
// 무엇으로 받을지 고르는 자리가 있어야 한다. 목록은 CSV·Excel·PNG 세 줄이고
// 각 줄에 쓰임을 한마디씩 적어 둔다. 처음 여는 사람이 확장자만 보고 고르기는
// 어렵기 때문이다.
//
// PNG는 캔버스에 다시 그리느라 잠깐 걸린다. 그 사이 다시 눌러 두 장이 떨어지지
// 않도록 누르는 동안 목록을 잠근다.

export default function DlMenu({
  pack, elRef, cls = 'ccard-dl', tip, up = false, wide = false, label = '저장',
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const box = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); setErr('') } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const run = async (fmt) => {
    if (busy) return
    setBusy(fmt)
    setErr('')
    try {
      const p = typeof pack === 'function' ? pack() : pack
      if (!p) { setErr('지금 화면에 담을 값이 없습니다'); setBusy(''); return }
      const ok = await saveAs(fmt, p, { el: elRef?.current })
      if (!ok) { setErr('그림으로 만들지 못했습니다'); setBusy(''); return }
      setBusy('')
      setOpen(false)
    } catch (e) {
      setBusy('')
      setErr('저장하지 못했습니다')
    }
  }

  return (
    <div className={`dlm${open ? ' open' : ''}`} ref={box}>
      <button
        type="button"
        className={cls}
        aria-haspopup="menu"
        aria-expanded={open}
        title={tip || '표를 파일로 내려받기'}
        onClick={() => { setOpen(!open); setErr('') }}
      >
        <Download size={12} />{label}
      </button>

      {open && (
        <div className={`dlm-pop${up ? ' up' : ''}${wide ? ' wide' : ''}`} role="menu">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="menuitem"
              className="dlm-item"
              disabled={!!busy}
              onClick={() => run(f.key)}
            >
              <b>{f.label}</b>
              <code>{f.ext}</code>
              <em>{busy === f.key ? '만드는 중…' : f.hint}</em>
            </button>
          ))}
          {err && <div className="dlm-err">{err}</div>}
        </div>
      )}
    </div>
  )
}
