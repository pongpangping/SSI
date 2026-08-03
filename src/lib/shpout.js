// 지도에 그린 그대로 내보내기 — Shapefile 한 벌(.shp/.shx/.dbf/.prj/.cpg)과 GeoJSON.
//
// 바깥 라이브러리를 쓰지 않는다. 결과물이 한 파일짜리 웹페이지라 용량이 그대로 늘고,
// 폴리곤 하나만 쓰는 데 범용 변환기를 통째로 넣을 이유가 없다.
// 규격은 ESRI Shapefile Technical Description(1998)과 dBASE III 레코드 구조를 따랐다.
//
// 좌표계는 원본 경계 그대로 EPSG:4326(경위도)이다. .prj를 같이 넣으므로
// QGIS·ArcGIS에서 열면 좌표계를 묻지 않는다. 한글 속성은 UTF-8로 적고 .cpg로 알린다.

import { SECTORS, methodOf, ciT, pctOf, rowIndex, keyOf } from './ssi.js'

const enc = new TextEncoder()

/* ── zip(무압축 저장) ──────────────────────────────────────────── */
let TBL = null
function crc32(u8) {
  if (!TBL) {
    TBL = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      TBL[n] = c >>> 0
    }
  }
  let c = 0xFFFFFFFF
  for (let i = 0; i < u8.length; i++) c = TBL[(c ^ u8[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// 만든 시각을 넣으면 같은 자료인데도 파일이 매번 달라진다. 날짜는 고정값으로 둔다.
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1

export function zipStore(files) {
  const local = []
  const central = []
  let off = 0
  files.forEach((f) => {
    const nm = enc.encode(f.name)
    const data = f.data
    const crc = crc32(data)
    const lh = new Uint8Array(30)
    const ld = new DataView(lh.buffer)
    ld.setUint32(0, 0x04034b50, true)
    ld.setUint16(4, 20, true)
    ld.setUint16(6, 0x0800, true)          // 파일 이름은 UTF-8
    ld.setUint16(8, 0, true)               // 압축 없음(저장)
    ld.setUint16(10, DOS_TIME, true)
    ld.setUint16(12, DOS_DATE, true)
    ld.setUint32(14, crc, true)
    ld.setUint32(18, data.length, true)
    ld.setUint32(22, data.length, true)
    ld.setUint16(26, nm.length, true)
    ld.setUint16(28, 0, true)
    local.push(lh, nm, data)

    const ch = new Uint8Array(46)
    const cd = new DataView(ch.buffer)
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, 0, true)
    cd.setUint16(12, DOS_TIME, true)
    cd.setUint16(14, DOS_DATE, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, data.length, true)
    cd.setUint32(24, data.length, true)
    cd.setUint16(28, nm.length, true)
    cd.setUint32(42, off, true)
    central.push(ch, nm)
    off += 30 + nm.length + data.length
  })

  const cLen = central.reduce((a, b) => a + b.length, 0)
  const end = new Uint8Array(22)
  const ed = new DataView(end.buffer)
  ed.setUint32(0, 0x06054b50, true)
  ed.setUint16(8, files.length, true)
  ed.setUint16(10, files.length, true)
  ed.setUint32(12, cLen, true)
  ed.setUint32(16, off, true)

  const all = [...local, ...central, end]
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0))
  let p = 0
  all.forEach((b) => { out.set(b, p); p += b.length })
  return out
}

/* ── 폴리곤 → .shp / .shx ──────────────────────────────────────── */
// 부호 있는 넓이. 양수면 반시계 방향이다.
const signedArea = (r) => {
  let s = 0
  for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
  return s / 2
}

// Shapefile은 바깥 고리를 시계 방향, 구멍을 반시계 방향으로 적는다.
// GeoJSON은 그 반대를 권하므로 여기서 방향을 맞춰 준다.
function ringsOf(geom) {
  const out = []
  const push = (poly) => {
    poly.forEach((ring, i) => {
      let r = ring.slice()
      const a = r[0], z = r[r.length - 1]
      if (!a || r.length < 4) return
      if (a[0] !== z[0] || a[1] !== z[1]) r.push(a)     // 고리는 닫혀 있어야 한다
      const ccw = signedArea(r) > 0
      const wantCcw = i !== 0                            // 첫 고리가 바깥, 나머지는 구멍
      if (ccw !== wantCcw) r = r.reverse()
      out.push(r)
    })
  }
  if (!geom) return out
  if (geom.type === 'Polygon') push(geom.coordinates || [])
  else if (geom.type === 'MultiPolygon') (geom.coordinates || []).forEach(push)
  return out
}

function shpHeader(byteLen, box) {
  const b = new Uint8Array(100)
  const d = new DataView(b.buffer)
  d.setInt32(0, 9994)                    // 파일 코드(빅엔디언)
  d.setInt32(24, byteLen / 2)            // 길이는 16비트 낱말 수로 적는다
  d.setInt32(28, 1000, true)
  d.setInt32(32, 5, true)                // 5 = Polygon
  d.setFloat64(36, box[0], true); d.setFloat64(44, box[1], true)
  d.setFloat64(52, box[2], true); d.setFloat64(60, box[3], true)
  return b
}

function buildShp(features) {
  const recs = features.map((f) => {
    const rs = ringsOf(f.geometry)
    const nPts = rs.reduce((a, r) => a + r.length, 0)
    const len = 4 + 32 + 4 + 4 + 4 * rs.length + 16 * nPts
    const buf = new Uint8Array(len)
    const d = new DataView(buf.buffer)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    rs.forEach((r) => r.forEach((p) => {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]
    }))
    d.setInt32(0, 5, true)
    d.setFloat64(4, x0, true); d.setFloat64(12, y0, true)
    d.setFloat64(20, x1, true); d.setFloat64(28, y1, true)
    d.setInt32(36, rs.length, true); d.setInt32(40, nPts, true)
    let o = 44, start = 0
    rs.forEach((r) => { d.setInt32(o, start, true); o += 4; start += r.length })
    rs.forEach((r) => r.forEach((p) => {
      d.setFloat64(o, p[0], true); d.setFloat64(o + 8, p[1], true); o += 16
    }))
    return { body: buf, box: [x0, y0, x1, y1] }
  })

  const box = recs.reduce((a, r) => [
    Math.min(a[0], r.box[0]), Math.min(a[1], r.box[1]),
    Math.max(a[2], r.box[2]), Math.max(a[3], r.box[3]),
  ], [Infinity, Infinity, -Infinity, -Infinity])

  const shpLen = 100 + recs.reduce((a, r) => a + 8 + r.body.length, 0)
  const shxLen = 100 + recs.length * 8
  const shp = new Uint8Array(shpLen)
  const shx = new Uint8Array(shxLen)
  shp.set(shpHeader(shpLen, box), 0)
  shx.set(shpHeader(shxLen, box), 0)
  const sd = new DataView(shp.buffer)
  const xd = new DataView(shx.buffer)

  let o = 100
  recs.forEach((r, i) => {
    sd.setInt32(o, i + 1)                       // 레코드 번호는 1부터
    sd.setInt32(o + 4, r.body.length / 2)
    shp.set(r.body, o + 8)
    xd.setInt32(100 + i * 8, o / 2)
    xd.setInt32(104 + i * 8, r.body.length / 2)
    o += 8 + r.body.length
  })
  return { shp, shx }
}

/* ── 속성 표 → .dbf ────────────────────────────────────────────── */
// UTF-8은 한글 한 자가 3바이트다. 칸을 바이트로 세되 글자 중간에서 자르지 않는다.
function fitBytes(s, len) {
  let b = enc.encode(s)
  if (b.length <= len) return b
  let t = s
  while (t.length && enc.encode(t).length > len) t = t.slice(0, -1)
  return enc.encode(t)
}

function buildDbf(fields, rows) {
  const recLen = 1 + fields.reduce((a, f) => a + f.len, 0)
  const hLen = 32 + 32 * fields.length + 1
  const out = new Uint8Array(hLen + recLen * rows.length + 1)
  const d = new DataView(out.buffer)
  out[0] = 0x03                                  // dBASE III
  out[1] = 126; out[2] = 1; out[3] = 1           // 2026-01-01 (고정)
  d.setUint32(4, rows.length, true)
  d.setUint16(8, hLen, true)
  d.setUint16(10, recLen, true)

  let o = 32
  fields.forEach((f) => {
    out.set(fitBytes(f.name, 10), o)
    out[o + 11] = f.type.charCodeAt(0)
    out[o + 16] = f.len
    out[o + 17] = f.dec || 0
    o += 32
  })
  out[o++] = 0x0D

  rows.forEach((r) => {
    out[o++] = 0x20                              // 지운 줄 표시(0x20 = 살아 있음)
    fields.forEach((f) => {
      const v = r[f.name]
      let txt
      if (f.type === 'N') txt = (v == null || v === '' || Number.isNaN(Number(v))) ? '' : Number(v).toFixed(f.dec || 0)
      else txt = v == null ? '' : String(v)
      const b = fitBytes(txt, f.len)
      out.fill(0x20, o, o + f.len)
      if (f.type === 'N') out.set(b, o + f.len - b.length)   // 숫자는 오른쪽 맞춤
      else out.set(b, o)
      o += f.len
    })
  })
  out[o] = 0x1A                                  // 파일 끝 표시
  return out
}

const PRJ = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],'
  + 'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'

/* ── 지도 내보내기 ─────────────────────────────────────────────── */
// 속성은 '지금 지도에 칠한 값'을 중심으로 가볍게 담는다.
// dbf 이름은 10자를 넘길 수 없어 영문 약칭을 쓰고, 무슨 뜻인지는 읽어보기.txt에 적는다.
const FIELDS = [
  { name: 'SIDO', type: 'C', len: 45, ko: '시도' },
  { name: 'SIGUNGU', type: 'C', len: 45, ko: '시군구' },
  { name: 'SECTOR', type: 'C', len: 45, ko: '부문 이름' },
  { name: 'METHOD', type: 'C', len: 40, ko: '표준화 방법' },
  { name: 'METRIC', type: 'C', len: 90, ko: '지도 색 기준(선택한 지표)' },
  { name: 'VALUE', type: 'N', len: 19, dec: 4, ko: '지도 색 기준 값' },
  { name: 'VALUE_TXT', type: 'C', len: 40, ko: '지도 색 기준 값(단위 포함 표기)' },
  { name: 'CI', type: 'N', len: 12, dec: 4, ko: '부문 점수' },
  { name: 'RANK', type: 'N', len: 6, dec: 0, ko: '부문 점수 전국 순위(1 = 최상위)' },
  { name: 'TSCORE', type: 'N', len: 8, dec: 2, ko: '표준점수 T (전국 평균 50 · 표준편차 10)' },
  { name: 'PCTILE', type: 'N', len: 8, dec: 2, ko: '백분위(%) · 값이 더 낮은 지역의 비율' },
  { name: 'SSI_CAMP', type: 'N', len: 6, dec: 0, ko: '표준화 방법을 바꿨을 때의 순위 이동(계단)' },
  { name: 'SENSITIVE', type: 'C', len: 6, ko: '민감 지역 여부(Y/N)' },
]

const YMD = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

// 화면에 보이는 대로(시도를 골랐으면 그 시도만) 한 벌을 만든다.
export function mapExportSet({ geo, byKey, sector, method, metric, valOf, sido }) {
  const feats = (geo.features || []).filter((f) => {
    const r = byKey[keyOfFeat(f)]
    if (!r) return false
    return !sido || r.sido === sido
  })
  const t = ciT(sector, method)
  const attrs = feats.map((f) => {
    const k = keyOfFeat(f)
    const r = byKey[k]
    const i = rowIndex(k)
    const d = r[sector] || null
    const v = valOf(k)
    return {
      SIDO: r.sido,
      SIGUNGU: r.name,
      SECTOR: SECTORS[sector]?.name || sector,
      METHOD: methodOf(method)?.label || method,
      METRIC: metric.label,
      VALUE: typeof v === 'number' ? v : null,
      VALUE_TXT: metric.fmt(v),
      CI: d ? d.ci[method] : null,
      RANK: d ? d.rank[method] : null,
      TSCORE: t && i != null ? t[i] : null,
      PCTILE: d ? pctOf(d.rank[method]) : null,
      SSI_CAMP: d ? d.ssiCamp : null,
      SENSITIVE: d ? (d.flag === 'high' ? 'Y' : 'N') : '',
    }
  })
  return { feats, attrs }
}

const keyOfFeat = (f) => keyOf(f.properties?.sido, f.properties?.name)

function readmeText({ sector, method, metric, sido, n, base }) {
  const lines = [
    '국토종합진단지수 · 지도 내보내기',
    '',
    `만든 날짜   ${YMD().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}`,
    `부문        ${SECTORS[sector]?.name || sector}`,
    `표준화 방법 ${methodOf(method)?.label || method}`,
    `지도 색 기준 ${metric.label}`,
    `대상 범위   ${sido || '전국'} · ${n}개 시군구`,
    `좌표계      EPSG:4326 (경위도, WGS84)`,
    '',
    '파일 구성',
    `  ${base}.shp   도형`,
    `  ${base}.shx   도형 색인`,
    `  ${base}.dbf   속성 표 (UTF-8)`,
    `  ${base}.prj   좌표계`,
    `  ${base}.cpg   속성 표 문자 인코딩`,
    '',
    '속성 항목 (dbf 항목 이름은 10자를 넘길 수 없어 영문 약칭을 씁니다)',
  ]
  FIELDS.forEach((f) => lines.push(`  ${f.name.padEnd(11)}${f.ko}`))
  lines.push(
    '',
    '읽는 법',
    '  · VALUE 는 내보낼 때 지도에 칠해져 있던 값입니다. 지도 색 기준을 바꾸면 값도 바뀝니다.',
    '  · RANK 는 숫자가 작을수록 상위입니다(1 = 전국 1위).',
    '  · TSCORE 는 전국 평균이 50, 표준편차가 10이 되도록 맞춘 점수입니다. 60이면 평균보다 한 표준편차 위입니다.',
    '  · SSI_CAMP 가 클수록 표준화 방법에 따라 순위가 크게 흔들리는 지역입니다.',
    '  · 값이 비어 있는 칸은 원자료가 없는 지역입니다.',
    '',
    'QGIS에서 열기  압축을 푼 뒤 .shp 파일을 창에 끌어다 놓으면 됩니다.',
  )
  return lines.join('\n')
}

export function download(name, bytes, mime = 'application/octet-stream') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function exportShapefile(opts) {
  const { feats, attrs } = mapExportSet(opts)
  if (!feats.length) return 0
  const base = `SSI_${opts.sector}_${opts.method}_${opts.sido ? '권역' : '전국'}_${YMD()}`
  const { shp, shx } = buildShp(feats)
  const zip = zipStore([
    { name: `${base}.shp`, data: shp },
    { name: `${base}.shx`, data: shx },
    { name: `${base}.dbf`, data: buildDbf(FIELDS, attrs) },
    { name: `${base}.prj`, data: enc.encode(PRJ) },
    { name: `${base}.cpg`, data: enc.encode('UTF-8') },
    { name: '읽어보기.txt', data: enc.encode('﻿' + readmeText({ ...opts, n: feats.length, base })) },
  ])
  download(`${base}.zip`, zip, 'application/zip')
  return feats.length
}

export function exportGeoJSON(opts) {
  const { feats, attrs } = mapExportSet(opts)
  if (!feats.length) return 0
  const fc = {
    type: 'FeatureCollection',
    name: `SSI_${opts.sector}_${opts.method}`,
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: feats.map((f, i) => ({ type: 'Feature', properties: attrs[i], geometry: f.geometry })),
  }
  const base = `SSI_${opts.sector}_${opts.method}_${opts.sido ? '권역' : '전국'}_${YMD()}`
  download(`${base}.geojson`, enc.encode(JSON.stringify(fc)), 'application/geo+json')
  return feats.length
}

// 지도에 칠한 값만 뽑은 표. 엑셀에서 바로 열리도록 BOM을 붙인다.
export function exportCSV(opts) {
  const { feats, attrs } = mapExportSet(opts)
  if (!feats.length) return 0
  const head = FIELDS.map((f) => f.ko)
  const q = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = attrs.map((a) => FIELDS.map((f) => q(a[f.name])).join(','))
  const base = `SSI_${opts.sector}_${opts.method}_${opts.sido ? '권역' : '전국'}_${YMD()}`
  download(`${base}.csv`, enc.encode('﻿' + [head.join(','), ...body].join('\n')), 'text/csv')
  return feats.length
}

export const EXPORT_FIELDS = FIELDS
