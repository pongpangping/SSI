import { useEffect, useState } from 'react'
import IndicatorDefs from './IndicatorDefs.jsx'
import DlMenu from './DlMenu.jsx'
import SectorIcon from './SectorIcon.jsx'
import { Cross } from './Glyph.jsx'
import { SECTORS, indsOf } from '../lib/ssi.js'
import { dlIndicatorDefs } from '../lib/statscsv.js'

// 데이터 설명 — 지금 고른 지표가 무엇을 재는 값인지, 어떤 식으로 계산했고
// 어디서 온 자료인지.
//
// 17차까지는 이 내용이 통계창 '원데이터' 서랍의 첫 칸에 있었다. 그런데 원데이터
// 서랍은 값을 보는 자리이지 값의 뜻을 읽는 자리가 아니다. 부문 종합을 보다가
// 지표 정의가 궁금해지면 서랍을 열고 표를 지나쳐 내려가야 했고, 무엇보다 서랍
// 안에 있으니 '이 화면 어디서나 꺼내 볼 수 있는 참고 자료'로 보이지 않았다.
//
// 용어 사전·전체 데이터표와 성격이 같다. 셋 다 화면의 어느 지점에서 보든 똑같이
// 필요한 참고 자료이므로, 머리줄 오른쪽에 나란히 둔다. 용어 사전과 합치지 않은
// 것은 범위가 다르기 때문이다 — 용어 사전은 32개 지표 전부를 담은 사전이고,
// 이쪽은 지금 이 부문에서 고른 지표만 추린 것이다.
export default function DataDefsModal({ sector }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const s = sector ? SECTORS[sector] : null
  const inds = sector ? indsOf(sector) : []
  const years = []
  inds.forEach((e) => { if (!years.includes(e.year)) years.push(e.year) })
  years.sort()
  const yr = years.length === 1 ? `${years[0]}년`
    : years.length > 1 ? `${years[0]}~${years[years.length - 1]}년` : ''

  return (
    <>
      <button className="src-btn" onClick={() => setOpen(true)}
        title="지금 고른 지표의 정의 · 산식 · 출처">
        ▦ 데이터 설명
      </button>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal modal-nar" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>데이터 설명 · 지표 정의 · 산식 · 출처</h3>
              <button onClick={() => setOpen(false)} title="닫기"><Cross size={12} /></button>
            </div>
            <div className="dd-bar">
              <span className="dd-sec">
                {s && <SectorIcon k={sector} state="on" size={14} />}
                <b>{s ? s.name : '—'}</b>
                <em>선택 지표 {inds.length}개{yr && ` · ${yr}`}</em>
              </span>
              <DlMenu pack={() => dlIndicatorDefs(sector)}
                tip="지표 정의 · 산식 · 출처를 파일로" />
            </div>
            <div className="modal-b">
              <IndicatorDefs sector={sector} />
            </div>
            <div className="gl-note">
              지표를 바꾸면 이 목록도 바뀝니다. 32개 지표 전체 사전은
              머리줄의 <b>용어 · 방법론</b>에서 볼 수 있습니다.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
