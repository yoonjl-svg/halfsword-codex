# Stillness 앱 아이콘 v3 (도트) — 먹빛 바탕에 아주 옅은 마름모 격자(카드 뒷면 결) · 둥근 금빛 문장 · 세운 장검(칼끝 아래 = 고요) · 반짝이
# 다시 뽑기: python3 -I tools/icon/gen_app_icon.py <출력 폴더>  → px32·px32_mask(원본 32×32) · icon-512 · icon-maskable-512 · icon-192 · apple-touch-icon(192 — 6배 정수 확대) · favicon-32·64 · preview.png(견본, public 에는 넣지 않는다)
#  본판 자리: public/icons/ (docs/pwa_2026-10-13.md). 도트가 뭉개지지 않게 정수 배 NEAREST 확대만 쓴다
import sys, math
from PIL import Image, ImageDraw
out = sys.argv[1]; N = 32
P = {'F0': (14, 14, 18), 'F1': (21, 21, 28), 'F2': (21, 21, 28),  # 먹빛 바탕 · 아주 옅은 마름모 격자 (사장님 10/14 '배경은 검은색이나 아주 짙은 먹빛으로 정돈')
     'G0': (150, 92, 18), 'G1': (232, 170, 44), 'G2': (255, 222, 110),
     'W0': (96, 16, 42), 'W1': (138, 28, 62),
     'S0': (120, 136, 190), 'S1': (214, 222, 240), 'S2': (255, 255, 255),
     'R0': (122, 14, 34), 'R1': (214, 40, 60), 'O': (4, 4, 6), 'Y': (255, 244, 176)}
def art(R, top, guard, tip, stars, gw=9):
    g = [['F0'] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            d1, d2 = (x + y) % 8, (x - y) % 8
            if d1 == 3 or d2 == 0: g[y][x] = 'F1'
            if d1 == 3 and d2 == 0: g[y][x] = 'F2'
    for y in range(N):
        for x in range(N):
            dx, dy = x - 15.5, y - 15.5; r = math.hypot(dx, dy)
            if r <= R - 2: g[y][x] = 'W1' if math.hypot(dx + 3, dy + 3) < R - 5 else 'W0'
            elif r <= R: g[y][x] = 'G2' if (dx + dy < -R * 0.8) else ('G0' if dx + dy > R * 0.8 else 'G1')
    s = {}
    L, Rr = 15, 16  # 가운데 두 칸
    # 칼자루 끝(보석)
    s[(L, top)] = 'G2'; s[(Rr, top)] = 'G2'
    s[(L - 1, top + 1)] = 'G1'; s[(L, top + 1)] = 'S2'; s[(Rr, top + 1)] = 'R1'; s[(Rr + 1, top + 1)] = 'G0'
    s[(L, top + 2)] = 'G0'; s[(Rr, top + 2)] = 'G0'
    # 손잡이 (붉은 끈 감음)
    for y in range(top + 3, guard):
        k = 'R1' if (y - top) % 2 else 'R0'
        s[(L, y)] = k; s[(Rr, y)] = 'R0' if k == 'R1' else (90, 10, 26) and 'R0'
    # 날밑: 가운데 붉은 보석 + 양 끝 둥근 마디
    for x in range(L - gw, Rr + gw + 1):
        s[(x, guard)] = 'G2'; s[(x, guard + 1)] = 'G0' if abs(x - 15.5) > 1 else 'G1'
    for ex in (L - gw - 1, Rr + gw + 1):
        s[(ex, guard)] = 'G1'; s[(ex, guard + 1)] = 'G0'
    s[(L, guard)] = 'S2'; s[(Rr, guard)] = 'R1'; s[(L, guard + 1)] = 'R1'; s[(Rr, guard + 1)] = 'R0'
    # 칼날 (넷 칸: 빛 · 쇠 · 쇠 · 그늘) → 칼끝 두 칸
    for y in range(guard + 2, tip - 1):
        s[(L - 1, y)] = 'S2'; s[(L, y)] = 'S1'; s[(Rr, y)] = 'S1'; s[(Rr + 1, y)] = 'S0'
    s[(L, tip - 1)] = 'S2'; s[(Rr, tip - 1)] = 'S0'; s[(L, tip)] = 'S1'; s[(Rr, tip)] = 'S0'
    for (x, y) in list(s):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < N and 0 <= q[1] < N and q not in s: g[q[1]][q[0]] = 'O'
    for (x, y), k in s.items(): g[y][x] = k
    def star(cx, cy, arm):
        g[cy][cx] = 'S2'
        for i in range(1, arm + 1):
            for dx, dy in ((i, 0), (-i, 0), (0, i), (0, -i)):
                X, Y = cx + dx, cy + dy
                if 0 <= X < N and 0 <= Y < N: g[Y][X] = 'Y' if i == arm else 'S2'
    for st in stars: star(*st)
    img = Image.new('RGB', (N, N))
    for y in range(N):
        for x in range(N): img.putpixel((x, y), P[g[y][x]])
    return img
full = art(R=11, top=2, guard=9, tip=29, stars=[(5, 6, 2), (27, 24, 1), (26, 6, 1)])
mask = art(R=8, top=5, guard=11, tip=26, stars=[(9, 9, 1), (23, 22, 1)], gw=7)
full.save(out + '/px32.png'); mask.save(out + '/px32_mask.png')
for img, name, k in ((full, 'icon-512.png', 16), (mask, 'icon-maskable-512.png', 16), (full, 'icon-192.png', 6), (full, 'apple-touch-icon.png', 6), (full, 'favicon-32.png', 1), (full, 'favicon-64.png', 2)):
    img.resize((N * k, N * k), Image.NEAREST).save(out + '/' + name)
pv = Image.new('RGB', (900, 300), (232, 228, 220))
def paste(img, size, xy, rf):
    im = img.resize((size, size), Image.NEAREST); m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * rf), fill=255); pv.paste(im, xy, m)
paste(full, 256, (20, 22), 0.22); paste(mask, 256, (300, 22), 0.5)
paste(full, 128, (580, 22), 0.22); paste(full, 64, (580, 170), 0.22); paste(full, 32, (660, 186), 0.22); paste(full, 96, (760, 100), 0.22)
pv.save(out + '/preview.png'); print('ok')
