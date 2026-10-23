# 올리비에 눈 아래의 수직 점 제거

사용자 요청으로 양쪽 가로 눈매 아래로 내려온 검은 셀 `(12,8)`, `(15,9)`를 주변 피부색으로 메웠다. 직전 v3와 실제 PNG를 비교해 이 두 셀, 총5000픽셀만 달라짐을 확인했다. 위 가로 눈매는 유지했다.

원본·롤랑·백린·기존34개, 공통액자와 격자·크롭을 보존했다. `changes.json`, `validation.json`에 좌표·전후 색과 검증을 기록했다. low와 grid를 갱신했으며 게임 모델/우화 전달은 변경하지 않았다. 사용자 미감 검토 전.

재현: `python3 tools/content/refine_hero_eyes_v4_20261023.py` 후 `python3 tools/content/build_hero_profiles_20261023.py`.

[전후 비교](https://yoonjl-svg.github.io/halfsword-codex/encounters/hero-profiles-20261023/eyes-v4-comparison.png). 공개 완료는 `publication.json`으로 확인한다.
