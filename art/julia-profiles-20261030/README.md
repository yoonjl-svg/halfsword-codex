# 쥘리아 크리스테바 기본·얼터 프로필

사용자 전달 승인본. 각 id 폴더의 original/low/grid 세 파일을 함께 보존한다. 기본 b-05, 얼터 기계 반신 최종본이다. frame1.png는 기존 공통 액자 원본, sprites.json/cells.png는 고정22×22 편집 원자료, master.png는 고화질 인물 원화다.

`python art/julia-profiles-20261030/rebuild.py --check`는 원화/셀/액자에서 재구성한 RGBA가 전달 PNG6장과 정확히 같은지 검사한다. 인물만50px 격자, 액자는 원래 해상도, 캔버스1254²/원점77. --check 없이 실행하면 같은 픽셀을 다시 저장한다(PNG 압축 바이트는 달라질 수 있음).

게임 표시는 수신판과 같은 768² WebP이며 tools/ui/portraits_px_build.py로 재생성한다. 원본/low/grid PNG를 이 WebP로 대체하지 않는다. 출처/파일해시/경로는 manifest.json, 연결과 검증/되돌림은 docs/import/julia_20261030/README.md.
