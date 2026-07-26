# -*- coding: utf-8 -*-
"""표준화 공식 역산 검증.
   원자료 컬럼만으로 4개 방법의 CI를 다시 계산해 xlsx의 CI 컬럼과 일치하는지 확인한다.
   → 웹에서 실시간 표준화(src/lib/standardize.js)를 돌려도 원자료와 어긋나지 않음을 보증.
"""
import openpyxl, math, bisect, statistics as st

SRC = '/mnt/user-data/uploads/Downloads/파일럿_분석결과.xlsx'
wb = openpyxl.load_workbook(SRC, data_only=True)
rows = list(wb['분석결과'].iter_rows(values_only=True))
HDR = list(rows[0]); DATA = [dict(zip(HDR, r)) for r in rows[1:] if r[0]]
col = lambda c: [float(d[c]) for d in DATA]

# 방향 −1 지표 반전:  x' = max + min − x   (선형 반전, 순서만 뒤집고 간격은 보존)
rev = lambda v: [max(v) + min(v) - x for x in v]

def minmax(v):
    lo, hi = min(v), max(v)
    return [(x - lo) / (hi - lo) * 100 for x in v]

def distance(v):
    m = sum(v) / len(v)
    return [x / m * 100 for x in v]

def pctrank(v):                       # pandas rank(pct=True) 와 동일: 평균순위(1기준)/N
    s = sorted(v); N = len(v); out = []
    for x in v:
        lo = bisect.bisect_left(s, x); hi = bisect.bisect_right(s, x)
        out.append(((lo + hi + 1) / 2) / N * 100)
    return out

def logistic(v):                      # 표본표준편차(ddof=1) 사용
    m = sum(v) / len(v); sd = st.stdev(v)
    return [100 / (1 + math.exp(-(x - m) / sd)) for x in v]

FN = {'MinMax': minmax, 'Distance': distance, 'PctRank': pctrank, 'Logistic': logistic}
SECT = {
    'S1': [('거점화율', '+'), ('거점부 인구집중도', '+')],
    'S8': [('사망률', '-'), ('비만율', '-'), ('암발생률', '-'), ('고혈압 유병률', '-'),
           ('당뇨 유병률', '-'), ('의료이용미충족율', '-'), ('주관적 건강인지율', '+')],
}

ok = True
for s, inds in SECT.items():
    for mname, fn in FN.items():
        parts = []
        for label, d in inds:
            v = col(f'{s}_원자료_{label}')
            parts.append(fn(v if d == '+' else rev(v)))
        ci = [sum(c) / len(c) for c in zip(*parts)]     # 동일가중 평균
        ref = [float(d[f'{s}_CI_{mname}']) for d in DATA]
        err = max(abs(a - b) for a, b in zip(ci, ref))
        print(f'{s} {mname:9s} 최대오차 {err:.6f}  {"OK" if err < 5e-3 else "MISMATCH"}')
        ok &= err < 5e-3

print('\n검증 결과:', '전 항목 일치' if ok else '불일치 존재')
