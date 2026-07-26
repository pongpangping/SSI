// 숫자 포맷 유틸
export const comma = (n) =>
  n == null ? '—' : Number(n).toLocaleString('ko-KR')

export const pct = (n, d = 1) =>
  n == null ? '—' : `${Number(n).toFixed(d)}%`

export const man = (n) =>
  n == null ? '—' : `${(n / 10000).toFixed(1)}만`

// 현재 시군구 표를 CSV로 내려받기 (엑셀 한글 깨짐 방지 BOM 포함)
export function downloadCsv(rows, filename = '인천_1인가구_시군구.csv') {
  const cols = [
    ['name', '시군구'], ['onePersonRate', '1인가구비율(%)'], ['agedOneShareOfOne', '고령1인가구비중(%)'],
    ['avgHouseholdSize', '세대당인구'], ['onePerson', '1인가구수'], ['population', '인구'],
    ['households', '세대수'], ['composite', '집중지수'],
  ]
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.map((c) => c[1]).join(',')
  const lines = rows.map((r) => cols.map((c) => esc(r[c[0]])).join(','))
  const csv = '﻿' + [header, ...lines].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// 1인가구 비율 → 파란 sequential ramp 색상 (dataviz 검증 팔레트)
const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#2a78d6', '#1c5cab', '#104281']
export function rampColor(value, min, max) {
  if (value == null || max === min) return 'rgba(20,30,60,0.08)'
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const idx = Math.round(t * (SEQ.length - 1))
  return SEQ[idx]
}
