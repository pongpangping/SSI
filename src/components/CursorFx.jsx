import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// 마우스 포인터 — 있는 자리에 따라 모양이 바뀐다.
//   지도 위     : 조준점 (가는 원 + 사방 눈금 + 가운데 점)
//   조작·통계창 : 동그란 점 (누를 수 있는 것 위에서는 테두리가 벌어진다)
//   입력칸      : 손대지 않고 브라우저 기본 커서로 되돌린다
// 바깥 고리는 한 박자 늦게 따라와서 움직임에 무게가 생긴다.
// 손가락·펜으로 쓰는 기기(pointer: coarse)에서는 아예 켜지 않는다.
export default function CursorFx() {
  const ring = useRef(null)
  const dot = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return

    const root = document.documentElement
    root.classList.add('fx-cursor')

    // 목표 좌표(x,y)와 고리의 현재 좌표(rx,ry). 둘 사이를 매 프레임 조금씩 좁힌다.
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0, shown = false

    const FIELD = 'input, textarea, select, [contenteditable="true"]'
    const HIT = 'button, a, [role="button"], .acc2-item, .mg-op, .rp-item, .dt-tbl tbody tr, .sw-row, label'

    const setMode = (el) => {
      const onMap = !!el?.closest?.('.leaflet-container')
      const onField = !!el?.closest?.(FIELD)
      const onHit = !onMap && !!el?.closest?.(HIT)
      root.classList.toggle('fx-map', onMap)
      root.classList.toggle('fx-off', onField)
      root.classList.toggle('fx-hit', onHit)
    }

    const move = (e) => {
      x = e.clientX; y = e.clientY
      if (!shown) { shown = true; rx = x; ry = y; root.classList.add('fx-in') }
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      setMode(e.target)
    }
    const leave = () => { shown = false; root.classList.remove('fx-in') }
    const down = () => root.classList.add('fx-down')
    const up = () => root.classList.remove('fx-down')

    const tick = () => {
      rx += (x - rx) * 0.22           // 0.22 = 따라붙는 속도. 1이면 즉시, 작을수록 늘어진다
      ry += (y - ry) * 0.22
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('pointerup', up, { passive: true })
    document.addEventListener('mouseleave', leave)
    window.addEventListener('blur', leave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.removeEventListener('mouseleave', leave)
      window.removeEventListener('blur', leave)
      root.classList.remove('fx-cursor', 'fx-map', 'fx-off', 'fx-hit', 'fx-in', 'fx-down')
    }
  }, [])

  // 포인터는 화면 뿌리(body)에 그린다. 앱 안쪽에 두면, 화면 뿌리로 띄운 창
  // ('크게 보기' 같은)이 나중에 그려지면서 포인터를 덮어 버린다 — 기본 커서는
  // 이미 감춰 둔 터라, 그 창 안에서는 포인터가 통째로 사라진 것처럼 보인다.
  return createPortal(
    <>
      <div className="fxc fxc-ring" ref={ring} aria-hidden="true">
        {/* 조준점의 사방 눈금 — 지도 위에서만 뻗어 나온다 */}
        <i className="fxc-tk t" /><i className="fxc-tk r" />
        <i className="fxc-tk b" /><i className="fxc-tk l" />
      </div>
      <div className="fxc fxc-dot" ref={dot} aria-hidden="true" />
    </>,
    document.body,
  )
}
