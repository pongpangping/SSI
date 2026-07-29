import { iconOf } from '../lib/icons.js'
import { SECTORS } from '../lib/ssi.js'

// 부문 아이콘.
//
// 예전에는 ssi.json에 넣어 둔 글리프 문자(◫ ◈ △ …)를 그대로 찍었다. 글꼴이
// 없는 환경에서는 네모로 깨지고, 있어도 굵기와 세로 위치가 제각각이라 줄이
// 흔들렸다. 지금은 scripts/make_icons.py로 구운 PNG를 쓴다.
//
// state: '' 기본 · 'on' 지금 보고 있는 부문 · 'lock' 자료 준비중
export default function SectorIcon({ k, state, size = 15, title }) {
  const ready = SECTORS[k]?.ready
  const st = state !== undefined ? state : ready ? '' : 'lock'
  return (
    <img className={`sic${st ? ` sic-${st}` : ''}`} src={iconOf(k, st)}
      width={size} height={size} alt="" title={title} draggable="false" />
  )
}
