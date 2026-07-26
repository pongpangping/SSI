# 공간분석 대시보드 저장소

정적 단일 HTML 대시보드 두 개를 함께 담고 있다. 둘 다 서버 없이 동작하며 GitHub Pages로 배포된다.

| 앱 | 소스 | 배포본 | 공개 주소 |
|---|---|---|---|
| **국토종합진단지수 · 표준화 방법 민감도** (메인) | `src/` | `docs/index.html` | `/` |
| 인천 1인가구 · 세대구조 (보존) | `legacy-incheon/` | `docs/incheon/index.html` | `/incheon/` |

```bash
npm install
npm run dev              # SSI 대시보드 개발 서버
npm run deploy           # 빌드 → docs/index.html 갱신
npm run dev:incheon      # 인천 대시보드 개발 서버
npm run deploy:incheon   # 빌드 → docs/incheon/index.html 갱신
```

Pages 설정은 **Settings → Pages → Branch `main` / `/docs`** 이다.

---

# 국토종합진단지수 · 표준화 방법 민감도 대시보드

`파일럿_분석결과.xlsx`의 **229개 시군구 × 40개 컬럼**을 지도 · 표 · 차트로 보여주고,
**표준화 방법을 바꾸면 시각화가 어떻게 달라지는지**를 화면 안에서 직접 비교한다.

- 자료: `파일럿_분석결과.xlsx` — `분석결과`(229행 × 40열), `컬럼메타데이터`(40행 × 7열) 두 시트 모두 사용
- 방법론: `표준화_방법론_및_민감도_진단_지침서_v2.pdf`
- 산출물: `docs/index.html` — 외부 파일 의존이 없는 단일 HTML 약 4.5MB (더블클릭으로도 열림)

> 참고: 요청서에는 "225개 시군구"로 적혀 있으나 xlsx의 두 시트 모두 **229행**이라 229를 기준으로 했다.

## 1. 무엇을 보여주는가

핵심 질문은 하나다. **같은 원자료인데 표준화 방법만 바꾸면 지도 색과 순위가 얼마나 달라지는가.**

| 화면 | 컴포넌트 | 보여주는 것 |
|---|---|---|
| 좌측 패널 | `Sidebar` `MethodPicker` | 부문 · 표준화 방법 · 지도 지표 선택. 방법 전환 시 색 등급이 바뀌는 시군구 수를 미리 표시 |
| 지도 | `NationalMap` | 229개 시군구 단계구분도. 방법을 바꾸면 즉시 재채색 |
| A/B 지도 | `CompareMaps` | 두 방법의 지도를 좌우로 동시에, 팬·줌 동기화 |
| 중앙 1 | `MethodCompare` | 선택 시군구의 4개 방법별 CI · 순위 |
| 중앙 2 | `StdTransform` | 원자료 → 방향반전 → 표준화 → CI → 순위 계산 과정 |
| 중앙 3 | `RankFlow` | 방법 간 순위 이동 범프 차트 |
| 중앙 4 | `DistributionCompare` | 방법별 CI 히스토그램 + 지침서 6.4 10개 값 예시 |
| 중앙 5 | `RawIndicators` | 부문 내 원자료 지표 원값 |
| 중앙 6 | `SensitivityScatter` | MinMax순위 × PctRank순위 산점도 |
| 중앙 7 | `SensitiveList` | SSI_camp 상위 시군구 |
| 모달 | `DataTable` | 40개 컬럼 × 229행 전체 표 (정렬 · CSV 내보내기 · 컬럼 설명 툴팁) |
| 모달 | `GlossaryModal` | 용어 · 4개 표준화 방법 · 컬럼사전 40개 |

## 2. 표준화 방법 4종

지침서의 5개 방법 중 LQ(입지지수)는 거리기반 × 100과 수학적으로 동일해 제외했고, 남은 4개는 두 진영으로 갈린다.

| 진영 | 방법 | 코드 | 공식 | 범위 |
|---|---|---|---|---|
| 간격보존형 | Min-Max **(진영 대표)** | MM | `(x − min) / (max − min) × 100` | 0 ~ 100 (양끝 고정) |
| 간격보존형 | 거리기반 | DI | `x / 전국평균 × 100` | 상한 없음 (실측 7.6 ~ 241.9) |
| 간격보존형 | 로지스틱 | LG | `100 / (1 + exp(−z))`, `z = (x − 평균) / 표준편차` | 실측 18.8 ~ 80.8 |
| 순위전용형 | 백분위순위 **(진영 대표)** | PR | `평균순위(1기준) / N × 100` | 0 ~ 100 (균등) |

방향 −1(값이 클수록 나쁨) 지표는 표준화 **이전에** `x′ = max + min − x` 로 반전한다.
CI는 부문 내 지표 표준화값의 **단순 산술평균**(동일가중)이다.

위 공식은 `scripts/verify_formula.py`로 원자료에서 CI를 역산해 xlsx의 CI 컬럼과 대조했고,
**8개 조합(2부문 × 4방법) 전부 최대오차 0.0005 미만**으로 일치한다. 로지스틱의 표준편차는 **표본표준편차(ddof=1)** 다.

### 핵심 원리

1. **지표 1개 단위 순위는 4개 방법이 항상 같다.** 네 공식 모두 단조증가 변환이므로 Spearman 상관 = 1.000.
2. **차이는 CI 합산 단계에서만 생긴다.** 각 방법이 값 간격을 서로 다르게 압축·신장하기 때문에, 지표를 평균 내는 순간 순위가 갈린다.
3. 실제로 229개 중 약 16%가 방법 선택만으로 **10순위 이상** 이동한다.

### SSI_camp (최종 민감도 지수)

```
SSI_camp = | 순위(CI_MinMax) − 순위(CI_PctRank) |
민감구분 = high  (부문 내 SSI_camp 80백분위 이상)
```

4개 방법을 나열 비교하는 대신 대립하는 두 진영의 대표값 차이로 재정의한 것이다(지침서 9장).

## 3. 40개 컬럼 처리

| 구분 | 개수 | 컬럼 |
|---|---|---|
| 식별자 | 2 | 시도, 시군구 |
| 원자료 | 9 | S1 2개(거점화율, 거점부 인구집중도) · S8 7개(사망률, 비만율, 암발생률, 고혈압 유병률, 당뇨 유병률, 의료이용미충족율, 주관적 건강인지율) |
| CI | 8 | S1/S8 × MinMax/Distance/PctRank/Logistic |
| 순위 | 8 | S1/S8 × 4개 방법 |
| 민감도 | 6 | S1/S8 × SSI_range, SSI_std, SSI_camp |
| 민감구분 | 2 | S1_민감구분, S8_민감구분 |
| 진영 대표순위 | 4 | S1/S8 × MinMax대표순위, PctRank대표순위 |
| 참고 | 1 | S1_트레이드오프_참고 |

40개 모두 `전체 데이터표` 모달에서 원값 그대로 조회 · 정렬 · CSV 내보내기 가능하고,
각 컬럼 헤더에는 `컬럼메타데이터` 시트의 설명 · 단위 · 산출식이 툴팁으로 붙는다.

## 4. 데이터 재생성

xlsx가 갱신되면 다음 순서로 돌린다.

```bash
python3 scripts/build_data.py      # 파일럿_분석결과.xlsx → src/data/ssi.json
python3 scripts/verify_formula.py  # 4개 방법 CI 역산 검증 (오차 < 0.0005 확인)
```

`src/data/sigungu_geo.json`은 229개 시군구 경계 GeoJSON이며 이미 단순화되어 있다.

## 5. 파일 구조

```
├─ index.html  vite.config.js  package.json     SSI 앱 (메인)
├─ docs/
│  ├─ index.html        ★ SSI 배포본
│  ├─ incheon/index.html  인천 배포본
│  └─ .nojekyll
├─ scripts/       build_data.py · verify_formula.py
├─ src/
│  ├─ main.jsx  App.jsx  styles.css
│  ├─ data/      ssi.json (229행 40열 + 컬럼메타데이터) · sigungu_geo.json
│  ├─ lib/       ssi.js (데이터 접근·파생) · standardize.js (4개 공식 구현)
│  └─ components/  15개 (1절 표 참조)
└─ legacy-incheon/   인천 대시보드 소스 일체 (별도 README 참조)
```

## 6. 상태

초안(draft)이다. 지금은 xlsx에 들어 있는 **S1 공간구조효율성 · S8 지역사회건강도** 2개 부문만 담겨 있고,
부문이 추가되면 `build_data.py`가 컬럼명 규칙(`{부문}_원자료_{지표}`, `{부문}_CI_{방법}`)만으로 자동 인식한다.
