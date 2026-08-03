import { indsOf } from '../lib/ssi.js'

// 지금 고른 지표가 무엇인지. 정의·산식·출처를 한 번은 볼 수 있어야 한다.
// 지표 이름만 보고 무엇을 재는 값인지 알 수 있는 경우는 드물다.
export default function IndicatorDefs({ sector }) {
  const inds = indsOf(sector)
  if (!inds.length) return <div className="empty-hint">선택된 지표가 없습니다</div>

  return (
    <div className="idefs">
      {inds.map((e, i) => (
        <div className="idf" key={e.id}>
          <div className="idf-h">
            <span className="idf-no">{i + 1}</span>
            <b className="idf-nm">{e.name || e.label}</b>
            <span className={`idf-dir${e.dir === '+' ? ' up' : ' dn'}`}>
              {e.dir === '+' ? '높을수록 좋음' : '낮을수록 좋음'}
            </span>
            <span className="idf-yr">{e.year}년</span>
            {e.unit && <span className="idf-un">{e.unit}</span>}
          </div>
          {e.desc && <div className="idf-d">{e.desc}</div>}
          {e.formula && <div className="idf-f"><em>산식</em>{e.formula}</div>}
          <div className="idf-s">
            {e.source && <span><em>출처</em>{e.source}</span>}
            {e.note && <span><em>비고</em>{e.note}</span>}
          </div>
        </div>
      ))}
      <div className="idf-foot">
        방향이 &lsquo;낮을수록 좋음&rsquo;인 지표는 표준화 전에 값을 뒤집습니다
        (뒤집은 값 = 전국 최대 + 전국 최소 − 원값). 그래야 여러 지표를 같은 방향으로
        더할 수 있습니다.
      </div>
    </div>
  )
}
