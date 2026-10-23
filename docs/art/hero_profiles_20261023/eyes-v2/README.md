# 롤랑·올리비에 low 눈 표현 수정

2026-10-23 사용자 피드백: 롤랑 눈이 너무 일자이고 올리비에 눈 표현이 어색함.

- 롤랑: 9셀 변경. 길게 이어진 수평 검은 눈틈을 짧은 계단형 경사로 바꾸고, 양끝은 금속 경계색으로 좁혔다. 금색 콧등과 얼굴 가림은 유지했다.
- 올리비에: 11셀 변경. 낮아 보이던 먼 쪽 눈을 한 행 올리고, 두 눈동자의 높이를 맞췄다. 흰자·눈썹의 대비를 낮추고 가까운 눈과 먼 눈의 명암을 다르게 했다.
- 고화질 원본은 대조 기준으로 보존했다. 변경은 low의 눈 주변 및 같은 그림의 grid 파일이다. 얼굴 폭·턱·상반신 크롭·22×22 격자·50px 셀·액자1·투명 배경 유지.
- 백린의 원본/low/grid, 세 인물의 고화질 원본, 기존34개 파일 모두 변경 없음. `validation.json` 및 기존 빌더 검증으로 확인했다.

이전 픽셀 원본은 `sprites-before.json`, 전후 파일은 두 `*-before.png`와 공개 갤러리 최종 low에 보존했다. `cell-edits.json`에 각 좌표와 전후 색을 기록했다. `tools/content/refine_hero_eyes_20261023.py` → 기존 빌더 순으로 최종본을 재현한다.

실제 브라우저 390/1280폭 화면과 이미지 디코딩·low/grid 저장·넘침 검사 기록을 보관했다. 사용자 미감 확인 전이며 새 우화 발송/게임 모델 수정은 없다. 공개 확인은 `publication.json`을 따른다.

[전후 비교](https://yoonjl-svg.github.io/halfsword-codex/encounters/hero-profiles-20261023/eyes-v2-comparison.png)

[전체 새 인물 갤러리](https://yoonjl-svg.github.io/halfsword-codex/encounters/pixel-profiles-low128-20261017/?new=1)
