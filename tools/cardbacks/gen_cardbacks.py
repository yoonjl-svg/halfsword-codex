# 무기 카드 뒷면 네 가지(스테이지마다 하나)를 SVG 로 만든다.
#   python3 tools/cardbacks/gen_cardbacks.py  → public/ui/cardbacks/p_*.svg
# 규칙: viewBox 0 0 200 290 · 180° 회전 대칭(뒤집어 놓아도 같다) · 테두리 틀 + 안쪽 촘촘한 반복 문양 ·
#       가운데 큰 그림 없음(작은 장식만) · 아래 가운데 (100, 268) 번호 배지 자리와 그 맞은편 (100, 22)는 비운다 ·
#       순수 벡터(path·gradient)만, 글꼴·래스터·필터 없음 · 파일 하나 30KB 이하.
# 대칭 만들기: 격자 점 p 에 문양을 놓으면 (200−x, 290−y) 에는 180° 돌린 같은 문양을 놓는다.
import math
import os

W, H = 200, 290
CX, CY = W / 2, H / 2
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'ui', 'cardbacks')
BADGE = [(100, 268), (100, 22)]


def f(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def grid(dx, dy, half=False, skip_r=17, skip_center=0):
    """가운데를 중심으로 대칭인 격자 점. half=True 면 반 칸 어긋난 격자. 반환: [(x, y, rot)]"""
    pts = []
    ox = dx / 2 if half else 0
    oy = dy / 2 if half else 0
    nx = int(W / dx) + 2
    ny = int(H / dy) + 2
    for j in range(-ny, ny + 1):
        for i in range(-nx, nx + 1):
            x = CX + ox + i * dx
            y = CY + oy + j * dy
            if not (8 <= x <= W - 8 and 8 <= y <= H - 8):
                continue
            if any(math.hypot(x - bx, y - by) < skip_r for bx, by in BADGE):
                continue
            if skip_center and math.hypot(x - CX, y - CY) < skip_center:
                continue
            top = y < CY - 1e-6 or (abs(y - CY) < 1e-6 and x < CX)
            pts.append((x, y, 0 if top else 180))
    return pts


def uses(ref, pts, extra=''):
    return ''.join(f'<use href="#{ref}" transform="translate({f(x)} {f(y)}){" rotate(180)" if r else ""}{extra}"/>' for x, y, r in pts)


def svg(defs, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
            f'<defs><clipPath id="fc"><rect x="17" y="17" width="166" height="256"/></clipPath>{defs}</defs>{body}</svg>')


def centered_run(total, step):
    """길이 total 안에 step 단위를 가운데 정렬해 몇 개 놓을지와 시작 여백"""
    n = int(total // step)
    return n, (total - n * step) / 2


def border(gold, bg, unit_h, unit_v, uw, uh_v):
    """바깥 금테·안쪽 금테·네 귀퉁이 네모 + 띠. unit_h: 폭 uw 짜리 가로 띠 단위, unit_v: 높이 uh_v 짜리 세로 띠 단위"""
    n, pad = centered_run(166, uw)
    top = ''.join(f'<use href="#{unit_h}" transform="translate({f(17 + pad + k * uw)} 7)"/>' for k in range(n))
    m, padv = centered_run(256, uh_v)
    left = ''.join(f'<use href="#{unit_v}" transform="translate(7 {f(17 + padv + k * uh_v)})"/>' for k in range(m))
    corners = ''.join(f'<rect x="{x}" y="{y}" width="9" height="9" fill="none" stroke="{gold}" stroke-width=".9"/><rect x="{x + 3}" y="{y + 3}" width="3" height="3" fill="{gold}"/>'
                      for x, y in [(7, 7), (184, 7), (7, 274), (184, 274)])
    return (f'<g>{top}{left}</g><g transform="rotate(180 {CX} {CY})">{top}{left}</g>{corners}'
            f'<rect x="3.5" y="3.5" width="193" height="283" rx="8" fill="none" stroke="{gold}" stroke-width="1.4"/>'
            f'<rect x="16.5" y="16.5" width="167" height="257" fill="none" stroke="{gold}" stroke-width="1"/>')


def badges(bg, gold):
    """번호 배지 자리(아래)와 그 대칭(위): 차분한 원판"""
    return ''.join(f'<circle cx="{x}" cy="{y}" r="15" fill="{bg}"/><circle cx="{x}" cy="{y}" r="15" fill="none" stroke="{gold}" stroke-width="1"/>'
                   f'<circle cx="{x}" cy="{y}" r="12.4" fill="none" stroke="{gold}" stroke-width=".5" opacity=".6"/>' for x, y in BADGE)


# ─────────────────────────────── 1. 포세이돈 신전 ───────────────────────────────
def poseidon():
    bg, gold, teal = '#1b2a31', '#d2a652', '#3f7580'
    # 띠: 그리스 뇌문(메안더) — 바닥선 위로 안으로 말려 드는 네모 갈고리
    key_h = f'<path id="kh" d="M0 8.5H8M0.5 8.5V0.5H7V6H3V3H5" fill="none" stroke="{gold}" stroke-width="1" stroke-linecap="square"/>'
    key_v = f'<path id="kv" d="M8.5 8V0M8.5 7.5H0.5V1H6V5H3V3" fill="none" stroke="{gold}" stroke-width="1" stroke-linecap="square"/>'
    # 안쪽 바탕: 마름모 격자 (물빛)
    lattice = []
    for k in range(-20, 21):
        c = CX + k * 24
        lattice.append(f'M{f(c - 150)} {f(CY - 150 * 1.0)}L{f(c + 150)} {f(CY + 150)}')
        lattice.append(f'M{f(c + 150)} {f(CY - 150)}L{f(c - 150)} {f(CY + 150)}')
    lat = f'<path d="{"".join(lattice)}" stroke="{teal}" stroke-width=".7" fill="none" opacity=".75"/>'
    # 문양 A: 삼지창 (격자 칸 가운데, 위쪽 절반은 위로, 아래쪽 절반은 아래로)
    trident = (f'<g id="tr" fill="none" stroke="{gold}" stroke-width="1.1" stroke-linecap="round">'
               f'<path d="M0 7V-6M-4 -3V-6.5M4 -3V-6.5M-4 -3Q0 0 4 -3"/><path d="M-1.4 -6L0 -9L1.4 -6M-5.4 -6.2L-4 -8.6L-2.6 -6.2M2.6 -6.2L4 -8.6L5.4 -6.2" fill="{gold}" stroke="none"/></g>')
    # 문양 B: 물결 소용돌이 원 (두 갈래 소용돌이: 스스로 180° 대칭)
    swirl = (f'<g id="sw"><circle r="5.2" fill="{bg}" stroke="{teal}" stroke-width=".9"/>'
             f'<path d="M0 0C0 -2 2.6 -2.2 3 0C3.4 2.6 -0.5 3.6 -2.2 2.2M0 0C0 2 -2.6 2.2 -3 0C-3.4 -2.6 0.5 -3.6 2.2 -2.2" fill="none" stroke="{gold}" stroke-width=".9" stroke-linecap="round"/></g>')
    # 문양 C: 조개 (부채꼴 기하)
    shell = (f'<g id="sh" fill="none" stroke="{gold}" stroke-width=".8"><path d="M0 3L-4.2 -1.6A4.6 4.6 0 0 1 4.2 -1.6Z"/>'
             f'<path d="M0 3L-2.2 -3.4M0 3L0 -3.8M0 3L2.2 -3.4"/></g>')
    A = grid(24, 24, False, skip_center=16)  # 마름모 가운데
    B = grid(24, 24, True)  # 마름모 꼭짓점
    tri = [p for p in A if (round((p[0] - CX) / 24) + round((p[1] - CY) / 24)) % 2 == 0]
    shl = [p for p in A if (round((p[0] - CX) / 24) + round((p[1] - CY) / 24)) % 2 != 0]
    field = uses('tr', tri) + uses('sh', shl) + uses('sw', B)
    center = (f'<circle cx="{CX}" cy="{CY}" r="13" fill="{bg}" stroke="{gold}" stroke-width="1.1"/>'
              f'<circle cx="{CX}" cy="{CY}" r="9.5" fill="none" stroke="{teal}" stroke-width=".8"/>'
              + ''.join(f'<path d="M{f(CX)} {f(CY)}Q{f(CX + 6 * math.cos(a + .5))} {f(CY + 6 * math.sin(a + .5))} {f(CX + 8.5 * math.cos(a))} {f(CY + 8.5 * math.sin(a))}" fill="none" stroke="{gold}" stroke-width=".9"/>' for a in [k * math.pi / 4 for k in range(8)])
              + f'<circle cx="{CX}" cy="{CY}" r="1.8" fill="{gold}"/>')
    defs = key_h + key_v + trident + swirl + shell
    body = (f'<rect width="{W}" height="{H}" fill="{bg}"/><g clip-path="url(#fc)">{lat}{field}</g>{center}'
            + border(gold, bg, 'kh', 'kv', 9, 9) + badges(bg, gold))
    return svg(defs, body)


# ─────────────────────────────── 2. 성 안뜰 ───────────────────────────────
def castle():
    bg, stone, silver, gold = '#1d2331', '#3a4459', '#dfe4ec', '#c99c4f'
    # 띠: 흉벽(톱니) — 가로 단위 12, 세로 단위 12
    cren_h = f'<path id="ch" d="M0 8.5H2V2H7V8.5H12" fill="none" stroke="{silver}" stroke-width="1"/>'
    cren_v = f'<path id="cv" d="M8.5 0V2H2V7H8.5V12" fill="none" stroke="{silver}" stroke-width="1"/>'
    # 바탕: 엇갈려 쌓은 마름돌 줄눈 (가운데 기준 대칭: 줄마다 반 장씩 어긋남)
    rows = []
    bh, bw = 12, 24
    for j in range(-13, 14):
        y = CY + j * bh
        rows.append(f'M0 {f(y + bh / 2)}H{W}')
        off = (bw / 2) if j % 2 else 0
        for i in range(-6, 7):
            x = CX + off + i * bw
            rows.append(f'M{f(x)} {f(y - bh / 2)}V{f(y + bh / 2)}')
    ash = f'<path d="{"".join(rows)}" stroke="{stone}" stroke-width=".8" fill="none"/>'
    # 문양 A: 눈 결정 (여섯 갈래, 스스로 대칭)
    arms = ''
    for k in range(6):
        a = k * math.pi / 3
        c, s = math.cos(a), math.sin(a)

        def P(r, t=0):
            return f'{f(r * c - t * s)} {f(r * s + t * c)}'

        arms += f'M0 0L{P(6.5)}M{P(3.2)}L{P(5, 1.6)}M{P(3.2)}L{P(5, -1.6)}'
    flake = f'<g id="fl"><circle r="7.5" fill="{bg}"/><path d="{arms}" stroke="{silver}" stroke-width=".9" stroke-linecap="round" fill="none"/></g>'
    # 문양 B: 종 (위쪽 절반은 바로, 아래쪽 절반은 거꾸로)
    bell = (f'<g id="bl"><path d="M-4.6 3.4C-4.4 -1 -3 -4.6 0 -4.6C3 -4.6 4.4 -1 4.6 3.4Z" fill="{gold}"/>'
            f'<path d="M-5.6 3.4H5.6" stroke="{gold}" stroke-width="1.2"/><circle cy="4.8" r="1.1" fill="{gold}"/><path d="M0 -4.6V-6.2" stroke="{gold}" stroke-width="1"/></g>')
    A = grid(24, 24, False, skip_center=18)
    B = grid(24, 24, True)
    field = uses('fl', A) + uses('bl', B)
    center = (f'<path d="M{CX} {CY - 16}L{CX + 12} {CY}L{CX} {CY + 16}L{CX - 12} {CY}Z" fill="{bg}" stroke="{silver}" stroke-width="1"/>'
              f'<use href="#fl" transform="translate({CX} {CY}) scale(1.35)"/>')
    defs = cren_h + cren_v + flake + bell
    body = (f'<rect width="{W}" height="{H}" fill="{bg}"/><g clip-path="url(#fc)">{ash}{field}</g>{center}'
            + border(silver, bg, 'ch', 'cv', 12, 12) + badges(bg, silver))
    return svg(defs, body)


# ─────────────────────────────── 3. 산사 ───────────────────────────────
def temple():
    bg, red, gold, green = '#173128', '#b0402f', '#dcc38a', '#2f6a58'
    # 띠: 연주문 (구슬 + 작은 마름모)
    bead_h = f'<g id="bh"><circle cx="3" cy="4.5" r="2.1" fill="{gold}"/><path d="M8 2.5L9.8 4.5L8 6.5L6.2 4.5Z" fill="{red}"/></g>'
    bead_v = f'<g id="bv"><circle cx="4.5" cy="3" r="2.1" fill="{gold}"/><path d="M2.5 8L4.5 6.2L6.5 8L4.5 9.8Z" fill="{red}"/></g>'
    # 바탕: 가는 녹청 마름모 격자 (단청 금문처럼)
    lat = []
    for k in range(-20, 21):
        c = CX + k * 28
        lat.append(f'M{f(c - 160)} {f(CY - 160)}L{f(c + 160)} {f(CY + 160)}M{f(c + 160)} {f(CY - 160)}L{f(c - 160)} {f(CY + 160)}')
    latp = f'<path d="{"".join(lat)}" stroke="{green}" stroke-width="1" fill="none"/>'
    # 문양 A: 연꽃 (여덟 잎, 붉은 잎 + 금빛 속잎 + 가운데)
    petals = ''.join(f'<ellipse cx="0" cy="-5.4" rx="2.6" ry="4.4" transform="rotate({k * 45})" fill="{red}"/>' for k in range(8))
    inner = ''.join(f'<ellipse cx="0" cy="-3" rx="1.3" ry="2.4" transform="rotate({k * 45 + 22.5})" fill="{gold}"/>' for k in range(8))
    lotus = f'<g id="lt">{petals}{inner}<circle r="1.8" fill="{bg}"/><circle r="1" fill="{gold}"/></g>'
    # 문양 B: 구름문 (두 번 말린 S자: 스스로 180° 대칭)
    cloud = (f'<g id="cl" fill="none" stroke="{gold}" stroke-width="1.1" stroke-linecap="round">'
             f'<path d="M-7 0C-7 -3.6 -2.6 -3.6 -2.6 -0.8C-2.6 1 -4.6 1 -4.6 -0.4M7 0C7 3.6 2.6 3.6 2.6 0.8C2.6 -1 4.6 -1 4.6 0.4M-2.6 -0.8C-1 2 1 -2 2.6 0.8"/></g>')
    A = grid(28, 28, False, skip_center=18)
    B = grid(28, 28, True)
    field = uses('lt', A) + uses('cl', B)
    center = (f'<circle cx="{CX}" cy="{CY}" r="14" fill="{bg}" stroke="{gold}" stroke-width="1.1"/>'
              f'<circle cx="{CX}" cy="{CY}" r="11.5" fill="none" stroke="{red}" stroke-width="1.4"/>'
              f'<use href="#lt" transform="translate({CX} {CY}) scale(1.05)"/>')
    defs = bead_h + bead_v + lotus + cloud
    body = (f'<rect width="{W}" height="{H}" fill="{bg}"/><g clip-path="url(#fc)">{latp}{field}</g>{center}'
            + border(gold, bg, 'bh', 'bv', 11, 11) + badges(bg, gold))
    return svg(defs, body)


# ─────────────────────────────── 4. 대성당 ───────────────────────────────
def cathedral():
    bg, gold, rose, ivy = '#2a1619', '#cfa452', '#a0212f', '#4d6a3a'
    # 띠: 작은 뾰족 아치가 줄지은 아케이드
    arch_h = f'<path id="ah" d="M0.5 8.5V4.5Q0.5 0.8 4 0.2Q7.5 0.8 7.5 4.5V8.5" fill="none" stroke="{gold}" stroke-width=".9"/>'
    arch_v = f'<path id="av" d="M8.5 0.5H4.5Q0.8 0.5 0.2 4Q0.8 7.5 4.5 7.5H8.5" fill="none" stroke="{gold}" stroke-width=".9"/>'
    # 바탕: 트레이서리 — 원 격자 속 사엽 장식(쿼트리포일), 원끼리 맞닿는 자리마다 첨두 아치 모양 틈
    a = 5.2
    quatre = (f'<g id="qf"><circle r="12" fill="none" stroke="{gold}" stroke-width=".9"/>'
              f'<path d="M{-a} {-a}A{a} {a} 0 0 1 {a} {-a}A{a} {a} 0 0 1 {a} {a}A{a} {a} 0 0 1 {-a} {a}A{a} {a} 0 0 1 {-a} {-a}Z" fill="none" stroke="{gold}" stroke-width="1"/>'
              f'<circle r="1.6" fill="{gold}"/></g>')
    # 문양 B: 장미 (다섯 잎 + 금빛 꽃술)
    rose_p = ''.join(f'<circle cx="{f(3.1 * math.sin(k * 2 * math.pi / 5))}" cy="{f(-3.1 * math.cos(k * 2 * math.pi / 5))}" r="2.9" fill="{rose}"/>' for k in range(5))
    leaves = f'<path d="M-3 4.5Q-6.5 6.5 -7.5 3.5Q-4.5 2.5 -3 4.5ZM3 4.5Q6.5 6.5 7.5 3.5Q4.5 2.5 3 4.5Z" fill="{ivy}"/>'
    rosem = f'<g id="rs">{leaves}{rose_p}<circle r="1.7" fill="{gold}"/></g>'
    A = grid(24, 24, False, skip_center=20)
    B = grid(24, 24, True)
    # 담쟁이 덩굴: 원 격자 사이를 사선으로 가로지르는 가는 금선 (대칭)
    vines = []
    for k in range(-14, 15):
        c = CX + k * 48
        vines.append(f'M{f(c - 160)} {f(CY - 160)}C{f(c - 80)} {f(CY - 70)} {f(c + 80)} {f(CY + 70)} {f(c + 160)} {f(CY + 160)}')
    vine = f'<path d="{"".join(vines)}" stroke="{ivy}" stroke-width=".9" fill="none" opacity=".9"/>'
    field = vine + uses('qf', A) + uses('rs', B)
    # 가운데: 작은 장미창
    rw = ''.join(f'<path d="M{CX} {CY}L{f(CX + 13 * math.cos(k * math.pi / 6))} {f(CY + 13 * math.sin(k * math.pi / 6))}" stroke="{gold}" stroke-width=".8"/>' for k in range(12))
    center = (f'<circle cx="{CX}" cy="{CY}" r="16" fill="{bg}" stroke="{gold}" stroke-width="1.2"/>'
              f'<circle cx="{CX}" cy="{CY}" r="13" fill="{rose}" opacity=".55"/>{rw}'
              f'<circle cx="{CX}" cy="{CY}" r="6" fill="{bg}" stroke="{gold}" stroke-width="1"/><circle cx="{CX}" cy="{CY}" r="2.2" fill="{gold}"/>')
    defs = arch_h + arch_v + quatre + rosem
    body = (f'<rect width="{W}" height="{H}" fill="{bg}"/><g clip-path="url(#fc)">{field}</g>{center}'
            + border(gold, bg, 'ah', 'av', 8, 8) + badges(bg, gold))
    return svg(defs, body)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('p_poseidon', poseidon), ('p_castle', castle), ('p_temple', temple), ('p_cathedral', cathedral)]:
        s = fn()
        path = os.path.join(OUT, name + '.svg')
        with open(path, 'w') as fh:
            fh.write(s)
        print(name, len(s.encode()), 'bytes')
