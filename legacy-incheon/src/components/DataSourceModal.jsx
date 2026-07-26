import { useEffect, useState } from 'react'

// 사용한 데이터셋 — 출처·시점·구조·활용을 한곳에 정리
const SOURCES = [
  {
    tag: '가구', name: '가구주의 연령 및 가구원수별 가구(일반가구) · 시군구',
    org: '통계청 KOSIS · 인구총조사', id: 'DT_1JC1511', time: '2023년',
    structure: '시군구 × 가구원수(1인·2인·3인·4인+) × 가구주 연령대',
    used: '1인가구 비율 · 가구원수 구성 도넛 · 1인가구 연령대 · 산점도 · 집중지수',
  },
  {
    tag: '세대', name: '주민등록 인구 및 세대현황 (전체 읍면동현황)',
    org: '행정안전부', id: '주민등록', time: '2025년 월별',
    structure: '시군구 × 월 × 인구 · 세대수 · 성별',
    used: '세대당 인구 · 세대수/세대당 인구 월별 추이',
  },
  {
    tag: '경계', name: '연속수치지형도 행정경계(읍면동)',
    org: '국토지리정보원', id: 'N3A_G0110000', time: '연속수치지형도',
    structure: '읍면동 폴리곤(EPSG:5186) → 인천(28)만 필터 후 시군구로 병합(dissolve)',
    used: '지도 시군구 경계 · 지표값 라벨 위치',
  },
  {
    tag: '격자', name: '1km 격자 1인가구 통계',
    org: '통계청 통계지리정보서비스(SGIS) · 국가데이터처', id: '1km 격자 · 2024', time: '2024년 가구(등록센서스) 기준',
    structure: '1km 격자 경계 폴리곤(EPSG:5179) × 격자별 1인가구 수(ga_sd_005). 인천 경계 내 505개 셀.',
    used: '구 확대 시 격자 밀집도 히트맵(구 안에서 1인가구가 몰린 위치)',
    note: '실제 SGIS 1km 격자 통계값입니다. 소수 가구 셀은 통계 비공개(소규모 셀 보호)로 빠져 시군구 합계의 약 76%가 격자에 표출됩니다 — 격자는 절대량이 아닌 상대적 밀집 패턴 확인용입니다.',
  },
]

export default function DataSourceModal() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button className="src-btn" onClick={() => setOpen(true)}>
        <span className="src-i">ⓘ</span> 데이터 출처 · 시점 · 구조
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>데이터 출처 · 시점 · 구조</h3>
                <p>이 대시보드가 사용한 원본 데이터입니다. 모두 공식 기관에서 파일로 받아 빌드 시점에 정제했습니다.</p>
              </div>
              <button className="modal-x" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
            </div>

            <div className="modal-body">
              {SOURCES.map((s) => (
                <div className="src-card" key={s.name}>
                  <div className="src-top">
                    <span className={`src-tag t-${s.tag}`}>{s.tag}</span>
                    <span className="src-name">{s.name}</span>
                  </div>
                  <div className="src-grid">
                    <span className="sk">출처</span><span className="sv">{s.org} <em>({s.id})</em></span>
                    <span className="sk">시점</span><span className="sv">{s.time}</span>
                    <span className="sk">구조</span><span className="sv">{s.structure}</span>
                    <span className="sk">활용</span><span className="sv">{s.used}</span>
                  </div>
                  {s.note && <div className="src-note">※ {s.note}</div>}
                </div>
              ))}

              <div className="methods">
                <div className="methods-h">지표 정의 · 산식</div>
                <div className="mrow"><b>1인가구 비율</b> = 1인가구 ÷ 일반가구 × 100 <em>(KOSIS·2023)</em></div>
                <div className="mrow"><b>고령 1인가구 비중</b> = 가구주 65세 이상 1인가구 ÷ 1인가구 × 100</div>
                <div className="mrow"><b>세대당 인구</b> = 인구 ÷ 세대수 <em>(주민등록·2025)</em></div>
                <div className="mrow"><b>1인가구 집중지수</b> = 세 지표를 min-max 정규화(세대당 인구는 역방향) 후 가중 평균 × 100. 높을수록 1인·고령·소규모 가구 집중.</div>
              </div>
            </div>

            <div className="modal-foot">
              가구(인구총조사·2023)와 세대(주민등록·2025)는 정의·기준 시점이 다릅니다 — 직접 더하지 말고 구분해 해석하세요.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
