// 표 → 엑셀 파일(.xlsx) 한 장.
//
// 바깥 라이브러리를 쓰지 않는다. 결과물이 한 파일짜리 웹페이지라 넣는 만큼 용량이
// 그대로 늘고, 여기서 필요한 것은 값과 머리글뿐이라 범용 변환기를 통째로 들일
// 이유가 없다. xlsx는 정해진 이름의 XML 몇 장을 zip으로 묶은 것이라 직접 쓴다.
//
// CSV로도 같은 값을 받을 수 있지만, CSV는 열 너비도 서식도 없고 엑셀이 한글
// 인코딩을 되묻는 일이 있다. 보고서에 그대로 붙일 표라면 xlsx가 손이 덜 간다.
//
// 규격: ECMA-376 SpreadsheetML. 문자열은 공유문자열표를 쓰지 않고 셀 안에
// 그대로 적는다(inlineStr). 표 하나에 같은 문자열이 크게 반복되지 않아
// 공유표를 두는 이득이 없고, 코드가 절반으로 준다.

import { zipStore } from './shpout.js'

const enc = new TextEncoder()
const U = (s) => enc.encode(s)

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  // 엑셀은 XML에 못 들어가는 제어문자를 만나면 파일을 통째로 거부한다.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

// 0 → A, 25 → Z, 26 → AA
function colName(n) {
  let s = ''
  n += 1
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26 }
  return s
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// 시트 이름 제약: 31자, : \ / ? * [ ] 못 씀. 겹치면 엑셀이 파일을 못 연다.
function sheetNames(sheets) {
  const used = new Set()
  return sheets.map((s, i) => {
    let n = String(s.name || `시트${i + 1}`).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || `시트${i + 1}`
    let base = n, k = 2
    while (used.has(n)) { n = `${base.slice(0, 28)}(${k++})`; }
    used.add(n)
    return n
  })
}

function sheetXml(cols, rows) {
  const nc = cols.length
  const last = `${colName(Math.max(0, nc - 1))}${rows.length + 1}`

  // 열 너비 — 글자 수로 어림한다. 한글은 폭이 두 배라 두 칸으로 센다.
  const w = cols.map((c, j) => {
    let m = width(c)
    for (let i = 0; i < rows.length; i++) m = Math.max(m, width(rows[i][j]))
    return Math.min(46, Math.max(7, m + 2))
  })
  const colsXml = `<cols>${w.map((v, j) =>
    `<col min="${j + 1}" max="${j + 1}" width="${v}" customWidth="1"/>`).join('')}</cols>`

  const cell = (v, ref, style) => {
    if (v == null || v === '') return ''
    if (isNum(v)) return `<c r="${ref}"${style} ><v>${v}</v></c>`
    return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
  }

  const head = `<row r="1" ht="19" customHeight="1">${cols.map((c, j) =>
    cell(c, `${colName(j)}1`, ' s="1"')).join('')}</row>`
  const body = rows.map((r, i) => `<row r="${i + 2}">${r.map((v, j) =>
    cell(v, `${colName(j)}${i + 2}`, isNum(v) ? ' s="2"' : '')).join('')}</row>`).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<sheetViews><sheetView workbookViewId="0">`
    + `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>`
    + `</sheetView></sheetViews>`
    + `<sheetFormatPr defaultRowHeight="16"/>`
    + colsXml
    + `<sheetData>${head}${body}</sheetData>`
    + (nc ? `<autoFilter ref="A1:${last}"/>` : '')
    + `</worksheet>`
}

// 한글·전각은 두 칸, 나머지는 한 칸으로 센 표시 폭
function width(v) {
  const s = v == null ? '' : String(v)
  let n = 0
  for (const ch of s) n += /[\u1100-\u11FF\u3000-\u303F\uAC00-\uD7AF\uFF00-\uFFA0]/.test(ch) ? 2 : 1
  return n
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.###"/></numFmts>
<fonts count="2">
<font><sz val="10"/><name val="맑은 고딕"/></font>
<font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="맑은 고딕"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8F1FA"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFB8C6D6"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

// sheets: [{ name, cols: [string], rows: [[값]] }]
export function xlsx(sheets) {
  const names = sheetNames(sheets)
  const files = []

  files.push({
    name: '[Content_Types].xml',
    data: U(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`),
  })

  files.push({
    name: '_rels/.rels',
    data: U(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
  })

  files.push({
    name: 'xl/workbook.xml',
    data: U(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) =>
      `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`),
  })

  files.push({
    name: 'xl/_rels/workbook.xml.rels',
    data: U(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
  })

  files.push({ name: 'xl/styles.xml', data: U(STYLES) })

  sheets.forEach((s, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: U(sheetXml(s.cols || [], s.rows || [])) })
  })

  return zipStore(files)
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
