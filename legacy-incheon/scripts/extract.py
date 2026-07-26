#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인천광역시 1인가구 · 세대구조 대시보드 — 데이터 추출기
================================================================
원본(표 형식) → 정제/집계 → React가 읽는 정적 JSON/GeoJSON 생성.
서버 없이 '빌드 타임 전처리기'로만 동작한다.

입력 (data/raw/)
  1) kosis_household_2023.csv   KOSIS DT_1JC1511
        가구주의 연령 및 가구원수별 가구(일반가구) - 시군구, 2023 (cp949)
  2) jumin_2025_monthly.csv     행정안전부 주민등록 인구 및 세대현황
        2025년 월별 · 전체읍면동현황 (cp949)
  3) data/raw/N3A_G0110000/*.shp  국토지리정보원 연속수치지형도 행정경계(읍면동)
        속성: BJCD(법정동코드 10자리), NAME, DIVI ...  → 인천만(28) 필터 후 시군구로 dissolve

출력 (src/data/)
  sido_summary.json   인천 전체 KPI
  sigungu.json        시군구 10개 지표
  trend.json          2025 월별 추이(세대수/세대당인구/1인세대추정)
  meta.json           출처·갱신일 등 메타
  incheon.geojson     시군구 경계(EPSG:4326)  ※ 3)이 있을 때만 생성

실행:  python scripts/extract.py
의존성: pandas, (지도용) geopandas  →  pip install -r scripts/requirements.txt
"""
from __future__ import annotations
import csv
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)

# ── 인천 10개 시군구: 이름 → 시군구코드(5자리) ──────────────────────────
SIGUNGU = {
    "중구": "28110",
    "동구": "28140",
    "미추홀구": "28177",
    "연수구": "28185",
    "남동구": "28200",
    "부평구": "28237",
    "계양구": "28245",
    "서구": "28260",
    "강화군": "28710",
    "옹진군": "28720",
}
# 주민등록 CSV의 10자리 행정코드(앞 5자리) → 시군구코드
JUMIN_CODE = {
    "2811000000": "28110", "2814000000": "28140", "2817700000": "28177",
    "2818500000": "28185", "2820000000": "28200", "2823700000": "28237",
    "2824500000": "28245", "2826000000": "28260", "2871000000": "28710",
    "2872000000": "28720",
}
CODE2NAME = {v: k for k, v in SIGUNGU.items()}
YOUNG_BANDS = {"15~19세", "20~24세", "25~29세", "30~34세", "35~39세"}
MID_BANDS = {"40~44세", "45~49세", "50~54세", "55~59세", "60~64세"}
AGED_BANDS = {"65~69세", "70~74세", "75~79세", "80~84세", "85세 이상"}


def num(v):
    """'1,234' / '  2.09' / 'X'(비밀보호) / '' → float|int|None"""
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s in ("", "X", "-", "…", "N/A"):
        return None
    try:
        f = float(s)
        return int(f) if f == int(f) else f
    except ValueError:
        return None


# ── 1) KOSIS 가구원수별 가구(2023) ────────────────────────────────────
def parse_kosis():
    path = RAW / "kosis_household_2023.csv"
    rows = list(csv.reader(open(path, encoding="cp949")))
    # 헤더 2줄: [행정구역, 가구주연령, 일반가구, 가구원수1명..7명이상, 평균가구원수]
    data = rows[2:]
    by_gu = {}  # name -> {"total": row합계, "aged1": 65+ 1인가구}
    for r in data:
        name, age = r[0].strip(), r[1].strip()
        if name not in SIGUNGU:
            continue
        rec = by_gu.setdefault(name, {"young_one": 0, "mid_one": 0, "aged_one": 0})
        vals = [num(x) for x in r[2:]]
        general, h1, h2, h3, h4, h5, h6, h7, avg = vals
        if age == "합계":
            rec["general"] = general or 0
            rec["h1"] = h1 or 0
            rec["h2"] = h2 or 0
            rec["h3"] = h3 or 0
            rec["h4plus"] = (h4 or 0) + (h5 or 0) + (h6 or 0) + (h7 or 0)
            rec["avg_size"] = avg
        elif age in YOUNG_BANDS:
            rec["young_one"] += (h1 or 0)     # 청년(20~39) 1인가구
        elif age in MID_BANDS:
            rec["mid_one"] += (h1 or 0)       # 중년(40~64) 1인가구
        elif age in AGED_BANDS:
            rec["aged_one"] += (h1 or 0)      # 고령(65+) 1인가구
    out = {}
    for name, rec in by_gu.items():
        code = SIGUNGU[name]
        g = rec["general"] or 0
        one = rec["h1"] or 0
        young, mid, aged = rec["young_one"], rec["mid_one"], rec["aged_one"]
        y_sh = round(young / one * 100, 1) if one else None
        o_sh = round(aged / one * 100, 1) if one else None
        out[code] = {
            "code": code,
            "name": name,
            "generalHouseholds": g,
            "onePerson": one,
            "twoPerson": rec["h2"],
            "threePerson": rec["h3"],
            "fourPlusPerson": rec["h4plus"],
            "onePersonRate": round(one / g * 100, 1) if g else None,
            "avgHouseholdSize": rec["avg_size"],
            "youngOne": young, "midOne": mid, "agedOnePerson": aged,
            "youngOneShare": y_sh,
            "midOneShare": round(mid / one * 100, 1) if one else None,
            "agedOneShareOfOne": o_sh,
        }
    return out


# ── 2) 행정안전부 주민등록(2025 월별) ─────────────────────────────────
def parse_jumin():
    path = RAW / "jumin_2025_monthly.csv"
    reader = csv.reader(open(path, encoding="cp949"))
    header = next(reader)
    # 컬럼 패턴: "2025년MM월_거주자 인구수", "..세대수", "..세대당 인구", "..남자..", "..여자.."
    months = []
    for h in header[1:]:
        m = re.match(r"(\d{4})년(\d{2})월_(.+)", h)
        if m:
            ym, field = f"{m.group(1)}-{m.group(2)}", m.group(3).strip()
            if ym not in months:
                months.append(ym)
    # 시군구별 행 수집
    gu_rows = {}       # code5 -> row(list)
    for r in reader:
        name = r[0]
        mcode = re.search(r"\((\d+)\)", name)
        if not mcode:
            continue
        code10 = mcode.group(1)
        if code10 in JUMIN_CODE:
            gu_rows[JUMIN_CODE[code10]] = r

    def cell(row, ym, field):
        # 헤더에서 해당 열 인덱스 탐색
        target = f"{ym[:4]}년{ym[5:7]}월_{field}"
        for i, h in enumerate(header):
            if h == target:
                return num(row[i])
        return None

    latest = months[-1]
    per_gu = {}
    for code, row in gu_rows.items():
        per_gu[code] = {
            "population": cell(row, latest, "거주자 인구수"),
            "households": cell(row, latest, "세대수"),
            "avgHouseholdSize": cell(row, latest, "세대당 인구"),
            "male": cell(row, latest, "남자 인구수"),
            "female": cell(row, latest, "여자 인구수"),
        }
    # 인천 전체 월별 추이 (시군구 합산)
    trend = []
    for ym in months:
        pop = hh = 0
        for row in gu_rows.values():
            pop += cell(row, ym, "거주자 인구수") or 0
            hh += cell(row, ym, "세대수") or 0
        trend.append({
            "month": ym,
            "population": pop,
            "households": hh,
            "avgHouseholdSize": round(pop / hh, 3) if hh else None,
        })
    return per_gu, trend, latest, months


# ── 3) 경계 SHP → 시군구 GeoJSON ──────────────────────────────────────
#   기본은 GDAL 불필요한 순수 파이썬(pyshp+pyproj) 경로.
#   geopandas 가 있으면 더 깔끔하게(디졸브·폴리곤화) 처리.
def _write_geojson(features):
    fc = {"type": "FeatureCollection", "features": features}
    txt = json.dumps(fc, ensure_ascii=False)
    # 단일 HTML 빌드를 위해 경계를 src/data 에 내장(import 대상)
    p1 = OUT / "incheonGeo.json"
    p1.write_text(txt, "utf-8")
    # 개발용 fetch 호환 위해 public 에도 (선택)
    pub = ROOT / "public" / "data"
    pub.mkdir(parents=True, exist_ok=True)
    (pub / "incheon.geojson").write_text(txt, "utf-8")
    print(f"  [완료] src/data/incheonGeo.json (+public)  ({len(features)}개 시군구)")
    return True


def _find_bjcd(field_names):
    up = {n.upper(): n for n in field_names}
    return up.get("BJCD") or up.get("EMD_CD") or up.get("ADM_CD")


def _decimate(ring, target=90):
    """링을 target 점 수준으로 '부드럽게' 경량화 (작은 링은 그대로 유지)."""
    n = len(ring)
    if n <= target:
        pts = ring
    else:
        step = max(1, n // target)
        pts = ring[::step]
        if pts[-1] != ring[-1]:
            pts.append(ring[-1])
    return [[round(x, 5), round(y, 5)] for x, y in pts]


def _geojson_pyshp(shps):
    try:
        import shapefile  # pyshp
        from pyproj import CRS, Transformer
    except ImportError as e:
        print(f"  [정보] pyshp/pyproj 임포트 실패({e.name}) → 다른 경로 시도")
        return None  # 이 경로 사용 불가 → 다른 경로 시도
    from collections import defaultdict

    groups = defaultdict(list)  # SIG_CD -> [polygon(=rings), ...]
    for shp in shps:
        prj = shp.with_suffix(".prj")
        src = CRS.from_wkt(prj.read_text()) if prj.exists() else CRS.from_epsg(5186)
        tf = Transformer.from_crs(src, CRS.from_epsg(4326), always_xy=True)
        try:
            r = shapefile.Reader(str(shp), encoding="cp949")
        except Exception:
            r = shapefile.Reader(str(shp), encoding="latin1")
        if r.shapeType not in (5, 15, 25):  # POLYGON 계열이 아니면(선 등) 이 경로 포기
            print(f"  [정보] {shp.name} 이 폴리곤이 아님(shapeType={r.shapeType}) → geopandas 경로 필요")
            return False
        names = [f[0] for f in r.fields[1:]]
        bjcd_name = _find_bjcd(names)
        if not bjcd_name:
            print("  [경고] 법정동코드(BJCD) 필드를 못 찾음")
            return False
        bi = names.index(bjcd_name)
        seen28 = defaultdict(int)   # 진단용: 인천 코드별 읍면동 개수
        for sr in r.iterShapeRecords():
            code = re.sub(r"\D", "", str(sr.record[bi]))[:5]
            if not code.startswith("28"):
                continue
            seen28[code] += 1
            if code not in CODE2NAME:
                continue
            try:
                geo = sr.shape.__geo_interface__
            except Exception:
                continue
            gtype = geo.get("type")
            if gtype not in ("Polygon", "MultiPolygon"):
                continue
            polys = [geo["coordinates"]] if gtype == "Polygon" else geo["coordinates"]
            for poly in polys:
                rings = []
                for ring in poly:
                    lonlat = []
                    for x, y in ring:
                        lon, lat = tf.transform(x, y)
                        if math.isfinite(lon) and math.isfinite(lat):
                            lonlat.append((lon, lat))
                    dec = _decimate(lonlat)
                    if len(dec) >= 4:                    # 빈/degenerate 링 제거
                        if dec[0] != dec[-1]:            # 링 닫기
                            dec.append(dec[0])
                        rings.append(dec)
                if rings:                                # 외곽 링이 있는 폴리곤만
                    groups[code].append(rings)
        # 진단: 파일에 있는 인천 코드 vs 결과
        if seen28:
            miss = [c for c in CODE2NAME if c not in groups]
            print(f"  [진단] 파일 내 인천(28) 코드 {len(seen28)}종 · 결과 시군구 {len(groups)}개"
                  + (f" · 누락 {[CODE2NAME.get(c, c) for c in miss]}" if miss else ""))

    if not groups:
        print("  [경고] 인천(코드 28) 폴리곤을 못 찾음")
        return False

    # 읍면동 → 시군구 디졸브 (내부 경계선 제거). shapely 있으면 union, 없으면 MultiPolygon 유지.
    try:
        from shapely.geometry import Polygon, mapping
        from shapely.ops import unary_union
        features = []
        for code, polys in sorted(groups.items()):
            shp = []
            for rings in polys:
                try:
                    shp.append(Polygon(rings[0], rings[1:]))
                except Exception:
                    pass
            if not shp:
                continue
            merged = unary_union([p.buffer(0) for p in shp])
            features.append({
                "type": "Feature",
                "properties": {"SIG_CD": code, "SIG_KOR_NM": CODE2NAME[code]},
                "geometry": mapping(merged),
            })
        print("  [정보] shapely 디졸브 적용 — 시군구 단위 경계")
    except ImportError:
        features = [{
            "type": "Feature",
            "properties": {"SIG_CD": code, "SIG_KOR_NM": CODE2NAME[code]},
            "geometry": {"type": "MultiPolygon", "coordinates": polys},
        } for code, polys in sorted(groups.items())]
        print("  [정보] shapely 미설치 — 읍면동 경계선이 보일 수 있음 (pip install shapely 권장)")
    return _write_geojson(features)


def _geojson_geopandas(shps):
    try:
        import geopandas as gpd
        import pandas as pd
        from shapely.ops import polygonize, unary_union
    except ImportError:
        return None
    frames = [gpd.read_file(s) for s in shps]
    gdf = frames[0] if len(frames) == 1 else \
        gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs=frames[0].crs)
    bjcd = _find_bjcd(list(gdf.columns))
    if bjcd is None:
        print("  [경고] 법정동코드(BJCD) 컬럼을 못 찾음")
        return False
    gdf["SIG_CD"] = gdf[bjcd].astype(str).str.replace(r"\D", "", regex=True).str[:5]
    gdf = gdf[gdf["SIG_CD"].isin(CODE2NAME.keys())].copy()
    if gdf.crs is None:
        gdf = gdf.set_crs(5186, allow_override=True)
    if set(gdf.geom_type.unique()) & {"LineString", "MultiLineString"}:
        polys = []
        for code, sub in gdf.groupby("SIG_CD"):
            faces = list(polygonize(unary_union(sub.geometry.values)))
            if faces:
                polys.append({"SIG_CD": code, "geometry": unary_union(faces)})
        gdf = gpd.GeoDataFrame(polys, crs=gdf.crs)
    else:
        gdf = gdf.dissolve(by="SIG_CD", as_index=False)[["SIG_CD", "geometry"]]
    gdf["SIG_KOR_NM"] = gdf["SIG_CD"].map(CODE2NAME)
    gdf = gdf.to_crs(4326)
    gdf["geometry"] = gdf.geometry.simplify(0.0003, preserve_topology=True)
    import json as _json
    features = _json.loads(gdf.to_json())["features"]
    return _write_geojson(features)


def build_geojson():
    shp_dir = RAW / "N3A_G0110000"
    shps = list(shp_dir.glob("*.shp")) if shp_dir.exists() else []
    if not shps:
        print("  [건너뜀] data/raw/N3A_G0110000/*.shp 없음 → incheon.geojson 미생성")
        return False
    # 1순위: 순수 파이썬(pyshp+pyproj) — GDAL 불필요
    res = _geojson_pyshp(shps)
    if res is True:
        return True
    # 2순위: geopandas (설치돼 있으면)
    if _geojson_geopandas(shps) is True:
        return True
    print("  [경고] 경계 변환 실패 — 지금 이 파이썬에 pyshp/pyproj 가 없습니다.")
    print("         아래처럼 '같은 인터프리터'로 설치 후 재실행하세요:")
    print(f"           {sys.executable} -m pip install pyshp pyproj")
    print(f"           {sys.executable} scripts/extract.py")
    return False


# ── 격자(그리드) 밀집도 ────────────────────────────────────────────────
# 우선순위:
#   1) data/raw/grid/*.shp  (통계청 SGIS 격자 통계, EPSG:5179) 가 있으면 실제 값 사용
#   2) 없으면 시군구 경계 + 1인가구 수로 '표본 격자' 생성 (sample=True 로 표기)
# 출력: src/data/incheonGrid.json  { sample, unit, step, cells:[{v,geometry}] }

def _grid_from_sgis(shp, code_geoms):
    """SGIS 격자 SHP → 인천 영역 셀. 값 필드는 자동 탐지."""
    import shapefile
    from pyproj import CRS, Transformer
    from shapely.geometry import shape as shp_shape, box

    prj = shp.with_suffix(".prj")
    src = CRS.from_wkt(prj.read_text()) if prj.exists() else CRS.from_epsg(5179)
    tf = Transformer.from_crs(src, CRS.from_epsg(4326), always_xy=True)
    try:
        r = shapefile.Reader(str(shp), encoding="cp949")
    except Exception:
        r = shapefile.Reader(str(shp), encoding="latin1")
    names = [f[0] for f in r.fields[1:]]
    # 값 필드 후보: 이름에 가구/인구/1인/val/cnt/tot 등이 들어간 숫자형
    key = None
    for cand in names:
        low = cand.lower()
        if any(t in low for t in ("val", "cnt", "count", "tot", "가구", "인구", "1인", "num")):
            key = cand
            break
    ki = names.index(key) if key else 0
    # 인천 전체 경계로 합쳐 bbox 필터
    from shapely.ops import unary_union
    incheon = unary_union(list(code_geoms.values()))
    minx, miny, maxx, maxy = incheon.bounds
    cells = []
    for sr in r.iterShapeRecords():
        try:
            v = float(re.sub(r"[^\d.]", "", str(sr.record[ki])) or 0)
        except Exception:
            v = 0
        if v <= 0:
            continue
        geo = sr.shape.__geo_interface__
        rings = geo["coordinates"] if geo["type"] == "Polygon" else geo["coordinates"][0]
        pts = [tf.transform(x, y) for x, y in rings[0]]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        if not (minx <= cx <= maxx and miny <= cy <= maxy):
            continue
        if not incheon.contains(box(min(xs), min(ys), max(xs), max(ys)).centroid):
            continue
        cells.append({"v": round(v), "geometry": {
            "type": "Polygon", "coordinates": [[[round(x, 6), round(y, 6)] for x, y in pts]]}})
    return cells


def _grid_sample(code_geoms, values, step=0.0055):
    """시군구 경계 + 1인가구 수로 표본 격자 생성 (구별 합이 실제 1인가구 수에 근접)."""
    import random
    from shapely.geometry import Point, box
    random.seed(28)
    cells = []
    for code, geom in code_geoms.items():
        one = values.get(code) or 0
        if one <= 0 or geom.is_empty:
            continue
        minx, miny, maxx, maxy = geom.bounds
        cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
        # 셀 격자 위 후보 수집
        cand, weights = [], []
        gx = minx
        i = 0
        while gx < maxx:
            gy = miny
            j = 0
            while gy < maxy:
                center = Point(gx + step / 2, gy + step / 2)
                if geom.contains(center):
                    # 부드러운 공간장 + 중심부 가중 + 결정적 잡음
                    field = 0.5 * (1 + math.sin(i * 0.6) * math.cos(j * 0.5)) \
                        + 0.5 * (1 + math.sin((i + j) * 0.3))
                    dist = math.hypot((center.x - cx), (center.y - cy))
                    span = max(maxx - minx, maxy - miny) / 2 or 1
                    core = max(0.15, 1 - (dist / span) * 0.8)
                    w = (0.3 + field) * core * (0.85 + random.random() * 0.3)
                    cand.append((gx, gy)); weights.append(w)
                gy += step; j += 1
            gx += step; i += 1
        tot = sum(weights) or 1
        for (gx, gy), w in zip(cand, weights):
            v = round(one * w / tot)
            if v <= 0:
                continue
            cells.append({"v": v, "geometry": {"type": "Polygon", "coordinates": [[
                [round(gx, 6), round(gy, 6)], [round(gx + step, 6), round(gy, 6)],
                [round(gx + step, 6), round(gy + step, 6)], [round(gx, 6), round(gy + step, 6)],
                [round(gx, 6), round(gy, 6)]]]}})
    return cells


def build_grid(sigungu):
    try:
        import json as _json
        from shapely.geometry import shape as shp_shape
    except ImportError:
        print("  [건너뜀] shapely 없음 → 격자 미생성")
        return
    geo_path = OUT / "incheonGeo.json"
    if not geo_path.exists():
        print("  [건너뜀] incheonGeo.json 없음 → 격자 미생성")
        return
    fc = json.loads(geo_path.read_text("utf-8"))
    code_geoms = {}
    for f in fc.get("features", []):
        code = str(f["properties"].get("SIG_CD"))[:5]
        try:
            code_geoms[code] = shp_shape(f["geometry"]).buffer(0)
        except Exception:
            pass
    values = {s["code"]: s.get("onePerson") for s in sigungu}

    grid_dir = RAW / "grid"
    shps = list(grid_dir.glob("*.shp")) if grid_dir.exists() else []
    if shps:
        try:
            cells = _grid_from_sgis(shps[0], code_geoms)
            sample, unit = False, "1인가구 수 / 셀"
            print(f"  [정보] SGIS 격자 사용 — {shps[0].name} ({len(cells)}셀)")
        except Exception as e:
            print(f"  [경고] SGIS 격자 처리 실패({e}) → 표본 격자로 대체")
            cells = _grid_sample(code_geoms, values); sample, unit = True, "추정 1인가구 수 / 셀(표본)"
    else:
        cells = _grid_sample(code_geoms, values)
        sample, unit = True, "추정 1인가구 수 / 셀(표본)"
        print(f"  [정보] 표본 격자 생성 — {len(cells)}셀 (data/raw/grid/*.shp 넣으면 실제값 사용)")

    out = {"sample": sample, "unit": unit, "count": len(cells), "cells": cells}
    (OUT / "incheonGrid.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    pub = ROOT / "public" / "data"
    pub.mkdir(parents=True, exist_ok=True)
    (pub / "incheonGrid.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    print(f"  [완료] src/data/incheonGrid.json ({len(cells)}셀, {'표본' if sample else '실제'})")


def main():
    print("▶ 인천 1인가구·세대구조 데이터 추출")
    print("· KOSIS 가구 데이터…")
    kosis = parse_kosis()
    print("· 주민등록 데이터…")
    jumin, trend, latest, months = parse_jumin()

    # 시군구 병합
    sigungu = []
    for code, name in CODE2NAME.items():
        k = kosis.get(code, {})
        j = jumin.get(code, {})
        sigungu.append({
            "code": code,
            "name": name,
            # KOSIS(2023) 가구 구성
            "generalHouseholds": k.get("generalHouseholds"),
            "onePerson": k.get("onePerson"),
            "twoPerson": k.get("twoPerson"),
            "threePerson": k.get("threePerson"),
            "fourPlusPerson": k.get("fourPlusPerson"),
            "onePersonRate": k.get("onePersonRate"),
            "avgHouseholdSize2023": k.get("avgHouseholdSize"),
            # 1인가구 연령구조 + 정책 유형
            "youngOne": k.get("youngOne"),
            "midOne": k.get("midOne"),
            "agedOnePerson": k.get("agedOnePerson"),
            "youngOneShare": k.get("youngOneShare"),
            "midOneShare": k.get("midOneShare"),
            "agedOneShareOfOne": k.get("agedOneShareOfOne"),
            # 주민등록(최신월) 인구/세대
            "population": j.get("population"),
            "households": j.get("households"),
            "avgHouseholdSize": j.get("avgHouseholdSize"),
            "male": j.get("male"),
            "female": j.get("female"),
        })
    sigungu.sort(key=lambda x: (x["onePersonRate"] is None, -(x["onePersonRate"] or 0)))

    # 인천 전체 요약
    tot_general = sum(s["generalHouseholds"] or 0 for s in sigungu)
    tot_one = sum(s["onePerson"] or 0 for s in sigungu)
    tot_aged_one = sum(s["agedOnePerson"] or 0 for s in sigungu)
    tot_pop = sum(s["population"] or 0 for s in sigungu)
    tot_hh = sum(s["households"] or 0 for s in sigungu)
    summary = {
        "region": "인천광역시",
        "onePersonRate": round(tot_one / tot_general * 100, 1) if tot_general else None,
        "onePerson": tot_one,
        "generalHouseholds": tot_general,
        "agedOnePerson": tot_aged_one,
        "agedOneShareOfOne": round(tot_aged_one / tot_one * 100, 1) if tot_one else None,
        "population": tot_pop,
        "households": tot_hh,
        "avgHouseholdSize": round(tot_pop / tot_hh, 2) if tot_hh else None,
        "householdGrowthPct": round(
            (trend[-1]["households"] - trend[0]["households"]) / trend[0]["households"] * 100, 2
        ) if trend and trend[0]["households"] else None,
    }
    meta = {
        "title": "인천광역시 1인가구 · 세대구조 대시보드",
        "sources": [
            {"label": "KOSIS 가구주의 연령 및 가구원수별 가구(일반가구)-시군구 (DT_1JC1511)",
             "year": "2023", "org": "통계청 인구총조사"},
            {"label": "행정안전부 주민등록 인구 및 세대현황",
             "period": f"{months[0]} ~ {months[-1]}", "org": "행정안전부"},
            {"label": "연속수치지형도 행정경계(읍면동) N3A_G0110000",
             "org": "국토지리정보원"},
        ],
        "latestMonth": latest,
        "note": "가구(KOSIS·2023, 인구총조사)와 세대(주민등록·2025)는 정의가 다름 — 구분해 해석.",
    }

    (OUT / "sigungu.json").write_text(json.dumps(sigungu, ensure_ascii=False, indent=2), "utf-8")
    (OUT / "sido_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), "utf-8")
    (OUT / "trend.json").write_text(json.dumps(trend, ensure_ascii=False, indent=2), "utf-8")
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), "utf-8")
    print(f"· JSON 저장 완료 → {OUT}")

    print("· 경계 GeoJSON…")
    build_geojson()
    print("· 격자 밀집도…")
    build_grid(sigungu)
    print("✔ 완료")


if __name__ == "__main__":
    sys.exit(main())
