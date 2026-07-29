# 국토종합진단지수 자료 적재 (v2)
#
# v1과 달라진 점: 표준화·평균·순위를 여기서 끝내지 않는다.
# 사용자가 화면에서 지표와 연도를 골라 조합을 바꾸므로, 그때마다 파일을 다시
# 만들 수 없다. 그래서 이 스크립트는 '원값 + 설명'만 담고 계산은 브라우저가 한다.
#
#   입력  : 부문별 xlsx 6개 + 참고1 지표체계
#   출력  : src/data/ssi.json
#
# 실행: python3 scripts/build_data2.py

import json
import os
import re
import unicodedata

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'src', 'data', 'ssi.json')
GEO = os.path.join(ROOT, 'src', 'data', 'sigungu_geo.json')

# 업로드 폴더 이름이 맥에서 온 자모 분리(NFD) 상태라 그대로 적으면 못 찾는다.
UPLOAD = '/mnt/user-data/uploads'
SRC = next(os.path.join(UPLOAD, n) for n in os.listdir(UPLOAD) if n.startswith('0727'))


def pick(prefix):
    for n in os.listdir(SRC):
        if unicodedata.normalize('NFC', n).startswith(prefix):
            return os.path.join(SRC, n)
    raise FileNotFoundError(prefix)


# ── 부문 정의 ────────────────────────────────────────────────────────────────
# file  : 자료 파일 앞머리 (None이면 자료 준비중)
# head  : 지표 시트에서 머리글이 있는 줄 번호 (안내문 줄이 위에 붙은 파일이 있다)
# skip  : 지표가 아닌 열 (격자수·시군구코드 등)
# dirs  : 지표번호 → 방향. '+' 높을수록 좋음 / '-' 낮을수록 좋음
SECTORS = [
    dict(key='S1', name='공간구조 효율성', icon='◫',
         file='국토종합진단지수_S1', head=0, skip=['격자수'],
         dirs={1: '+', 2: '+', 3: '-'}),
    dict(key='S2', name='인구활력도', icon='◈',
         file='국토종합진단지수_S2', head=2, skip=['시군구코드'],
         dirs={1: '+', 2: '+', 3: '-', 4: '-', 5: '-', 6: '+'}),
    dict(key='S3', name='지역경제활력도', icon='◐', file=None),
    dict(key='S4', name='지역산업성장성', icon='▤', file=None),
    dict(key='S5', name='교통인프라 접근성', icon='◇', file=None),
    dict(key='S6', name='생활인프라 편리성', icon='◍', file=None),
    dict(key='S7', name='친환경성', icon='△',
         file='국토종합진단지수_S7', head=2, skip=[],
         dirs={1: '-', 2: '-', 3: '-', 4: '+'}),
    dict(key='S8', name='지역사회건강도', icon='✚',
         file='국토종합진단지수_S8', head=0, skip=[],
         dirs={1: '-', 2: '-', 3: '-', 4: '-', 5: '-', 6: '-', 7: '+'}),
    # 지역안전지수는 여섯 영역 모두 1등급이 가장 안전하다. 지표체계 파일에는
    # 9.4 생활안전만 ▲로 적혀 있으나 같은 규칙이므로 ▼로 통일한다.
    dict(key='S9', name='지역사회안전', icon='⚑',
         file='국토종합진단지수_S9', head=0, skip=[],
         dirs={1: '-', 2: '-', 3: '-', 4: '-', 5: '-', 6: '-'}),
    dict(key='S10', name='재정건전성', icon='₩',
         file='국토종합진단지수_S10', head=0, skip=[],
         dirs={}),  # 자기 메타데이터에 방향 열이 있다
]

# 자료마다 시도 표기가 갈린다. 지도 경계 파일 표기에 맞춘다.
SIDO_FIX = {'전북특별자치도': '전라북도', '전남특별자치도': '전라남도'}

METHODS = [
    dict(key='minmax', label='Min-Max', short='MM', camp='간격보존형',
         formula='(x − 최소) / (최대 − 최소) × 100',
         range='0 ~ 100 (양끝 고정)',
         note='최솟값 0, 최댓값 100으로 고정. 값 간격을 선형으로 보존한다.'),
    dict(key='distance', label='거리기반', short='DI', camp='간격보존형',
         formula='x / 전국평균 × 100',
         range='상한 없음',
         note='100이 전국평균. LQ(입지지수) × 100과 같은 셈이다.'),
    dict(key='pctrank', label='백분위순위', short='PR', camp='순위전용형',
         formula='평균순위(1기준) / 전체 × 100',
         range='0 ~ 100 (고르게 퍼짐)',
         note='등수만 반영하고 값 간격은 버린다.'),
    dict(key='logistic', label='로지스틱', short='LG', camp='간격보존형',
         formula='100 / (1 + exp(−z)),  z = (x − 평균) / 표준편차',
         range='0 ~ 100 (양끝에 닿지 않음)',
         note='평균 근처를 벌리고 극단값을 눌러 준다.'),
]

COL_RE = re.compile(r'^S(\d+)_(\d+)_(\d+)$', re.I)          # S8_1_23
TOTAL_RE = re.compile(r'^S(\d+)_(\d{2,4})$', re.I)          # S9_21, S10_2024 — 부문 종합값


def s(x):
    if x is None:
        return ''
    t = str(x).strip()
    return '' if t in ('nan', 'NaT', 'None') else t


def year_of(text, fallback):
    m = re.search(r'(20\d{2})', s(text))
    return int(m.group(1)) if m else fallback


# ── 지표체계(참고1) — 준비중 부문의 이름·설명·방향을 여기서 가져온다 ──────────
def read_system():
    df = pd.read_excel(pick('참고1'), sheet_name='Sheet1', header=None)
    out, cur = {}, None
    for _, r in df.iterrows():
        a, b = s(r.iloc[0]), s(r.iloc[1])
        m = re.match(r'^S(\d+)\s*\.', a)
        if m:
            cur = f'S{m.group(1)}'
            out.setdefault(cur, [])
            continue
        m2 = re.match(r'^(\d+)\.\s*(\d+)\s*(.*)$', b)
        if cur and m2:
            out[cur].append(dict(
                no=int(m2.group(2)),
                label=m2.group(3).strip(),
                desc=s(r.iloc[2]),
                dir=('-' if '▼' in s(r.iloc[3]) else '+' if '▲' in s(r.iloc[3]) else None),
                years=s(r.iloc[4]),
                owner=a,
            ))
    return out


# ── 부문 하나 읽기 ───────────────────────────────────────────────────────────
def read_sector(sec, order):
    path = pick(sec['file'])
    df = pd.read_excel(path, sheet_name='시군구별_지표 정리', header=sec['head'])
    meta = pd.read_excel(path, sheet_name='메타데이터', header=0)

    cols = list(df.columns)
    sido_c, name_c = cols[0], cols[1]
    df[sido_c] = df[sido_c].map(lambda v: SIDO_FIX.get(s(v), s(v)))
    df[name_c] = df[name_c].map(s)
    df = df[df[name_c] != '']
    idx = {(a, b): i for i, (a, b) in enumerate(zip(df[sido_c], df[name_c]))}

    # 메타데이터: 항목코드 → 설명 묶음
    mcol = list(meta.columns)
    info = {}
    for _, r in meta.iterrows():
        code = s(r.iloc[0]).upper()
        if not COL_RE.match(code) and not TOTAL_RE.match(code):
            continue
        g = lambda n, d='': s(r[n]) if n in mcol else d
        info[code] = dict(
            label=g('지표명'),
            year=g('연도'),
            desc=g('지표 정의 및 설명'),
            formula=g('측정산식'),
            unit=g('단위') or g('원자료 단위'),
            source=g('자료출처'),
            note=g('비고'),
            dir=g('방향'),
        )

    inds, series = {}, {}
    for c in cols[2:]:
        code = s(c).upper()
        if s(c) in sec['skip'] or not COL_RE.match(code):
            continue
        _, no, yy = COL_RE.match(code).groups()
        no = int(no)
        md = info.get(code, {})
        iid = f"{sec['key']}_{no}"
        year = year_of(md.get('year'), 2000 + int(yy) if len(yy) == 2 else int(yy))

        if iid not in inds:
            d = sec['dirs'].get(no)
            if d is None:
                d = '-' if '▼' in md.get('dir', '') else '+'
            inds[iid] = dict(
                id=iid, sector=sec['key'], no=no,
                label=md.get('label', code) or code,
                dir=d,
                unit=md.get('unit', ''),
                desc=md.get('desc', ''),
                formula=md.get('formula', ''),
                source=md.get('source', ''),
                note=md.get('note', ''),
                years=[], cols={},
            )
        if year not in inds[iid]['years']:
            inds[iid]['years'].append(year)
        inds[iid]['cols'][str(year)] = code

        vals = []
        raw = df[c].tolist()
        for key in order:
            i = idx.get(key)
            v = None if i is None else pd.to_numeric(raw[i], errors='coerce')
            vals.append(None if v is None or pd.isna(v) else round(float(v), 6))
        series[code] = vals

    for v in inds.values():
        v['years'].sort()
    return sorted(inds.values(), key=lambda x: x['no']), series


def main():
    geo = json.load(open(GEO, encoding='utf-8'))
    order = [(f['properties']['sido'], f['properties']['name']) for f in geo['features']]
    order.sort()
    rows = [dict(sido=a, name=b) for a, b in order]

    system = read_system()
    out_sectors, out_inds, out_series = {}, [], {}

    for sec in SECTORS:
        base = dict(key=sec['key'], name=sec['name'], icon=sec['icon'])
        if not sec['file']:
            plan = system.get(sec['key'], [])
            out_sectors[sec['key']] = dict(
                base, ready=False, note='자료 준비중',
                inds=[i['id'] for i in []],
                planned=[dict(no=p['no'], label=p['label'], dir=p['dir'],
                              desc=p['desc'], years=p['years']) for p in plan],
            )
            print(f"{sec['key']:>4}  준비중 · 계획 지표 {len(plan)}개")
            continue

        inds, series = read_sector(sec, order)
        out_inds += inds
        out_series.update(series)
        out_sectors[sec['key']] = dict(base, ready=True, note='',
                                       inds=[i['id'] for i in inds], planned=[])

        # 지표체계와 방향이 어긋나면 알려 준다 (지표번호가 아니라 이름으로 대조)
        plan = {re.sub(r'[\s()·]', '', p['label']): p['dir'] for p in system.get(sec['key'], [])}
        for i in inds:
            k = re.sub(r'[\s()·]', '', i['label'])
            if plan.get(k) and plan[k] != i['dir']:
                print(f"   방향 확인 필요 {i['id']} {i['label']}: 자료 {i['dir']} / 지표체계 {plan[k]}")
        yrs = sorted({y for i in inds for y in i['years']})
        print(f"{sec['key']:>4}  {sec['name']} · 지표 {len(inds)}개 · 연도 {yrs}")

    filled = {k: sum(1 for v in vs if v is not None) for k, vs in out_series.items()}
    thin = {k: n for k, n in filled.items() if n < len(rows)}
    if thin:
        print('\n빈칸이 있는 계열:')
        for k, n in sorted(thin.items()):
            print(f'   {k}: {n}/{len(rows)}')

    payload = dict(
        meta=dict(
            n=len(rows),
            built='2026-07-28',
            source='국토종합진단지수 2차 취합 (2025-07-27) + 지표체계 V0721',
            note='표준화·부문점수·순위는 화면에서 계산한다. 이 파일에는 원값과 설명만 담는다.',
            reversal='방향 ▼ 지표는 x′ = 최대 + 최소 − x 로 뒤집은 뒤 표준화한다.',
            jeju='제주특별자치도는 광역 1곳이라 제주시·서귀포시에 같은 값이 들어간 지표가 있다.',
        ),
        sectorKeys=[s['key'] for s in SECTORS],
        sectors=out_sectors,
        indicators=out_inds,
        series=out_series,
        methods=METHODS,
        rows=rows,
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    kb = os.path.getsize(OUT) / 1024
    print(f'\n{OUT}  ({kb:,.0f} KB)')
    print(f'시군구 {len(rows)} · 지표 {len(out_inds)} · 계열 {len(out_series)}')


if __name__ == '__main__':
    main()
