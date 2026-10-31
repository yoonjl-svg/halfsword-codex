# 겹치기 단순 길 · 앞 박차기 그림 (tools/sim/duplieren_simple.mjs --json 결과) — 판마다 한 줄: 옆(상대 쪽 x · 높이 y) · 위(상대 쪽 x · 칼 든 쪽 z) · 때 맞춤 띠
#  옆 · 위 칸: 굵은 파란 = 운동학 칼이 끄는 동안 칼끝(세계 — 낸 때 몸 틀) · 회색 = 칼자루(손) · 주황 = 골반 · 초록 네모 = 앞발 뗀 자리 → 디딘 자리 · 빨간 점 = 첫 닿음
#  때 맞춤 띠 (0 ~ 0.4 게임 초): 파란 = 칼이 끄는 동안 · 초록 = 앞발 뜬 동안 · 빨간 줄 = 첫 닿음 · 주황 꺾은선 = 골반 앞 빠르기 · 회색 꺾은선 = 손 앞 빠르기
#  python3 tools/sim/duplieren_simple_plot.py <json> <out.webp|png> <갈래[,갈래…]> [판 번호 (갈래마다 n 번째 낸 것 — 기본 0)]   (PIL)
import json, sys
from PIL import Image, ImageDraw

J = json.load(open(sys.argv[1])) if not sys.argv[1].count(',') else None
files = sys.argv[1].split(',')
OUT = sys.argv[2]
names = sys.argv[3].split(',')
IDX = [int(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else [0] * len(names)
rows = []
for k, name in enumerate(names):
    for fpath in files:
        D = json.load(open(fpath))
        T = D.get('traces', {}).get(name)
        if T:
            i = IDX[k] if k < len(IDX) else 0
            rows.append((name, T[min(i, len(T) - 1)]))
            break
W, H = 300, 230
BW = 300
img = Image.new('RGB', (W * 2 + BW + 40, (H + 46) * len(rows) + 10), (24, 22, 20))
d = ImageDraw.Draw(img)


def frame(ox, oy, title, w=W, h=H):
    d.rectangle([ox, oy, ox + w, oy + h], outline=(90, 90, 90))
    d.text((ox + 6, oy + 4), title, fill=(230, 220, 200))


def mapper(ox, oy, xs, ys, w=W, h=H, pad=18):
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    s = min((w - 2 * pad) / max(1e-6, x1 - x0), (h - 2 * pad) / max(1e-6, y1 - y0))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return lambda x, y: (ox + w / 2 + (x - cx) * s, oy + h / 2 - (y - cy) * s)


for r, (name, tr) in enumerate(rows):
    oy = r * (H + 46) + 28
    S = tr['steps']
    K = [s for s in S if s['kin']]
    m = tr.get('m', {})
    hit = m.get('hitT') if m.get('hit') else None
    d.text((10, oy - 22), f"{name}  {tr.get('weapon','')} vs {tr.get('opp','')}  d0 {tr.get('d0')} -> {m.get('dEnd')}  sweep {m.get('sweep')}  hit {m.get('resZone') or '-'} {m.get('resE') or ''} J", fill=(240, 200, 120))
    W1 = [s for s in S if s['t'] <= (K[-1]['t'] if K else 0) + 0.15]
    for col, (ix, iy, title) in enumerate([(0, 1, 'side: x toward foe, y up'), (0, 2, 'top: x toward foe, z sword side')]):
        ox = 10 + col * (W + 10)
        frame(ox, oy, title)
        pts = [p for s in W1 for p in (s['tip'], s['hand'], s['pel'])]
        xs = [p[ix] for p in pts]
        ys = [p[iy] for p in pts]
        mp = mapper(ox, oy, xs, ys)
        for key, color, wdt in (('hand', (150, 150, 150), 2), ('pel', (230, 150, 60), 2)):
            line = [mp(s[key][ix], s[key][iy]) for s in W1]
            if len(line) > 1:
                d.line(line, fill=color, width=wdt)
        line = [mp(s['tip'][ix], s['tip'][iy]) for s in K]
        if len(line) > 1:
            d.line(line, fill=(80, 150, 255), width=3)
        for s in K[:: max(1, len(K) // 6)]:
            p = mp(s['tip'][ix], s['tip'][iy])
            h = mp(s['hand'][ix], s['hand'][iy])
            d.line([h, p], fill=(70, 110, 190), width=1)
        f = m.get('foot')
        if f and f.get('leg') and S:
            leg = f['leg']
            p0 = S[0][leg]['p'] if S[0].get(leg) else None
            p1 = next((s[leg]['p'] for s in S if s.get(leg) and s['t'] >= (f.get('plant') or 9)), None)
            for p, c in ((p0, (60, 160, 60)), (p1, (120, 230, 120))):
                if p:
                    q = mp(p[ix], p[iy] if iy != 1 else 0.06)
                    q = (min(max(q[0], ox + 5), ox + W - 5), min(max(q[1], oy + 5), oy + H - 5))  # 칸 밖이면 테두리에 (옆 칸은 발이 땅 높이라 아래 테두리)
                    d.rectangle([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], outline=c, width=2)
        if hit is not None:
            s = min(K or S, key=lambda s: abs(s['t'] - hit))
            q = mp(s['tip'][ix], s['tip'][iy])
            d.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], outline=(255, 80, 80), width=2)
    # 때 맞춤 띠
    ox = 10 + 2 * (W + 10)
    frame(ox, oy, 'timing 0-0.4 s (game)', BW, H)
    tx = lambda t: ox + 10 + (BW - 20) * min(1, max(0, t / 0.4))
    if K:
        d.rectangle([tx(K[0]['t'] - 0.008), oy + 30, tx(K[-1]['t']), oy + 44], fill=(70, 120, 230))
        d.text((ox + 10, oy + 46), f"cut {K[0]['t'] - 0.008:.3f}-{K[-1]['t']:.3f}", fill=(140, 170, 240))
    f = m.get('foot')
    if f and f.get('lift') is not None:
        d.rectangle([tx(f['lift'] - 0.008), oy + 62, tx(f.get('plant') or 0.4), oy + 76], fill=(60, 170, 70))
        d.text((ox + 10, oy + 78), f"front foot air {f['lift'] - 0.008:.3f}-{f.get('plant')}  ({f.get('kind')} {f.get('len')} m)", fill=(140, 220, 140))
    if hit is not None:
        d.line([tx(hit), oy + 26, tx(hit), oy + 96], fill=(255, 80, 80), width=2)
        d.text((tx(hit) + 3, oy + 92), f'contact {hit}', fill=(255, 120, 120))
    # 빠르기 (앞 몫) — 골반 · 손
    vy0 = oy + H - 12
    sc = 22  # px per m/s
    for key, color in (('pel', (230, 150, 60)), ('hand', (170, 170, 170))):
        line = []
        for a, b in zip(S, S[1:]):
            if b['t'] > 0.4:
                break
            v = (b[key][0] - a[key][0]) / max(1e-6, b['t'] - a['t'])
            line.append((tx(b['t']), vy0 - v * sc))
        if len(line) > 1:
            d.line(line, fill=color, width=2)
    d.line([ox + 10, vy0, ox + BW - 10, vy0], fill=(80, 80, 80))
    d.text((ox + 10, oy + H - 26), 'fwd speed: pelvis orange / hand grey (1 m/s = 22 px)', fill=(160, 160, 160))
img.save(OUT, quality=80) if OUT.endswith('.webp') else img.save(OUT)
print('saved', OUT, img.size)
