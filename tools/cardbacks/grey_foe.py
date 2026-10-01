"""상대 무기 칸(회색 카드)용 뒷면 조각 만들기: px_<테마>_<조각>.png → px_<테마>_<조각>_foe.png

gen_pixel_cardbacks.py 가 쓴 PNG(8비트 RGBA, 줄 거르개 0)를 읽어 CSS 의 grayscale(1) brightness(.55) 와 같게 바꾼다.
카드에 filter 를 걸면 뒤집히는 카드의 뒷면 숨기기가 사파리에서 풀릴 수 있어서, 회색 그림을 따로 둔다.
실행: python3 tools/cardbacks/grey_foe.py  (뒷면 조각을 다시 뽑은 뒤에 다시 돌린다)
"""
import glob
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, '..', '..', 'public', 'ui', 'cardbacks')
BRIGHT = 0.55


def read_png(path):
    data = open(path, 'rb').read()
    pos, w, h, idat = 8, 0, 0, b''
    while pos < len(data):
        n = struct.unpack('>I', data[pos:pos + 4])[0]
        t = data[pos + 4:pos + 8]
        d = data[pos + 8:pos + 8 + n]
        if t == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', d[:10])
            assert depth == 8 and ctype == 6, f'{path}: 8비트 RGBA 가 아니다'
        elif t == b'IDAT':
            idat += d
        pos += 12 + n
    raw = zlib.decompress(idat)
    stride = w * 4 + 1
    rows = []
    for y in range(h):
        line = raw[y * stride:(y + 1) * stride]
        assert line[0] == 0, f'{path}: 줄 거르개가 0 이 아니다'
        rows.append(bytearray(line[1:]))
    return w, h, rows


def write_png(path, w, h, rows):
    raw = bytearray()
    for r in rows:
        raw.append(0)
        raw += r

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)
    return len(png)


for src in sorted(glob.glob(os.path.join(DIR, 'px_*.png'))):
    if src.endswith('_foe.png'):
        continue
    w, h, rows = read_png(src)
    for r in rows:
        for i in range(0, len(r), 4):
            # CSS grayscale(1) 의 밝기 식(0.2126·0.7152·0.0722) 뒤에 brightness(.55)
            y = 0.2126 * r[i] + 0.7152 * r[i + 1] + 0.0722 * r[i + 2]
            v = max(0, min(255, round(y * BRIGHT)))
            r[i] = r[i + 1] = r[i + 2] = v
    dst = src[:-4] + '_foe.png'
    print(os.path.basename(dst), write_png(dst, w, h, rows))
