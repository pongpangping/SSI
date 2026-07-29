// 화면에 그린 것을 그림 파일(PNG)로 떨어뜨린다.
//
// 두 갈래다.
//  · 차트 카드 — recharts가 그린 <svg>를 그대로 떼어다 캔버스에 올린다.
//    화면과 같은 도형·같은 색이 나온다.
//  · 표 카드 — 화면의 HTML을 그림으로 옮기는 대신 값에서 표를 다시 그린다.
//    HTML을 캔버스로 옮기려면 바깥 라이브러리가 필요한데, 표는 줄과 글자뿐이라
//    직접 그리는 편이 결과도 깔끔하고 용량도 늘지 않는다.
//
// 어느 쪽이든 배경을 흰색으로 깔고 제목·부제·꼬리말을 붙인다. 보고서나 슬라이드에
// 그대로 얹었을 때 무엇을 그린 그림인지 따로 적지 않아도 되게 하기 위해서다.
// 해상도는 2배로 그린다. 인쇄하거나 확대해도 글자가 뭉개지지 않는다.

import { download } from './shpout.js'

const SCALE = 2
const FONT = "'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif"
const INK = '#0F172A'
const INK2 = '#3F4A5A'
const INK3 = '#8894A4'
const LINE = '#E3E9F0'
const HEAD_BG = '#EFF5FB'
const ZEBRA = '#FAFBFD'

const PAD = 18
const TITLE_H = 22
const SUB_H = 15

// 캔버스를 만들고 2배 눈금으로 맞춘다. 이후 그리기는 모두 CSS 픽셀 기준으로 한다.
function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.ceil(w * SCALE)
  c.height = Math.ceil(h * SCALE)
  const x = c.getContext('2d')
  x.scale(SCALE, SCALE)
  x.fillStyle = '#FFFFFF'
  x.fillRect(0, 0, w, h)
  x.textBaseline = 'middle'
  return { c, x }
}

// 제목·부제를 그리고 본문이 시작될 y를 돌려준다.
// 폭을 넘으면 잘라 낸다. 제목이 그림 밖으로 밀려나가 반만 보이는 것보다 낫다.
function drawHead(x, w, title, sub) {
  let y = PAD
  if (title) {
    x.font = `750 15px ${FONT}`
    x.fillStyle = INK
    x.textAlign = 'left'
    clipText(x, title, PAD, y + TITLE_H / 2, w - PAD * 2)
    y += TITLE_H
  }
  if (sub) {
    x.font = `500 11px ${FONT}`
    x.fillStyle = INK3
    x.textAlign = 'left'
    clipText(x, sub, PAD, y + SUB_H / 2, w - PAD * 2)
    y += SUB_H
  }
  return y + (title || sub ? 10 : 0)
}

// 꼬리말은 자르지 않고 줄을 바꾼다. 여기 적히는 것이 '무엇을 기준으로 뽑은
// 표인지'라서 뒷부분이 잘리면 남겨 둔 뜻이 사라진다.
const measure = (() => {
  let ctx = null
  return () => {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d')
    ctx.font = `400 10px ${FONT}`
    return ctx
  }
})()

function wrapNote(note, maxW) {
  if (!note) return []
  const src = Array.isArray(note) ? note : [note]
  const m = measure()
  const out = []
  src.forEach((raw) => {
    const words = String(raw).split(' ')
    let line = ''
    words.forEach((word) => {
      const t = line ? `${line} ${word}` : word
      if (line && m.measureText(t).width > maxW) { out.push(line); line = word } else line = t
    })
    out.push(line)
  })
  return out
}

function drawFoot(x, y, lines) {
  if (!lines.length) return y
  x.font = `400 10px ${FONT}`
  x.fillStyle = INK3
  x.textAlign = 'left'
  lines.forEach((t, i) => x.fillText(t, PAD, y + 8 + i * 14))
  return y + 8 + lines.length * 14
}

const noteH = (lines) => (lines.length ? lines.length * 14 + 8 : 0)

function toBlob(canvas) {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'))
}

/* ── 차트 카드 ─────────────────────────────────────────────────── */

// SVG를 떼어 내면 바깥 CSS가 따라오지 않는다. 화면에서는 스타일시트가 글자 크기와
// 색을 정해 주지만, 파일로 떨어진 SVG에는 그 규칙이 없어 전부 검은 16px로 그려진다.
// 그래서 글자마다 지금 적용된 값을 읽어 속성으로 박아 넣는다. recharts처럼 속성에
// 직접 적는 차트든, 클래스로 꾸민 손그림 차트든 같은 방법으로 살아난다.
const TEXT_PROPS = ['font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'fill', 'opacity']

function svgToUrl(svg, w, h) {
  const cl = svg.cloneNode(true)
  cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  cl.setAttribute('width', w)
  cl.setAttribute('height', h)
  if (!cl.getAttribute('viewBox')) cl.setAttribute('viewBox', `0 0 ${w} ${h}`)

  const src = svg.querySelectorAll('text, tspan')
  const dst = cl.querySelectorAll('text, tspan')
  for (let i = 0; i < dst.length && i < src.length; i++) {
    const cs = getComputedStyle(src[i])
    TEXT_PROPS.forEach((k) => {
      const v = cs.getPropertyValue(k)
      // 속성으로 이미 적혀 있으면 그쪽이 뜻한 바다. 덮어쓰지 않는다.
      if (v && !dst[i].hasAttribute(k)) dst[i].setAttribute(k, v.trim())
    })
  }

  const st = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  st.textContent = `text,tspan{font-family:${FONT};}`
  cl.insertBefore(st, cl.firstChild)
  const xml = new XMLSerializer().serializeToString(cl)
  // 한글이 들어가므로 btoa에 바로 넣으면 안 된다. UTF-8로 바꿔 넣는다.
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(xml)))
  return `data:image/svg+xml;base64,${b64}`
}

// 카드 안에서 '차트'는 recharts가 그린 것만 가리킨다. 아이콘도 svg라서
// 아무 svg나 집으면 표 카드의 조그만 아이콘을 그림으로 저장하게 된다.
export const chartSvgOf = (el) =>
  (el && el.querySelector ? el.querySelector('.recharts-surface, .rf-svg') : null)

export async function chartPng({ el, title, sub, note }) {
  const svg = chartSvgOf(el)
  if (!svg) return null
  const r = svg.getBoundingClientRect()
  const w0 = Math.round(r.width) || Number(svg.getAttribute('width')) || 480
  const h0 = Math.round(r.height) || Number(svg.getAttribute('height')) || 300

  const url = svgToUrl(svg, w0, h0)
  const img = await new Promise((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = url
  })

  const W = w0 + PAD * 2
  const foot = wrapNote(note, W - PAD * 2)
  const headH = (title ? TITLE_H : 0) + (sub ? SUB_H : 0) + (title || sub ? 10 : 0) + PAD
  const H = headH + h0 + noteH(foot) + PAD

  const { c, x } = makeCanvas(W, H)
  const y = drawHead(x, W, title, sub)
  x.drawImage(img, PAD, y, w0, h0)
  drawFoot(x, y + h0 + 4, foot)
  return toBlob(c)
}

/* ── 표 카드 ───────────────────────────────────────────────────── */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const cellText = (v) => (v == null || v === '' ? '—' : isNum(v) ? String(Math.round(v * 1000) / 1000) : String(v))

const ROW_H = 21
const CELL_PAD = 9
const MAX_ROWS = 60   // 이보다 길면 그림이 세로로 늘어져 못 쓴다. 전체는 표 파일로.

export async function tablePng({ title, sub, cols, rows, note }) {
  const all = rows || []
  const cut = all.length > MAX_ROWS
  const body = cut ? all.slice(0, MAX_ROWS) : all

  // 열 너비는 실제로 글자를 재서 정한다
  const meas = document.createElement('canvas').getContext('2d')
  const wOf = (t, bold) => { meas.font = `${bold ? 700 : 400} 11px ${FONT}`; return meas.measureText(t).width }

  const widths = cols.map((c, j) => {
    let m = wOf(String(c), true)
    body.forEach((r) => { m = Math.max(m, wOf(cellText(r[j]))) })
    return Math.min(190, Math.ceil(m) + CELL_PAD * 2)
  })
  const tableW = widths.reduce((a, b) => a + b, 0)

  const raw = []
  if (note) (Array.isArray(note) ? note : [note]).forEach((t) => raw.push(t))
  if (cut) raw.push(`위 ${MAX_ROWS}행만 그렸습니다. ${all.length}행 전체는 표 파일(Excel·CSV)로 받으세요.`)

  const W = Math.max(320, tableW) + PAD * 2
  const foot = wrapNote(raw, W - PAD * 2)
  const headH = (title ? TITLE_H : 0) + (sub ? SUB_H : 0) + (title || sub ? 10 : 0) + PAD
  const tableH = ROW_H * (body.length + 1)
  const H = headH + tableH + noteH(foot) + PAD

  const { c, x } = makeCanvas(W, H)
  let y = drawHead(x, W, title, sub)

  // 머리글
  x.fillStyle = HEAD_BG
  x.fillRect(PAD, y, tableW, ROW_H)
  x.font = `700 11px ${FONT}`
  x.fillStyle = INK
  let cx = PAD
  cols.forEach((cName, j) => {
    x.textAlign = 'left'
    clipText(x, String(cName), cx + CELL_PAD, y + ROW_H / 2, widths[j] - CELL_PAD * 2)
    cx += widths[j]
  })
  y += ROW_H

  // 본문
  body.forEach((r, i) => {
    if (i % 2 === 1) { x.fillStyle = ZEBRA; x.fillRect(PAD, y, tableW, ROW_H) }
    let px = PAD
    r.forEach((v, j) => {
      const num = isNum(v)
      x.font = `${num ? 500 : 400} 11px ${FONT}`
      x.fillStyle = num ? INK : INK2
      if (num) {
        x.textAlign = 'right'
        clipText(x, cellText(v), px + widths[j] - CELL_PAD, y + ROW_H / 2, widths[j] - CELL_PAD * 2)
      } else {
        x.textAlign = 'left'
        clipText(x, cellText(v), px + CELL_PAD, y + ROW_H / 2, widths[j] - CELL_PAD * 2)
      }
      px += widths[j]
    })
    x.strokeStyle = LINE
    x.lineWidth = 0.5
    x.beginPath(); x.moveTo(PAD, y + ROW_H - 0.25); x.lineTo(PAD + tableW, y + ROW_H - 0.25); x.stroke()
    y += ROW_H
  })

  drawFoot(x, y + 4, foot)
  return toBlob(c)
}

// 칸을 넘치면 … 로 줄인다. 표가 옆으로 무한정 늘어나지 않게.
function clipText(x, t, px, py, max) {
  let s = t
  if (x.measureText(s).width <= max) { x.fillText(s, px, py); return }
  while (s.length > 1 && x.measureText(`${s}…`).width > max) s = s.slice(0, -1)
  x.fillText(`${s}…`, px, py)
}

export function savePng(blob, name) {
  if (!blob) return false
  download(name.endsWith('.png') ? name : `${name}.png`, blob, 'image/png')
  return true
}
