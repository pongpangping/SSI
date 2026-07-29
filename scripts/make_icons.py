# -*- coding: utf-8 -*-
"""부문 아이콘 생성기.

화면에 글리프 문자(◫ ◈ △ …)를 그대로 쓰면 글꼴에 따라 모양·굵기·세로 위치가
제각각이라 아이콘 구실을 못 한다. 그래서 부문마다 선화(line icon)를 정의하고
PNG로 구워서 쓴다.

    python3 scripts/make_icons.py

  → src/assets/icons/{키}.png       (96px, 기본색 / 선택색 2벌)
  → src/lib/icons.js                (번들에 넣을 data URI 표)

단일 파일(index.html)로 빌드하기 때문에 PNG를 외부 파일로 두면 경로가 깨진다.
그래서 base64 data URI로 옮겨 담은 icons.js를 함께 만든다.
"""
import base64
import os
import re

import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUTDIR = os.path.join(ROOT, 'src', 'assets', 'icons')
JSOUT = os.path.join(ROOT, 'src', 'lib', 'icons.js')

SIZE = 96          # 화면에서는 14~20px로 쓰지만 고밀도 화면을 감안해 넉넉히 굽는다
INK = '#5A6A7D'    # 기본
ON = '#0A6FB3'     # 선택된 부문
LOCK = '#9AA6B4'   # 자료 준비중

# viewBox 24×24 · 선 굵기 1.7 · 둥근 끝
SHAPES = {
    # 공간구조 효율성 — 격자 위의 거점
    'S1': '''
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.6"/>
      <path d="M9.4 3.4V20.6M14.6 3.4V20.6M3.4 9.4H20.6M3.4 14.6H20.6"/>
      <rect x="9.4" y="9.4" width="5.2" height="5.2" fill="CUR" stroke="none"/>''',
    # 인구활력도 — 사람 둘
    'S2': '''
      <circle cx="9.2" cy="8.2" r="2.7"/>
      <path d="M4.2 19.4c0-3 2.2-5.2 5-5.2s5 2.2 5 5.2"/>
      <circle cx="16.8" cy="9.8" r="2.1"/>
      <path d="M14.6 19.4c0-2.4 1.6-4.2 3.6-4.2 1.5 0 2.8 1 3.3 2.6"/>''',
    # 지역경제활력도 — 성장 막대와 추세선
    'S3': '''
      <path d="M3.2 20.6H20.8"/>
      <path d="M6.2 20.6v-4.4M11 20.6v-7.2M15.8 20.6v-10"/>
      <path d="M5 11.4 10 7.6l3.4 2.6 5.6-5.4"/>
      <path d="M15.2 4.2h4v4"/>''',
    # 지역산업성장성 — 공장
    'S4': '''
      <path d="M3.4 20.6v-8.2l5 3.2v-3.2l5 3.2v-3.2l5 3.2V20.6Z"/>
      <path d="M18.4 15.8V5.6h2.4"/>
      <path d="M9.6 20.6v-3.4h3.2v3.4"/>''',
    # 교통인프라 접근성 — 도로
    'S5': '''
      <path d="M8.4 20.6 10.9 3.4M15.6 20.6 13.1 3.4"/>
      <path d="M12 6.2v2.6M12 11.1v2.6M12 16v2.6"/>''',
    # 생활인프라 편리성 — 생활상가
    'S6': '''
      <path d="M4.4 9.6v11h15.2v-11"/>
      <path d="M3 9.6 5.2 4.8h13.6L21 9.6Z"/>
      <path d="M9.8 20.6v-6.2h4.4v6.2"/>''',
    # 친환경성 — 잎
    'S7': '''
      <path d="M4.6 19.4C4.6 10.2 10.2 4.6 19.4 4.6c0 9.2-5.6 14.8-14.8 14.8Z"/>
      <path d="M4.6 19.4 17 7"/>''',
    # 지역사회건강도 — 맥박
    'S8': '''
      <path d="M2.6 12.4h4.2l2.2-6.2 3.6 12.4 2.4-6.2h6.4"/>''',
    # 지역사회안전 — 방패
    'S9': '''
      <path d="M12 3.2 20 6.1v6.2c0 4.6-3.3 7.3-8 8.5-4.7-1.2-8-3.9-8-8.5V6.1Z"/>
      <path d="m8.8 12.2 2.4 2.4 4.2-4.4"/>''',
    # 재정건전성 — 적립
    'S10': '''
      <path d="M19 6.6c0 1.7-3.1 3.1-7 3.1S5 8.3 5 6.6 8.1 3.5 12 3.5s7 1.4 7 3.1Z"/>
      <path d="M5 6.6v5.2c0 1.7 3.1 3.1 7 3.1s7-1.4 7-3.1V6.6"/>
      <path d="M5 11.8v5.2c0 1.7 3.1 3.1 7 3.1s7-1.4 7-3.1v-5.2"/>''',
    # 자료 준비중
    'lock': '''
      <rect x="4.4" y="10.4" width="15.2" height="10.2" rx="2.2"/>
      <path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/>''',
}

TPL = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{s}" height="{s}" '
       'fill="none" stroke="{c}" stroke-width="1.7" stroke-linecap="round" '
       'stroke-linejoin="round">{body}</svg>')


def render(key, color):
    body = SHAPES[key].replace('CUR', color)
    svg = TPL.format(s=SIZE, c=color, body=body)
    return cairosvg.svg2png(bytestring=svg.encode('utf-8'),
                            output_width=SIZE, output_height=SIZE)


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    table = {}
    for key in SHAPES:
        for suffix, color in (('', INK), ('-on', ON), ('-lock', LOCK)):
            if key == 'lock' and suffix:
                continue
            png = render(key, color)
            name = f'{key}{suffix}.png'
            with open(os.path.join(OUTDIR, name), 'wb') as fp:
                fp.write(png)
            table[f'{key}{suffix}'] = base64.b64encode(png).decode('ascii')

    lines = ['// 자동 생성 파일 — scripts/make_icons.py 로 다시 만든다. 직접 고치지 말 것.',
             '// 부문 아이콘(선화 PNG 96px)을 data URI로 담았다. 단일 파일 빌드라 외부 경로를 못 쓴다.',
             '',
             'const I = {']
    for k in sorted(table, key=lambda x: (len(x), x)):
        lines.append(f"  '{k}': 'data:image/png;base64,{table[k]}',")
    lines += [
        '}',
        '',
        '// 상태: 기본 / on(선택된 부문) / lock(자료 준비중)',
        "export const iconOf = (key, state = '') => I[state ? `${key}-${state}` : key] || I.lock",
        'export const LOCK_ICON = I.lock',
        'export default I',
        '',
    ]
    with open(JSOUT, 'w', encoding='utf-8') as fp:
        fp.write('\n'.join(lines))

    total = sum(len(v) for v in table.values())
    print(f'{len(table)}개 아이콘 · icons.js {total // 1024}KB')


if __name__ == '__main__':
    main()
