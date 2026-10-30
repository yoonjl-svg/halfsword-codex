"""캐릭터 프로필 — 투명 배경 도트판 만들기 (docs/import/portraits_px_2026-10-18.md)

사장님 10/18 16:3x: "샛별이 새 캐릭터 프로필 얼터까지 모두 그렸어. 가져와서 적용하고 플레이어 프로필은 '플래이어2'로 사용해. 배경이 투명한 것으로 하되 …"
  마스터 = art/portraits-px-20261018/<id>.png — 샛별 저장소 pixel-profiles-low128-20261017/<id>/low.png 그대로(1254² RGBA · 22 × 22 칸 · 칸 50 px · 칸 시작 (77, 77) ·
           액자 1 금테 + 네 모서리 장식이 그려져 있음 · 배경 투명). frame1.png · grid-overlay.svg · profiles.json 도 같이 둠.
  판에 쓰는 것 = public/ui/portraits/<id>.webp — 768² (PIL LANCZOS) · WebP 손실 품질 95 · 투명도 품질 100 · method 6 (한 장 약 30 KB).
  플레이어('player') = player2 그림(최초 오른쪽 3/4 — 사장님 '플래이어2'로). player1 은 마스터만 둠.
  public/ui/portraits/grid-overlay.svg = 칸 줄(22 × 22 · 1254 좌표) — 주소 ?portraitGrid=1 이면 그림 위에 겹쳐 보임(확인용).
  10/24 손님 인물 셋(롤랑 · 백린의 전사 · 베르나르도) = 샛별 저장소 손그림 확정본 art/hero-profiles-20261024/<id>/low.png(같은 꼴 · 같은 값으로 줄임 —
       docs/import/hero_profiles_import_2026-10-24.md). 10/23 임시 그림(art/portraits-temp-20261023/)은 기록으로만 둔다.

실행 (저장소 뿌리에서):  python3 -I tools/ui/portraits_px_build.py
"""
import os
import shutil

from PIL import Image

SRC, OUT = 'art/portraits-px-20261018', 'public/ui/portraits'
SIDE, QUALITY, ALPHA_Q, METHOD = 768, 95, 100, 6
PLAYER_FROM = 'player2'
SKIP = {'player1', 'player2', 'frame1'}
JULIA_SRC, JULIA_IDS = 'art/julia-profiles-20261030', ('julia', 'julia_mad')
HERO_SRC, HERO_IDS = 'art/hero-profiles-20261024', ('roland', 'white_scale', 'bernardo')  # <id>/low.png (original · grid 는 마스터만)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [('player', os.path.join(SRC, PLAYER_FROM + '.png'))] + [(f[:-4], os.path.join(SRC, f)) for f in sorted(os.listdir(SRC)) if f.endswith('.png') and f[:-4] not in SKIP]
    jobs += [(i, os.path.join(HERO_SRC, i, 'low.png')) for i in HERO_IDS]
    jobs += [(i, os.path.join(JULIA_SRC, i, 'low.png')) for i in JULIA_IDS]
    for out_id, src in jobs:
        im = Image.open(src).convert('RGBA')
        assert im.size == (1254, 1254), (src, im.size)
        im.resize((SIDE, SIDE), Image.LANCZOS).save(os.path.join(OUT, out_id + '.webp'), 'WEBP', quality=QUALITY, alpha_quality=ALPHA_Q, method=METHOD)
    shutil.copyfile(os.path.join(SRC, 'grid-overlay.svg'), os.path.join(OUT, 'grid-overlay.svg'))
    print(len(jobs), 'portraits →', OUT)


if __name__ == '__main__':
    main()
