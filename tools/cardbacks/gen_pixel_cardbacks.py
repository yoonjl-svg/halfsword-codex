# 무기 카드 뒷면 v3: 픽셀 아트 (게임 픽셀 결에 맞춘다)
#   python3 tools/cardbacks/gen_pixel_cardbacks.py  → public/ui/cardbacks/px_<id>_{tile,frame,center,plaque}.png
#   그다음 반드시 python3 tools/cardbacks/grey_foe.py 도 돌린다 (상대 칸용 회색 조각 px_<id>_<조각>_foe.png)
#
# 카드 크기(비율)는 화면마다 달라서(가로 폰 약 1:1.16, PC 1:1.5, 세로 폰 1:2.1) 한 장짜리 그림은 칸이 찌그러진다.
# 그래서 조각으로 나눠 CSS 가 정수 배로 키워 붙이게 한다 (image-rendering: pixelated, 한 칸 = --px CSS px):
#   tile   16×32 칸, 이음새 없이 반복되는 바탕 문양 (가운데 기준으로 깔면 카드 전체가 180° 대칭)
#   frame  20×20 칸, 9조각 테두리 (border-image, 테두리 폭 7칸, 가운데 6칸이 띠 한 마디로 반복)
#   center 14×14 칸, 가운데 작은 장식 (스스로 180° 대칭)
#   plaque 10×10 칸, 번호 배지 자리(아래 가운데)와 그 대칭(위 가운데)에 까는 원판
# 규칙: 색 수 제한(테마마다 바탕 + 3~4색 + 공용 금·외곽), 가는 선은 최소 1칸, 계단 모서리 그대로.
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'ui', 'cardbacks')
TW, TH = 16, 32  # 바탕 조각 크기 (위 절반의 문양을 180° 돌려 아래 절반에 놓는다)
B = 7  # 테두리 폭
M = 6  # 띠 한 마디


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def write_png(path, pix, pal):
    """pix: 2차원 목록 (글자 = 팔레트 열쇠, '.' = 투명)"""
    h = len(pix)
    w = len(pix[0])
    raw = bytearray()
    for row in pix:
        raw.append(0)
        for ch in row:
            if ch == '.':
                raw += bytes((0, 0, 0, 0))
            else:
                raw += bytes(hexrgb(pal[ch]) + (255,))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


def canvas(w, h, fill):
    return [[fill] * w for _ in range(h)]


def stamp(c, art, cx, cy, wrap=True):
    """art(문자열 목록)의 가운데를 (cx, cy)(칸 가장자리 기준, 반 칸 가능)에 놓는다. '.' 은 건너뛴다"""
    ah = len(art)
    aw = len(art[0])
    x0 = int(round(cx - aw / 2))
    y0 = int(round(cy - ah / 2))
    H = len(c)
    W = len(c[0])
    for j, row in enumerate(art):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = x0 + i, y0 + j
            if wrap:
                x %= W
                y %= H
            elif not (0 <= x < W and 0 <= y < H):
                continue
            c[y][x] = ch


def rot180(art):
    return [row[::-1] for row in art[::-1]]


def sym_tile(c):
    """위 절반을 180° 돌려 아래 절반에 복사 (조각이 스스로 180° 대칭이 되게)"""
    for y in range(TH // 2, TH):
        for x in range(TW):
            c[y][x] = c[TH - 1 - y][TW - 1 - x]
    return c


def check_sym(c):
    H = len(c)
    W = len(c[0])
    return all(c[y][x] == c[H - 1 - y][W - 1 - x] for y in range(H) for x in range(W))


def disc(n, r, fill, ring=None, ring_out=None):
    """n×n 원판 (가운데 기준). ring: 가장자리 한 칸 색, ring_out: 그 바깥 한 칸 색"""
    c = canvas(n, n, '.')
    for y in range(n):
        for x in range(n):
            d = math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2)
            if d <= r - 1:
                c[y][x] = fill
            elif d <= r and ring:
                c[y][x] = ring
            elif d <= r + 1 and ring_out:
                c[y][x] = ring_out
    return c


def frame(band, bg, corner_accent):
    """9조각 테두리 20×20. band: 띠 한 마디(B줄 × M칸, 0줄 = 바깥)"""
    n = 2 * B + M
    c = canvas(n, n, '.')
    # 위 띠 / 아래 띠(180°) / 왼 띠(띠를 왼쪽으로 눕힘) / 오른 띠(180°)
    for r in range(B):
        for k in range(M):
            c[r][B + k] = band[r][k]
            c[n - 1 - r][n - 1 - (B + k)] = band[r][k]
            c[B + (M - 1 - k)][r] = band[r][k]
            c[B + k][n - 1 - r] = band[r][k]
    # 귀퉁이: 바깥 외곽선·금선, 안쪽 금선, 가운데 작은 네모 장식 (대각선 대칭이라 네 귀퉁이에 같은 그림)
    corner = canvas(B, B, bg)
    for r in range(B):
        for q in range(B):
            if r == 0 or q == 0:
                corner[r][q] = 'O'
            elif r == 1 or q == 1 or r == B - 1 or q == B - 1:
                corner[r][q] = 'G'
            elif r in (2, B - 2) or q in (2, B - 2):
                corner[r][q] = bg
            else:
                corner[r][q] = corner_accent
    for r in range(B):
        for q in range(B):
            v = corner[r][q]
            c[r][q] = v
            c[r][n - 1 - q] = v
            c[n - 1 - r][q] = v
            c[n - 1 - r][n - 1 - q] = v
    return c


def band_rows(motif, bg):
    """띠 한 마디: 0줄 외곽선, 1줄 금선, 가운데 무늬(4줄), 마지막 줄 금선"""
    rows = [['O'] * M, ['G'] * M]
    for line in motif:
        rows.append([bg if ch == '.' else ch for ch in line])
    rows.append(['G'] * M)
    assert len(rows) == B, len(rows)
    return rows


SHARED = {'O': '#140d09', 'G': '#d9a441', 'g': '#8a6424'}


# ─────────────────────────────── 테마 ───────────────────────────────
def poseidon():
    pal = dict(SHARED, B='#1d3037', T='#3f7580', W='#c9d4ce')
    t = canvas(TW, TH, 'B')
    # 마름모 격자 (물빛, 한 칸 굵기)
    for y in range(TH // 2):
        for x in range(TW):
            if abs(x + 0.5 - 8) + abs(y + 0.5 - 8) == 8:
                t[y][x] = 'T'
    trident = ['G.GG.G', 'G.GG.G', 'G.GG.G', 'GGGGGG', '..GG..', '..gg..', '.GGGG.', '..gg..', '..gg..']
    foam = ['..TT..', '.TWWT.', 'TW..WT', 'TW..WT', '.TWWT.', '..TT..']
    stamp(t, trident, 8, 8)
    stamp(t, foam, 16, 16)
    stamp(t, foam, 16, 0)
    sym_tile(t)
    band = band_rows(['.GGGGG', '.G...G', '.G.G.G', 'GG.GGG'], 'B')  # 그리스 뇌문
    center = canvas(14, 14, '.')
    for y in range(14):
        for x in range(14):
            dx, dy = x + 0.5 - 7, y + 0.5 - 7
            d = math.hypot(dx, dy)
            if d <= 7:
                center[y][x] = 'B'
            if 6 < d <= 7:
                center[y][x] = 'G'
            elif 4 < d <= 5:
                center[y][x] = 'T'
            elif d <= 1.5:
                center[y][x] = 'W'
            elif d <= 4 and (abs(dx) < 0.6 or abs(dy) < 0.6):
                center[y][x] = 'G'
    return pal, t, band, center, 'T'


def castle():
    pal = dict(SHARED, B='#1e2433', S='#394459', W='#e3e8ef')
    t = canvas(TW, TH, 'B')
    # 마름돌 줄눈: 가로 줄눈 두 줄, 세로 줄눈은 줄마다 엇갈림
    for y in range(TH // 2):
        for x in range(TW):
            if y in (3, 11):
                t[y][x] = 'S'
            elif (4 <= y <= 10 and x in (3,)) or ((y <= 2 or y >= 12) and x in (11,)):
                t[y][x] = 'S'
    bell = ['...GG...', '..GGGG..', '..GGgG..', '.GGGGgG.', '.GGGGgG.', '.GGGGgG.', 'GGGGGGGG', '...gg...']
    flake = ['...WW...', '.W.WW.W.', '..WWWW..', 'WWW..WWW', 'WWW..WWW', '..WWWW..', '.W.WW.W.', '...WW...']
    stamp(t, bell, 8, 8)
    stamp(t, flake, 16, 16)
    stamp(t, flake, 16, 0)
    sym_tile(t)
    band = band_rows(['WWW...', 'SSS...', 'SSSSSS', 'SSSSSS'], 'B')  # 흉벽 톱니 (돌 위에 눈이 얹혔다)
    center = canvas(14, 14, '.')
    big = ['......WW......', '..W...WW...W..', '...W..WW..W...', '....WWWWWW....', '....W.WW.W....', '..WWWW..WWWW..', 'WWWWW....WWWWW']
    big = big + rot180(big)
    for y in range(14):
        for x in range(14):
            d = abs(x + 0.5 - 7) + abs(y + 0.5 - 7)
            if d <= 7:
                center[y][x] = 'G' if d > 6 else 'B'
            if big[y][x] == 'W' and d <= 6:
                center[y][x] = 'W'
    return pal, t, band, center, 'W'


def temple():
    pal = dict(SHARED, B='#1a352b', N='#2f6a58', R='#b0402f', C='#e1c98e')
    t = canvas(TW, TH, 'B')
    # 단청 금문 격자 (녹청, 한 칸 굵기)
    for y in range(TH // 2):
        for x in range(TW):
            if (x + y) % 8 == 7 or (x - y) % 8 == 0:
                t[y][x] = 'N'
    lotus = ['.RR..RR.', 'RRRRRRRR', 'RRCRRCRR', '.RRCCRR.', '.RRCCRR.', 'RRCRRCRR', 'RRRRRRRR', '.RR..RR.']
    cloud = ['.CCC....', 'C...C...', 'C.CC.C..', '..C.CC.C', '...C...C', '....CCC.']
    stamp(t, lotus, 8, 8)
    stamp(t, cloud, 16, 16)
    stamp(t, cloud, 16, 0)
    sym_tile(t)
    band = band_rows(['.CC...', 'CCCC.R', 'CCCC.R', '.CC...'], 'B')  # 연주문
    pal['G'] = pal['C']  # 이 테마의 금빛은 단청의 연한 금색
    center = canvas(14, 14, '.')
    for y in range(14):
        for x in range(14):
            dx, dy = x + 0.5 - 7, y + 0.5 - 7
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            if d <= 7:
                center[y][x] = 'B'
            if 6 < d <= 7:
                center[y][x] = 'R'
            elif 2.2 < d <= 5.6 and math.cos(8 * a) > -0.2:
                center[y][x] = 'R'
            elif d <= 2.2:
                center[y][x] = 'C'
    return pal, t, band, center, 'R'


def cathedral():
    pal = dict(SHARED, B='#2b171a', R='#a3202f', V='#4d6a3a')
    t = canvas(TW, TH, 'B')
    # 담쟁이 줄기: 사선 한 칸 굵기
    for y in range(TH // 2):
        for x in range(TW):
            if (x - y) % 16 == 8:
                t[y][x] = 'V'
    rose = ['..RRRR..', '.RRRRRR.', 'RRRRRRRR', 'RRRGGRRR', 'RRRGGRRR', '.RRRRRR.', 'V.RRRR.V', 'VV....VV']
    # 사엽 장식(쿼트리포일): 네 원의 합집합 테두리 (스스로 대칭)
    q = [['.'] * 10 for _ in range(10)]
    def inside(px, py):
        return any(math.hypot(px - cx, py - cy) <= 2.6 for cx, cy in [(-2.3, 0), (2.3, 0), (0, -2.3), (0, 2.3)])
    for y in range(10):
        for x in range(10):
            px, py = x + 0.5 - 5, y + 0.5 - 5
            if inside(px, py) and not all(inside(px + ax, py + ay) for ax, ay in [(1, 0), (-1, 0), (0, 1), (0, -1)]):
                q[y][x] = 'G'
    quatre = [''.join(r) for r in q]
    stamp(t, rose, 8, 8)
    stamp(t, quatre, 16, 16)
    stamp(t, quatre, 16, 0)
    sym_tile(t)
    band = band_rows(['..GG..', '.G..G.', 'G....G', 'G....G'], 'B')  # 뾰족 아치 아케이드
    center = canvas(14, 14, '.')
    for y in range(14):
        for x in range(14):
            dx, dy = x + 0.5 - 7, y + 0.5 - 7
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            if d <= 7:
                center[y][x] = 'R'
            if 6 < d <= 7:
                center[y][x] = 'G'
            elif d > 1.8 and abs(math.sin(4 * a)) < 0.28 * 7 / max(d, 1):
                center[y][x] = 'G'
            elif d <= 1.8:
                center[y][x] = 'G'
    return pal, t, band, center, 'R'


def clearing_a():
    # 화전 터 1안(보관): 탄 땅 검정 바탕, 재 잿빛, 새싹 연두, 양골담초 노랑. 문양은 새싹과 밭돌, 가운데는 브란의 회초리(참나무 가지)
    pal = dict(SHARED, B='#1a1816', A='#5e5c55', L='#8fae3e', Y='#c9a83a', W='#6e665a')
    t = canvas(TW, TH, 'B')
    # 흩어진 재 알갱이 (드문 잿빛 점)
    for y in range(TH // 2):
        for x in range(TW):
            if (x * 7 + y * 3) % 13 == 0 and (x + y) % 2 == 0:
                t[y][x] = 'A'
    sprout = ['..L..L..', '.LL..LL.', '..L..L..', '...LL...', '...LL...', '....L...', '....L...', '...AAA..']
    stones = ['........', '..AA.AA.', '.AAAAAAA', 'AAAA.AAA', '.AA..AA.', '........']
    stamp(t, sprout, 8, 8)
    stamp(t, stones, 16, 16)
    stamp(t, stones, 16, 0)
    sym_tile(t)
    band = band_rows(['W.W.W.', 'WWWWWW', 'W.W.W.', 'WWWWWW'], 'B')  # 판자 빠진 울타리
    center = canvas(14, 14, '.')
    for y in range(14):
        for x in range(14):
            dx, dy = x + 0.5 - 7, y + 0.5 - 7
            d = math.hypot(dx, dy)
            if d <= 7:
                center[y][x] = 'B'
            if 6 < d <= 7:
                center[y][x] = 'Y'
    # 회초리: 왼쪽 아래에서 오른쪽 위로 뻗은 가지 (두 칸 굵기), 끝에 잎눈 둘
    for k in range(9):
        x, y = 3 + k, 10 - k
        center[y][x] = 'g'
        if 0 <= y - 1:
            center[y - 1][x] = 'G'
    center[3][10] = 'L'
    center[2][10] = 'L'
    center[4][8] = 'L'
    center[4][9] = 'L'
    return pal, t, band, center, 'L'


def clearing():
    # 화전 터 2안(오너 채택, 브란): 탄 땅 검정 바탕, 재 잿빛, 새싹 연두, 양골담초 노랑, 바랜 나무.
    # 문양은 빗줄기와 새싹, 띠는 둥글게 이어 놓은 탄 통나무의 마구리, 가운데는 죽은 가지에 앉은 까마귀와 그 끝의 새잎
    pal = dict(SHARED, B='#1a1816', A='#5e5c55', L='#8fae3e', Y='#c9a83a', W='#6e665a')
    t = canvas(TW, TH, 'B')
    # 비스듬한 빗줄기 (잿빛 두 칸 짧은 선, 드문드문)
    for y in range(TH // 2):
        for x in range(TW):
            if (x * 5 + y * 3) % 11 == 0 and (x - y) % 4 == 0:
                t[y][x] = 'A'
                if y + 1 < TH // 2 and x > 0:
                    t[y + 1][x - 1] = 'A'
    sprout = ['..L..L..', '.LL..LL.', '..L..L..', '...LL...', '....L...', '....L...', '...AAA..', '........']
    drop = ['...A....', '..A.....', '...A....', '..A.....', '........', '......A.', '.....A..', '......A.']
    stamp(t, sprout, 8, 8)
    stamp(t, drop, 16, 16)
    stamp(t, drop, 16, 0)
    sym_tile(t)
    band = band_rows(['.WWWW.', 'WW..WW', 'WW..WW', '.WWWW.'], 'B')  # 통나무 마구리 (나이테)
    center = canvas(14, 14, '.')
    for y in range(14):
        for x in range(14):
            dx, dy = x + 0.5 - 7, y + 0.5 - 7
            d = math.hypot(dx, dy)
            if d <= 7:
                center[y][x] = 'B'
            if 6 < d <= 7:
                center[y][x] = 'Y'
    # 가운데 장식은 위 절반만 그리고 아래 절반은 180° 돌려 붙는다(아래 main). 옆모습 까마귀는 돌리면 둘이 겹쳐 덩어리로 보여서,
    # 위에서 본 날개 편 까마귀(머리·꼬리가 대칭이라 돌려 붙여도 한 마리로 읽힌다)를 잿빛으로 넣는다
    for y, (x0, x1) in {1: (6, 8), 2: (5, 9), 3: (2, 12), 4: (2, 12), 5: (3, 11), 6: (5, 9)}.items():
        for x in range(x0, x1):
            center[y][x] = 'A'
    return pal, t, band, center, 'L'


def poseidon_night():
    # 밤의 포세이돈(하인리히 흑화): 포세이돈 안의 밤 변주 — 짙푸른 바탕에 어두운 물빛 마름모, 삼지창은 그대로, 물거품 자리에 달과 별, 가운데는 초승달과 불꽃
    pal = dict(SHARED, B='#0c1220', T='#2a4d58', W='#dfe3d8', F='#e0782a')
    t = canvas(TW, TH, 'B')
    for y in range(TH // 2):
        for x in range(TW):
            if abs(x + 0.5 - 8) + abs(y + 0.5 - 8) == 8:
                t[y][x] = 'T'
    trident = ['G.GG.G', 'G.GG.G', 'G.GG.G', 'GGGGGG', '..GG..', '..gg..', '.GGGG.', '..gg..', '..gg..']
    moon = ['..WW..', '.W..W.', 'W....W', 'W.....', '.W..W.', '..WW..']  # 이지러진 달과 별 하나
    stamp(t, trident, 8, 8)
    stamp(t, moon, 16, 16)
    stamp(t, moon, 16, 0)
    t[2][14] = 'W'
    t[13][2] = 'W'
    sym_tile(t)
    band = band_rows(['.GGGGG', '.G...G', '.G.G.G', 'GG.GGG'], 'B')  # 그리스 뇌문 (포세이돈과 같다)
    center = canvas(14, 14, '.')
    for y in range(14):
        for x in range(14):
            dx, dy = x + 0.5 - 7, y + 0.5 - 7
            d = math.hypot(dx, dy)
            if d <= 7:
                center[y][x] = 'B'
            if 6 < d <= 7:
                center[y][x] = 'G'
            elif 3.2 < d <= 4.6 and dx < 0.8:  # 초승달 (왼쪽으로 열린 고리)
                center[y][x] = 'W'
    flame = ['..F.', '.FF.', 'FFFF', '.FF.']
    stamp(center, flame, 8.5, 7, wrap=False)
    return pal, t, band, center, 'T'


def loggia():
    # 석재 상감: 녹색 대리석·상아색 돌의 팔엽 로제트와 기하 테두리.
    pal = dict(SHARED, B='#302326', I='#ddd0ae', V='#53746a', R='#96504c')
    t = canvas(TW, TH, 'B')
    flower = ['...II...', '..IVVI..', '.IVIIVI.', 'IVIBBIVI', 'IVIBBIVI', '.IVIIVI.', '..IVVI..', '...II...']
    stamp(t, flower, 8, 8)
    stamp(t, ['.R.', 'RIR', '.R.'], 16, 0)
    stamp(t, ['.R.', 'RIR', '.R.'], 16, 16)
    sym_tile(t)
    band = band_rows(['IVVVVI', 'VI..IV', 'VI..IV', 'IVVVVI'], 'B')
    center = disc(14, 6, 'B', 'I', 'O')
    for y in range(14):
        for x in range(14):
            dx, dy = x + .5 - 7, y + .5 - 7
            d = math.hypot(dx, dy)
            if 1 < d < 5.3:
                center[y][x] = 'I' if abs(math.cos(4 * math.atan2(dy, dx))) > .55 else 'V'
            elif d <= 1:
                center[y][x] = 'R'
    return pal, t, band, center, 'I'


def corsair():
    # 맞바람을 받는 삼각 돛, 바닷물과 굵은 꼬임 로프.
    pal = dict(SHARED, B='#19383e', S='#c68e62', W='#76aaa7', H='#6e4931')
    t = canvas(TW, TH, 'B')
    sail = ['...G....', '..SG....', '.SSG....', 'SSSGS...', 'SSSGSS..', 'HHHHHHHH', '.HHHHHH.', '..WWWW..']
    stamp(t, sail, 8, 8)
    stamp(t, ['W...W.', '.WWW.W'], 16, 0)
    stamp(t, ['W...W.', '.WWW.W'], 16, 16)
    sym_tile(t)
    band = band_rows(['gGGggG', 'GggGGg', 'GggGGg', 'gGGggG'], 'B')
    center = disc(14, 6, 'B', 'W', 'O')
    stamp(center, ['....G.....', '...SG.....', '..SSG.....', '.SSSG.....', 'SSSSGSS...', 'HHHHHHHHHH'], 7, 4, False)
    return pal, t, band, center, 'S'


def sacred_grove():
    # 신목의 갈라진 수피, 금줄과 흰 시데. 작은 화면에서도 큰 형태를 유지.
    pal = dict(SHARED, B='#1c3025', L='#72936a', W='#dddccb', T='#886d49')
    t = canvas(TW, TH, 'B')
    tree = ['...LL...', '..LLLL..', '.LLLLLL.', 'LLLLLLLL', '..TTTT..', '..TgTT..', '.TT..TT.', 'TT....TT']
    stamp(t, tree, 8, 8)
    stamp(t, ['.W..', 'WWW.', '..WW', '..W.'], 16, 0)
    stamp(t, ['.W..', 'WWW.', '..WW', '..W.'], 16, 16)
    sym_tile(t)
    band = band_rows(['TTggTT', 'gTTTTg', 'gW..Wg', 'WW..WW'], 'B')
    center = disc(14, 6, 'B', 'L', 'O')
    stamp(center, ['....TT....', '...TTTT...', '..TTgTTT..', 'TTTTTTTTTT', 'gGgGgGgGgG', '..W....W..', '.WWW..WWW.'], 7, 3.5, False)
    return pal, t, band, center, 'L'


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('poseidon', poseidon), ('poseidon_night', poseidon_night), ('clearing', clearing), ('clearing_a', clearing_a), ('castle', castle), ('temple', temple), ('cathedral', cathedral), ('loggia', loggia), ('corsair', corsair), ('sacred_grove', sacred_grove)]:
        pal, tile, band, center, accent = fn()
        assert check_sym(tile), name + ' tile not symmetric'
        fr = frame(band, 'B', accent)
        assert check_sym(fr), name + ' frame not symmetric'
        # 가운데 장식은 스스로 180° 대칭이 되게 위 절반을 돌려 붙인다
        for y in range(7, 14):
            for x in range(14):
                center[y][x] = center[13 - y][13 - x]
        plaque = disc(10, 4, 'B', 'G', 'O')
        sizes = [write_png(os.path.join(OUT, f'px_{name}_{part}.png'), img, pal) for part, img in [('tile', tile), ('frame', fr), ('center', center), ('plaque', plaque)]]
        print(name, 'bytes', sizes, 'bg', pal['B'])
