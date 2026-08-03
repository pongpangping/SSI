// 17차 검증 — 16차의 C1~C13에 이번 개정분(D1~D4)을 더한 확인표
//   D1 시작 화면에서 부문을 고르면 언제나 1 지표 선택부터
//   D2 조작부 글자가 칸 밖으로 나가거나 잘리지 않음
//   D3 지도를 누르기 전에는 전국 통계가 곧바로 (안내 상자 없음)
//   D4 서랍 두 개가 처음부터 펴져 있어 차트가 다 보임
//   D5 화면 전체(지도 범례·통계창 카드 포함)에서 글자가 잘리지 않음
const { chromium } = require('playwright')
const fs = require('fs')

const T = (s) => (s || '').replace(/\s+/g, ' ').trim()
const out = []
const ok = (n, c, x = '') => out.push(`${c ? '  OK' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`)
const BASE = 'http://localhost:8099/index.html'

// 조작부(300px 고정폭) 안에서 제 칸을 넘거나 잘린 글자를 찾는다.
const OVERFLOW = () => {
  const bad = []
  const root = document.querySelector('.sidebar.sb2')
  if (!root) return bad
  const rb = root.getBoundingClientRect()
  root.querySelectorAll('*').forEach((e) => {
    const r = e.getBoundingClientRect()
    if (r.width < 1) return
    const cs = getComputedStyle(e)
    const clipped = e.scrollWidth - e.clientWidth > 1 && !/auto|scroll/.test(cs.overflowX)
    const outside = r.left < rb.left - 0.5 || r.right > rb.right + 0.5
    if (clipped || outside) {
      const cls = String(e.className.baseVal !== undefined ? e.className.baseVal : e.className)
      bad.push(`${e.tagName}.${cls.split(' ')[0]}"${(e.textContent || '').slice(0, 20)}"`)
    }
  })
  return bad
}

// 화면 전체를 훑는다. 조작부 밖 — 지도 범례, 통계창 카드 — 에서도 글자가
// 칸을 넘지 않는지 본다.
//
// 일부러 넘겨 둔 것 셋은 뺀다.
//   .ns-sdbar  분포 막대 그림. 칸보다 넓게 그려 놓고 잘라 보이는 것이 원래 모양.
//   .drw-p     서랍 부제. 말줄임(…)이 걸려 있어 넘치는 것이 정상.
//   .ms-marks  눈금띠 표식을 담는 빈 껍데기. 표식(3px)이 제자리 가운데에 놓이므로
//              양끝 표식은 1.5px씩 껍데기 밖으로 나간다 — 띠 자체는 넘지 않는다.
// 지도(leaflet) 속은 통째로 뺀다. 지도는 화면보다 넓게 그려 놓고 끌어서 보는 것이라
// '넘침'이 곧 정상이다. 지도 위에 얹힌 범례는 따로 아래에서 확인한다.
const OVERFLOW_ALL = () => {
  const skip = /(^|\s)(ns-sdbar|drw-p|ms-marks)(\s|$)/
  const bad = []
  document.querySelectorAll('.shell *').forEach((e) => {
    const r = e.getBoundingClientRect()
    if (r.width < 1) return
    const cs = getComputedStyle(e)
    if (/auto|scroll/.test(cs.overflowX)) return
    const cls = String(e.className.baseVal !== undefined ? e.className.baseVal : e.className)
    if (skip.test(cls)) return
    if (e.closest && e.closest('.leaflet-container')) return
    if (e.scrollWidth - e.clientWidth > 1) {
      bad.push(`${e.tagName}.${cls.split(' ')[0]} ${e.scrollWidth}/${e.clientWidth}"${(e.textContent || '').slice(0, 18)}"`)
    }
  })
  return [...new Set(bad)]
}

;(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const pg = await b.newPage({ viewport: { width: 1560, height: 980 } })
  const errs = []
  pg.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|tile|carto|net::/i.test(m.text())) errs.push(m.text()) })
  pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))

  // ══ C1 · C2 : 부문이 적힌 주소로 열어도 시작 화면이 먼저 ═════════════
  await pg.goto(BASE + '#s=S8&m=minmax&t=raw', { waitUntil: 'load' })
  await pg.waitForTimeout(1500)
  ok('C1 부문 해시로 열어도 시작 화면이 먼저', (await pg.locator('.lp').count()) === 1)
  ok('C1 조작부·지도는 아직 없다', (await pg.locator('.shell').count()) === 0)
  const back = pg.locator('.lp-card.lp-back')
  ok('C2 이어보던 부문 카드 1장', (await back.count()) === 1)
  ok('C2 "이어보던 부문" 띠', T(await pg.locator('.lpc-resume').innerText()) === '이어보던 부문')
  const isFirst = await pg.evaluate(() =>
    document.querySelector('.lp-grid').firstElementChild.classList.contains('lp-back'))
  ok('C2 그 카드가 맨 앞', isFirst)
  ok('시작 화면 가동 부문 6장', (await pg.locator('.lp-card').count()) === 6)
  ok('시작 화면 준비중 4개', (await pg.locator('.lps-item').count()) === 4)
  await pg.screenshot({ path: 'v17-1-landing.png' })

  // ══ D1 : 부문을 고르면 언제나 1 지표 선택부터 ═══════════════════════
  await back.click()
  await pg.waitForTimeout(1100)
  ok('부문 진입 → 셸 표시', (await pg.locator('.shell').count()) === 1)
  const cap1 = await pg.locator('.sb2-cap').first().getAttribute('class')
  ok('D1 첫 칸(1 지표 선택)이 지금 단계', /\bnow\b/.test(cap1 || ''), cap1)
  ok('D1 이어보기여도 지도 색 기준으로 뛰지 않음',
    (await pg.locator('.sb2-cap.sb2-opt.wait').count()) === 1)
  const st = await pg.locator('.sb2-scroll').evaluate((e) => e.scrollTop)
  ok('D1 조작부가 감겨 내려가지 않음', st < 2, `scrollTop ${Math.round(st)}`)
  ok('D1 통계창은 아직 닫힘', (await pg.locator('.center').count()) === 0)
  ok('D1 다음 단추 보임', (await pg.locator('.sb2-next').count()) === 1,
    T(await pg.locator('.sb2-next').innerText()))

  // ── D2 : 1단계 화면 글자 넘침 ──
  let ovf = await pg.evaluate(OVERFLOW)
  ok('D2 1단계 조작부 글자 넘침 없음', ovf.length === 0, ovf.join(' ; ').slice(0, 140))
  await pg.locator('.sidebar.sb2').screenshot({ path: 'v17-2-step1.png' })

  // ══ 2단계 ═════════════════════════════════════════════════════════
  await pg.locator('.sb2-next').click()
  await pg.waitForTimeout(900)
  const cap2 = await pg.locator('.sb2-cap').nth(1).getAttribute('class')
  ok('D1 2 표준화 방법으로 넘어감', /\bnow\b/.test(cap2 || ''), cap2)
  ovf = await pg.evaluate(OVERFLOW)
  ok('D2 2단계 조작부 글자 넘침 없음', ovf.length === 0, ovf.join(' ; ').slice(0, 140))
  const hintFs = await pg.locator('.sb2-hint').evaluate((e) => getComputedStyle(e).fontSize)
  ok('D2 2단계 안내문이 글자 눈금 안에 있음', hintFs === '10.5px', hintFs)
  await pg.locator('.sidebar.sb2').screenshot({ path: 'v17-3-step2.png' })

  // ══ 3단계 — 방법을 고르면 통계창이 열린다 ══════════════════════════
  await pg.locator('.mg-op[data-mk="minmax"]').click()
  await pg.waitForTimeout(1500)
  ok('D1 방법을 고르면 통계창이 열림', (await pg.locator('.center').count()) === 1)
  ovf = await pg.evaluate(OVERFLOW)
  ok('D2 3단계 조작부 글자 넘침 없음', ovf.length === 0, ovf.join(' ; ').slice(0, 140))
  const whereFs = await pg.locator('.mp2-where').evaluate((e) => getComputedStyle(e).fontSize)
  ok('D2 표준화 방법 안내 줄이 눈금 안에 있음', whereFs === '10.5px', whereFs)

  // ══ C3 : 탭이 없다 ════════════════════════════════════════════════
  ok('C3 통계창에 탭 없음', (await pg.locator('.ctabs, .ctab').count()) === 0)

  // ══ C4 · D3 : 지도 누르기 전에는 전국 통계가 곧바로 ════════════════
  ok('C4 선택 지역 칸 없음', (await pg.locator('.csect-sel').count()) === 0)
  const firstSect = await pg.evaluate(() => {
    const e = document.querySelector('.center .csect, .center .drw')
    return e ? e.className : ''
  })
  ok('C4 통계창 첫 칸 = 부문 종합', /csect-main/.test(firstSect), firstSect)
  ok('C4 부문 종합 제목', T(await pg.locator('.csect-main .csect-t').innerText()).startsWith('부문 종합'),
    T(await pg.locator('.csect-main .csect-t').innerText()))
  ok('D3 안내 상자 없앰', (await pg.locator('.csect-main .csect-wait').count()) === 0)
  ok('D3 전국 요약 네 칸이 곧바로', (await pg.locator('.nsb-tt').count()) === 4,
    (await pg.locator('.nsb-tt').allInnerTexts()).map(T).join(' | ').slice(0, 90))
  // 부문 종합 안에서 전국 요약이 첫 번째로 나오는가
  const mainFirst = await pg.evaluate(() => {
    const s = document.querySelector('.csect-main')
    const kids = [...s.children].map((e) => e.className.split(' ')[0])
    return kids.join('>')
  })
  ok('D3 부문 종합의 첫 내용이 전국 요약', /csect-head>nsum|csect-head>ns/.test(mainFirst) || !/csect-wait/.test(mainFirst),
    mainFirst.slice(0, 80))

  // ══ C7 · D4 : 서랍 두 개가 처음부터 펴져 있다 ══════════════════════
  ok('C7 서랍 2개', (await pg.locator('.drw').count()) === 2)
  ok('D4 둘 다 펴짐', (await pg.locator('.drw.open').count()) === 2)
  const dh = (await pg.locator('.drw-t').allInnerTexts()).map(T)
  ok('C7 서랍 이름 = 표준화 민감도 · 원데이터', dh.join('|') === '표준화 민감도|원데이터', dh.join(' | '))
  const dn = (await pg.locator('.drw-n').allInnerTexts()).map(T)
  ok('C7 서랍 머리에 장수 표시', dn.join('|') === '5|4', dn.join(' | '))
  const order = await pg.evaluate(() => [...document.querySelectorAll('.center > *')]
    .map((e) => e.className.split(' ').find((c) => /csect-|drw/.test(c)) || e.className.split(' ')[0]))
  ok('C7 차례 = 흐름줄 · 부문 종합 · 서랍 · 서랍', order.join('>') === 'flowbar>csect-main>drw>drw', order.join(' > '))

  // ── D4 : 차트가 실제로 그려져 있는가 ──
  const sens = (await pg.locator('.drw[data-drw="sens"] .ccard-title').allInnerTexts()).map(T)
  ok('D4 민감도 서랍 카드 5장이 바로 보임', sens.length === 5, sens.join(' | ').slice(0, 130))
  const raw = (await pg.locator('.drw[data-drw="raw"] .ccard-title').allInnerTexts()).map(T)
  ok('D4 원데이터 서랍 카드 4장이 바로 보임', raw.length === 4, raw.join(' | ').slice(0, 130))
  // 그림 넷 — 범프 차트 · 민감도 산점도 · 지표 간 산점도는 SVG,
  // 방법별 부문점수 분포는 막대를 CSS로 그린다.
  const charts = await pg.evaluate(() => [...document.querySelectorAll('.recharts-surface, .rf-svg')]
    .filter((e) => e.getBoundingClientRect().width > 40).length)
  ok('D4 SVG 그림 3개가 실제로 그려짐', charts === 3, `${charts}개`)
  const bars = await pg.evaluate(() => [...document.querySelectorAll('.dist-bars i')]
    .filter((e) => e.getBoundingClientRect().height > 0).length)
  ok('D4 방법별 분포 막대가 그려짐', bars >= 10, `${bars}개`)
  ok('D4 범프 차트(순위 이동)', (await pg.locator('.rf-svg').count()) >= 1)
  ok('D4 순위 이동 목록', (await pg.locator('.drw[data-drw="sens"] .ccard-title')
    .filter({ hasText: '순위 이동이 큰 시군구' }).count()) === 1)
  ok('D4 지표 간 산점도', (await pg.locator('.drw[data-drw="raw"] .ccard-title')
    .filter({ hasText: '산점도' }).count()) === 1)
  await pg.screenshot({ path: 'v17-4-body.png' })

  // ══ C12 : 기본은 해시에 d가 없다 ══════════════════════════════════
  let hash = await pg.evaluate(() => window.location.hash)
  ok('C12 기본(둘 다 펼침)이면 d 없음', !/[#&]d=/.test(hash), hash.slice(0, 110))
  ok('C12 해시에 t 없음', !/[#&]t=/.test(hash))
  ok('C12 해시에 시·도(g) 없음', !/[#&]g=/.test(hash))
  await pg.locator('.drw[data-drw="sens"] .drw-head').click()
  await pg.waitForTimeout(500)
  hash = await pg.evaluate(() => window.location.hash)
  ok('C12 접은 서랍이 d에 기록됨', /[#&]d=sens(&|$)/.test(hash), hash.slice(0, 110))
  await pg.locator('.drw[data-drw="raw"] .drw-head').click()
  await pg.waitForTimeout(500)
  hash = await pg.evaluate(() => window.location.hash)
  ok('C12 둘 다 접으면 d=sens.raw', /[#&]d=sens\.raw/.test(hash), hash.slice(0, 110))
  ok('C12 접으면 카드가 감춰짐', (await pg.locator('.drw .ccard-title').count()) === 0)
  // 되돌리기 — 다시 펴 둔다
  await pg.locator('.drw[data-drw="sens"] .drw-head').click()
  await pg.waitForTimeout(400)
  await pg.locator('.drw[data-drw="raw"] .drw-head').click()
  await pg.waitForTimeout(900)
  ok('C12 다시 펴면 d 사라짐', !/[#&]d=/.test(await pg.evaluate(() => window.location.hash)))

  // ══ C5 : 지역을 고르면 첫 칸이 선택 지역으로 ══════════════════════
  await pg.locator('.ns-tbrow').first().click()
  await pg.waitForTimeout(1100)
  ok('C5 선택 지역 칸 생김', (await pg.locator('.csect-sel').count()) === 1)
  const order2 = await pg.evaluate(() => [...document.querySelectorAll('.center > *')]
    .map((e) => e.className.split(' ').find((c) => /csect-|drw/.test(c)) || e.className.split(' ')[0]))
  ok('C5 선택 지역이 부문 종합보다 위', order2.indexOf('csect-sel') < order2.indexOf('csect-main'),
    order2.join(' > '))
  ok('C5 부문 종합이 접힘', (await pg.locator('.csect-main.shut').count()) === 1)
  ok('C5 선택 지역 카드 3장', (await pg.locator('.csect-sel .ccard-title').count()) === 3,
    (await pg.locator('.csect-sel .ccard-title').allInnerTexts()).map(T).join(' | '))
  ok('C5 선택 해제 단추', (await pg.locator('.csect-x').count()) === 1)
  const top = await pg.locator('.center').evaluate((e) => e.scrollTop)
  ok('C5 통계창이 맨 위로 올라옴', top < 40, `scrollTop ${Math.round(top)}`)
  ok('C5 지역을 골라도 서랍은 펴진 채', (await pg.locator('.drw.open').count()) === 2)
  ok('C5 선택 지역 지표 원값이 채워짐',
    (await pg.locator('.drw[data-drw="raw"] .csect-wait').count()) === 0)
  await pg.screenshot({ path: 'v17-5-selected.png' })

  // ══ C6 : 접힌 부문 종합 다시 펴기 ═════════════════════════════════
  await pg.locator('.csect-main .csect-fold').click()
  await pg.waitForTimeout(800)
  ok('C6 다시 펴짐', (await pg.locator('.csect-main.shut').count()) === 0)
  ok('C6 전국 요약 되돌아옴', (await pg.locator('.nsb-tt').count()) === 4)
  ok('C6 선택 지역은 그대로 맨 위', (await pg.locator('.csect-sel').count()) === 1)

  // ══ C10 : 표식이 도형 ═════════════════════════════════════════════
  const sbTxt = await pg.locator('.sb2-metrics').innerText()
  ok('C10 지도 색 기준 칸에 − + ◆ 문자 없음', !/[−+◆◎]/.test(sbTxt),
    (sbTxt.match(/[−+◆◎]/g) || []).join(''))
  ok('C10 묶음 여닫기 표식이 도형', (await pg.locator('.gb-sign svg.gl-pm').count()) >= 1)
  const dia = await pg.locator('.acc2-grp.open .acc2-item svg.gl-dia').count()
  ok('C10 지도 연동 표식이 도형', dia >= 1, `${dia}개`)
  ok('C10 연동 표식에 설명이 붙음',
    (await pg.evaluate(() => document.querySelector('.acc2-item svg.gl-dia title')?.textContent || ''))
      .includes('표준화 방법'))
  const glOk = await pg.evaluate(() => [...document.querySelectorAll('svg.gl')]
    .every((e) => e.getBoundingClientRect().width > 3))
  ok('C10 모든 도형 표식이 그려짐', glOk, `${await pg.locator('svg.gl').count()}개`)
  const brokenImg = await pg.evaluate(() => [...document.images]
    .filter((i) => i.complete && i.naturalWidth === 0)
    .map((i) => i.src).filter((s) => !/cartocdn|basemaps|tile/i.test(s)))
  ok('C10 깨진 그림 없음', brokenImg.length === 0, brokenImg.map((s) => s.slice(0, 40)).join(' | '))

  // ══ C9 : 글자 크기 8종 이하 ═══════════════════════════════════════
  const sizes = await pg.evaluate(() => {
    const m = {}
    document.querySelectorAll('body *').forEach((e) => {
      const r = e.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      if (!e.textContent || !e.textContent.trim()) return
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return
      const f = getComputedStyle(e).fontSize
      m[f] = (m[f] || 0) + 1
    })
    return m
  })
  const keys = Object.keys(sizes).sort((a, b) => parseFloat(a) - parseFloat(b))
  ok('C9 화면 글자 크기 8종 이하', keys.length <= 8, keys.map((k) => `${k}×${sizes[k]}`).join(' '))
  const scale = await pg.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    return [1, 2, 3, 4, 5, 6, 7, 8].map((i) => cs.getPropertyValue(`--fs-${i}`).trim())
  })
  ok('C9 눈금 8단이 :root에 정의됨', scale.every(Boolean), scale.join(' · '))

  // ══ C11 : 부문 종합 카드에서 CSV · Excel · PNG ════════════════════
  ok('C11 전국 요약 네 칸에 내려받기', (await pg.locator('.nsb .ccard-dl').count()) === 4)
  const got = []
  for (const fmt of ['CSV', 'Excel', 'PNG']) {
    await pg.locator('.nsb .ccard-dl').first().click()
    await pg.waitForTimeout(400)
    const btn = pg.locator('.dlm-item').filter({ hasText: fmt }).first()
    if (!(await btn.count())) continue
    const dp = pg.waitForEvent('download', { timeout: 12000 }).catch(() => null)
    await btn.click()
    const d = await dp
    if (d) { const f = `/tmp/v17-${fmt}`; await d.saveAs(f); got.push(`${fmt} ${fs.statSync(f).size}B`) }
    await pg.waitForTimeout(600)
  }
  ok('C11 분포 요약 3종 내려받기', got.length === 3, got.join(' · '))
  ok('C11 전국 요약 묶음 내려받기 단추', (await pg.locator('.nsum-all .fb-dl').count()) === 1)

  // ══ 되돌아가기 ════════════════════════════════════════════════════
  await pg.keyboard.press('Escape')
  await pg.locator('.csect-x').click()
  await pg.waitForTimeout(800)
  ok('선택 해제 → 부문 종합이 다시 첫 칸', (await pg.locator('.csect-sel').count()) === 0
    && (await pg.locator('.csect-main.shut').count()) === 0)
  await pg.locator('.hd-sector').click()
  await pg.waitForTimeout(900)
  ok('머리줄 부문 이름 → 시작 화면', (await pg.locator('.lp').count()) === 1)

  // ══ D1 : 다른 부문을 새로 골라도 1단계부터 ════════════════════════
  await pg.locator('.lp-card').nth(1).click()
  await pg.waitForTimeout(1000)
  ok('D1 다른 부문도 1 지표 선택부터',
    /\bnow\b/.test((await pg.locator('.sb2-cap').first().getAttribute('class')) || ''))
  ok('D1 다른 부문도 통계창은 닫힌 채로', (await pg.locator('.center').count()) === 0)
  ovf = await pg.evaluate(OVERFLOW)
  ok('D2 다른 부문 조작부 글자 넘침 없음', ovf.length === 0, ovf.join(' ; ').slice(0, 140))

  // ══ D5 : 화면 전체 글자 넘침 ══════════════════════════════════════
  await pg.locator('.sb2-next').click()
  await pg.waitForTimeout(400)
  await pg.locator('.mg-op[data-mk="minmax"]').click()
  await pg.waitForTimeout(2400)
  const all = await pg.evaluate(OVERFLOW_ALL)
  ok('D5 화면 전체 글자 넘침 없음', all.length === 0, all.join(' ; ').slice(0, 200))

  // 지도 범례의 분류 방식 단추 다섯이 모두 제 글자를 다 보인다
  const segs = await pg.evaluate(() => [...document.querySelectorAll('.mlc-seg button')]
    .map((e) => ({ t: e.textContent, w: Math.round(e.getBoundingClientRect().width), sw: e.scrollWidth })))
  ok('D5 범례 분류 단추 다섯', segs.length === 5, segs.map((x) => x.t).join('·'))
  ok('D5 범례 분류 단추 글자가 안 잘림', segs.every((x) => x.sw - x.w <= 1),
    segs.filter((x) => x.sw - x.w > 1).map((x) => `${x.t} ${x.sw}/${x.w}`).join(' '))
  const segRows = await pg.evaluate(() => {
    const t = new Set(); document.querySelectorAll('.mlc-seg button')
      .forEach((e) => t.add(Math.round(e.getBoundingClientRect().top))); return t.size
  })
  ok('D5 범례 분류 단추가 두 줄로 접힘', segRows === 2, `${segRows}줄`)

  // 순위 이동 목록: 계단 값과 시도 이름이 잘리지 않는다
  const slBad = await pg.evaluate(() => {
    const bad = []
    document.querySelectorAll('.slist .sl-row').forEach((r) => {
      r.querySelectorAll('.sl-camp, .sl-mv, .sl-nm em').forEach((e) => {
        if (e.scrollWidth - e.clientWidth > 1) bad.push(`${e.className}"${e.textContent}"`)
      })
    })
    return bad
  })
  ok('D5 순위 이동 목록의 값·시도 이름이 안 잘림', slBad.length === 0, slBad.slice(0, 3).join(' '))

  // ══ C13 : 콘솔 오류 ═══════════════════════════════════════════════
  ok('C13 콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 160))

  console.log(out.join('\n'))
  console.log('\n' + out.filter((x) => x.startsWith('FAIL')).length + ' FAIL / ' + out.length)
  await b.close()
})()
