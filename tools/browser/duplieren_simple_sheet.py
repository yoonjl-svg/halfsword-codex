# 겹치기 단순 길 · 앞 박차기 옆 모습 장면 묶음 (tools/browser/duplieren_simple_shots.mjs 결과 폴더 → 판마다 한 줄 · 칸마다 게임 시간 · 앞발 딛음 · 골반 앞 옮김)
#  python3.12 tools/browser/duplieren_simple_sheet.py <폴더> <out.webp> [판,판…] [칸 너비 px (기본 260)]
import json, sys
from PIL import Image, ImageDraw

D = sys.argv[1]
OUT = sys.argv[2]
R = json.load(open(f'{D}/result.json'))
tags = sys.argv[3].split(',') if len(sys.argv) > 3 else list(R.keys())
CW = int(sys.argv[4]) if len(sys.argv) > 4 else 260
rows = [(t, R[t]) for t in tags if t in R]
ncol = max(len(r['shots']) for _, r in rows)
im0 = Image.open(rows[0][1]['shots'][0]['path'])
W0, H0 = im0.size
CH = int(H0 * CW / W0)
# 가운데를 잘라 사람 둘만 (화면 위 · 아래 단추 칸 빼고)
crop = (int(W0 * 0.18), int(H0 * 0.12), int(W0 * 0.86), int(H0 * 0.86))
cw = crop[2] - crop[0]
ch = crop[3] - crop[1]
CH = int(ch * CW / cw)
LAB = 30
sheet = Image.new('RGB', (CW * ncol, (CH + LAB) * len(rows) + 4), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for r, (tag, res) in enumerate(rows):
    y0 = r * (CH + LAB)
    t0 = res['shots'][0]['sim']
    p0 = res['shots'][0]['pel']
    for c, s in enumerate(res['shots']):
        im = Image.open(s['path']).crop(crop).resize((CW, CH))
        sheet.paste(im, (c * CW, y0 + LAB))
        F = s.get('F') or {}
        B = s.get('B') or {}
        air = ('F' if not F.get('st') else '') + ('B' if not B.get('st') else '')
        txt = f"{tag} t={s['sim'] - t0:+.3f}s"
        d.text((c * CW + 4, y0 + 2), txt, fill=(240, 220, 160))
        d.text((c * CW + 4, y0 + 15), f"{'cut' if s.get('iai') else '---'} foot-air:{air or '-'} pel+{(s['pel'] - p0):.2f}m d {s['d']}", fill=(170, 210, 170) if air else (170, 170, 170))
sheet.save(OUT, quality=72) if OUT.endswith('.webp') else sheet.save(OUT)
print('saved', OUT, sheet.size)
