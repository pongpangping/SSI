# 국토종합진단지수 자료 적재 (v3) — 2026-08-14 취합본 (9대 부문, S6 제외)
#
# v2에서 달라진 점
#   · 부문 아홉 개 전부 자료가 왔다. S6만 준비중으로 남는다(계획 지표는 이전 파일에서 승계).
#   · S5는 항목 코드가 세 토막(S5_1_1_21 = 지표 1 · 세부 1(승용차) · 2021)이라
#     '연도 앞까지'를 지표 열쇠로 삼는다. 세부(승용차/버스)는 각각 지표가 된다.
#   · 방향(▲/▼)은 자료가 말하는 것을 최우선으로 쓴다:
#     ① 메타의 '방향' 열(S10) ② 비고의 '방향 ▲/▼' 문구(S2·S5)
#     ③ 이전 자료·지표체계에서 확정한 방향(S1·S3·S4·S7·S8·S9)
#
# 실행: python3 scripts/build_data3.py

import json
import os
import re
import unicodedata

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'src', 'data', 'ssi.json')
GEO = os.path.join(ROOT, 'src', 'data', 'sigungu_geo.json')
PREV = os.path.join(ROOT, 'src', 'data', 'ssi.json')   # S6 계획 지표 승계용
SRC = '/home/claude/newdata'


def pick(prefix):
    for n in os.listdir(SRC):
        if unicodedata.normalize('NFC', n).startswith(prefix):
            return os.path.join(SRC, n)
    raise FileNotFoundError(prefix)


# head: 지표 시트에서 머리글 줄 (pandas header=)
# dirs: 지표 순번 → 방향 (자료에 방향 표기가 없을 때의 확정값)
SECTORS = [
    dict(key='S1', name='공간구조 효율성', icon='◫', file='국토종합진단지수_S1', head=0,
         # 3(유입중심성)은 높을수록 좋음 ▲ — 55차에서 바로잡음(그 전엔 ▼로 잘못 들어감).
         # 4·5(압축도·복합도)는 ▲, 6(평균 출근거리)은 짧을수록 효율적이라 ▼ — 확인받은 방향
         dirs={1: '+', 2: '+', 3: '+', 4: '+', 5: '+', 6: '-'}),
    dict(key='S2', name='인구활력도', icon='◈', file='국토종합진단지수_S2', head=2, dirs={}),
    dict(key='S3', name='지역경제활력도', icon='◐', file='국토종합진단지수_S3', head=0,
         dirs={1: '+', 2: '+', 3: '+', 4: '+', 5: '+'}),           # 지표체계 V0721 확정 방향
    dict(key='S4', name='지역산업성장성', icon='▤', file='국토종합진단지수_S4', head=0,
         dirs={1: '+', 2: '+', 3: '-', 4: '+', 5: '+', 6: '+', 7: '+', 8: '+'}),
    dict(key='S5', name='교통인프라 접근성', icon='◇', file='국토종합진단지수_S5', head=2, dirs={}),
    dict(key='S6', name='생활인프라 편리성', icon='◍', file=None),
    dict(key='S7', name='친환경성', icon='△', file='국토종합진단지수_S7', head=2,
         dirs={1: '-', 2: '-', 3: '-', 4: '+'}),
    dict(key='S8', name='지역사회건강도', icon='✚', file='국토종합진단지수_S8', head=0,
         dirs={1: '-', 2: '-', 3: '-', 4: '-', 5: '-', 6: '-', 7: '+'}),
    dict(key='S9', name='지역사회안전', icon='⚑', file='국토종합진단지수_S9', head=0,
         dirs={1: '-', 2: '-', 3: '-', 4: '-', 5: '-', 6: '-'}),
    dict(key='S10', name='재정건전성', icon='₩', file='국토종합진단지수_S10', head=0, dirs={}),
]

SIDO_FIX = {'전북특별자치도': '전라북도', '전남특별자치도': '전라남도'}

METHODS = [
    dict(key='minmax', label='Min-Max', short='MM', camp='간격보존형',
         formula='(x − 최소) / (최대 − 최소) × 100', range='0 ~ 100 (양끝 고정)',
         note='최솟값 0, 최댓값 100으로 고정. 값 간격을 선형으로 보존한다.'),
    dict(key='distance', label='거리기반', short='DI', camp='간격보존형',
         formula='x / 전국평균 × 100', range='상한 없음',
         note='100이 전국평균. LQ(입지지수) × 100과 같은 셈이다.'),
    dict(key='pctrank', label='백분위순위', short='PR', camp='순위전용형',
         formula='평균순위(1기준) / 전체 × 100', range='0 ~ 100 (고르게 퍼짐)',
         note='등수만 반영하고 값 간격은 버린다.'),
    dict(key='logistic', label='로지스틱', short='LG', camp='간격보존형',
         formula='100 / (1 + exp(−z)),  z = (x − 평균) / 표준편차',
         range='0 ~ 100 (양끝에 닿지 않음)',
         note='평균 근처를 벌리고 극단값을 눌러 준다.'),
]

# S5_1_1_21 같은 세 토막도 받는다: 열쇠 = 연도 앞까지 (S5_1_1)
COL_RE = re.compile(r'^S(\d+)_((?:\d+_)*\d+)_(\d{2})$', re.I)
TOTAL_RE = re.compile(r'^S(\d+)_(\d{2}|\d{4})$', re.I)          # S9_21 · S10_2024 — 부문 종합값(적재 안 함)


def s(x):
    if x is None:
        return ''
    t = str(x).strip()
    return '' if t in ('nan', 'NaT', 'None') else t


def year_of(text, fallback):
    m = re.search(r'(20\d{2})', s(text))
    return int(m.group(1)) if m else fallback


def dir_of(meta_dir, note, fallback):
    t = s(meta_dir)
    if '▼' in t: return '-'
    if '▲' in t: return '+'
    n = s(note)
    m = re.search(r'방향\s*([▲▼])', n)
    if m: return '-' if m.group(1) == '▼' else '+'
    return fallback


def read_sector(sec, order):
    path = pick(sec['file'])
    xl = pd.ExcelFile(path)
    sheet = next(n for n in xl.sheet_names if '지표' in n)
    msheet = next(n for n in xl.sheet_names if '메타' in n)
    df = pd.read_excel(path, sheet_name=sheet, header=sec['head'])
    meta = pd.read_excel(path, sheet_name=msheet, header=0)

    cols = list(df.columns)
    sido_c = next((c for c in cols if '시도' in s(c)), cols[0])
    name_c = next((c for c in cols if '시군구' in s(c) and '코드' not in s(c)), cols[1])
    df[sido_c] = df[sido_c].map(lambda v: SIDO_FIX.get(s(v), s(v)))
    df[name_c] = df[name_c].map(s)
    df = df[df[name_c] != '']
    idx = {(a, b): i for i, (a, b) in enumerate(zip(df[sido_c], df[name_c]))}

    miss = [k for k in order if k not in idx]
    if miss:
        print(f"   !! {sec['key']} 경계와 안 맞는 시군구 {len(miss)}곳: {miss[:5]}")

    mcol = list(meta.columns)
    info = {}
    for _, r in meta.iterrows():
        code = s(r.iloc[0]).upper()
        if not COL_RE.match(code):
            continue
        def g(n, d=''):
            return s(r[n]) if n in mcol else d
        info[code] = dict(
            label=g('지표명'), year=g('연도') or g('자료기준시점'),
            desc=g('지표 정의 및 설명'), formula=g('측정산식'),
            unit=g('단위') or g('원자료 단위'), source=g('자료출처'),
            note=g('비고'), dir=g('방향'),
        )

    inds, series, keyno = {}, {}, {}
    for c in cols:
        code = s(c).upper()
        m = COL_RE.match(code)
        if not m:
            continue
        mid, yy = m.group(2), m.group(3)
        ikey = f"S{m.group(1)}_{mid}"                     # 지표 열쇠 (S5_1_1 포함)
        md = info.get(code, {})
        year = year_of(md.get('year'), 2000 + int(yy))

        if ikey not in inds:
            keyno[ikey] = len(keyno) + 1
            no = keyno[ikey]
            # 자료 명시 방향 → 순번 확정 방향 → ▲
            base_no = int(mid.split('_')[0])
            fb = sec['dirs'].get(base_no, '+')
            d = dir_of(md.get('dir'), md.get('note'), fb)
            label = md.get('label') or ikey
            desc, formula = md.get('desc', ''), md.get('formula', '')
            if desc == label and formula:                 # S4처럼 정의가 산식 칸에 적힌 파일
                desc, formula = formula, ''
            inds[ikey] = dict(
                id=ikey, sector=sec['key'], no=no, label=label, dir=d,
                unit=md.get('unit', ''), desc=desc, formula=formula,
                source=md.get('source', ''), note=md.get('note', ''),
                years=[], cols={},
            )
        if year not in inds[ikey]['years']:
            inds[ikey]['years'].append(year)
        inds[ikey]['cols'][str(year)] = code

        raw = df[c].tolist()
        vals = []
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
    order = sorted(set(order))
    rows = [dict(sido=a, name=b) for a, b in order]
    prev = json.load(open(PREV, encoding='utf-8'))

    out_sectors, out_inds, out_series = {}, [], {}
    for sec in SECTORS:
        base = dict(key=sec['key'], name=sec['name'], icon=sec['icon'])
        if not sec['file']:
            planned = prev['sectors'].get(sec['key'], {}).get('planned', [])
            out_sectors[sec['key']] = dict(base, ready=False, note='자료 준비중',
                                           inds=[], planned=planned)
            print(f"{sec['key']:>4}  준비중 · 계획 지표 {len(planned)}개")
            continue
        inds, series = read_sector(sec, order)
        out_inds += inds
        out_series.update(series)
        out_sectors[sec['key']] = dict(base, ready=True, note='',
                                       inds=[i['id'] for i in inds], planned=[])
        yrs = sorted({y for i in inds for y in i['years']})
        dirs = ''.join('▼' if i['dir'] == '-' else '▲' for i in inds)
        print(f"{sec['key']:>4}  {sec['name']} · 지표 {len(inds)}개 [{dirs}] · 연도 {yrs[0]}~{yrs[-1]} · 계열 {sum(len(i['cols']) for i in inds)}")

    filled = {k: sum(1 for v in vs if v is not None) for k, vs in out_series.items()}
    thin = {k: n for k, n in filled.items() if n < len(rows)}
    if thin:
        print('\n빈칸이 있는 계열:')
        for k, n in sorted(thin.items()):
            print(f'   {k}: {n}/{len(rows)}')

    payload = dict(
        meta=dict(
            n=len(rows), built='2026-08-14',
            source='2026년 국토모니터링 부문별 지수 취합 (2026-08-14) · 9대 부문 (S6 제외)',
            note='표준화·부문점수·순위는 화면에서 계산한다. 이 파일에는 원값과 설명만 담는다.',
            reversal='방향 ▼ 지표는 x′ = 최대 + 최소 − x 로 뒤집은 뒤 표준화한다.',
            jeju='제주특별자치도는 광역 1곳이라 제주시·서귀포시에 같은 값이 들어간 지표가 있다.',
        ),
        sectorKeys=[x['key'] for x in SECTORS],
        sectors=out_sectors,
        indicators=out_inds,
        series=out_series,
        methods=METHODS,
        rows=rows,
    )
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    kb = os.path.getsize(OUT) / 1024
    print(f'\n{OUT}  ({kb:,.0f} KB)')
    print(f'시군구 {len(rows)} · 지표 {len(out_inds)} · 계열 {len(out_series)}')


if __name__ == '__main__':
    main()
