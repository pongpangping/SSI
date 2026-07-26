# legacy-incheon — 인천광역시 1인가구 · 세대구조 대시보드 (보존본)

저장소의 메인 앱이 **국토종합진단지수 표준화 민감도 대시보드**로 바뀌면서,
기존 인천 대시보드의 소스 일체를 이 폴더로 그대로 옮겨 보존한 것이다. 삭제된 것은 없다.

- 공개 주소: `https://pongpangping.github.io/<저장소명>/incheon/`
- 배포본 위치: 저장소 루트의 `docs/incheon/index.html`
- 이 폴더로 옮기기 직전 커밋: `82a59da` (군집분석 → 평균 기준 규칙기반 유형화로 교체)

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `index.html` | Vite 진입 HTML |
| `vite.config.js` | 이 폴더를 root로 잡는 전용 설정 (메인 SSI 앱과 분리) |
| `src/` | React 소스 (App · components 13개 · lib 3개 · data 6개) |
| `public/data/` | 인천 경계 GeoJSON, SGIS 1km 격자 |
| `scripts/extract.py` | KOSIS 가구(2023) · 행안부 주민등록(2025) · 경계 SHP → 정적 JSON |
| `data/raw/` | 원본 CSV |
| `CHANGELOG.md` `TECH_STACK.md` | 기존 문서 |

## 실행

저장소 루트에서 돌린다. 의존성은 메인 앱과 공유한다.

```bash
npm install
npm run dev:incheon      # 개발 서버
npm run build:incheon    # legacy-incheon/dist/index.html
npm run deploy:incheon   # 빌드 후 docs/incheon/index.html 갱신
```

## 주의

`scripts/extract.py`는 `data/raw/` 아래에 정부 원본 파일(경계 SHP 포함) 일체가 갖춰져 있을 때만 돌려야 한다.
저장소에 커밋된 것은 CSV 두 개뿐이고 경계 SHP는 포함돼 있지 않다.
지금 `docs/incheon/index.html`과 `src/data/`에 들어 있는 경계·격자는 이미 검증을 마친 실데이터이므로,
원본 없이 스크립트를 다시 돌리면 오히려 이것들을 잘못된 값으로 덮어쓰게 된다.
