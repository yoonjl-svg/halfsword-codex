# 롤랑 투구 양감 / 올리비에 눈 끝 보정

사용자 후속 지시 두 항목을 반영했다.

- 롤랑: 투구 왼쪽 위 곡면과 옆면에 한 셀 두께의 단계적 음영9셀. 밝은 술과 투구가 한 덩어리로 읽히는 문제를 보완하는 시안이다. 사용자가 지정한 검은 눈끝 `(7,7)`과 기존 눈매·장식·실루엣은 유지했다.
- 올리비에: **두 칸 올린 마지막 시안** 기준. 각 눈의 가장 오른쪽 끝 `(13,6)`, `(16,7)`을 각각 `(13,7)`, `(16,8)`로 한 칸 아래 이동했다. 나머지 눈동자/눈썹/올린 높이는 유지. 실제로 달라지는 좌표는 출발/도착4셀뿐이다.
- 원본·low·grid 보존, 공통액자·1254정사각·22×22/50px격자·투명도 유지. 기존34개 보호파일107개 불변. 이전 시안도 유지했다.

롤랑은 기존 새 인물 갤러리의 low/grid를 갱신했다. 올리비에는 이전처럼 별도 시안 경로 `details-20261024/olivier/`이며 갤러리 v4를 덮어쓰지 않았다. 사용자 미감 검토/최종 선택 전, 게임 모델·전투·우화 메시지 변경0.

재현: `python3 tools/content/refine_portrait_details_20261024.py`. 셀 단위 변경·이동 검증 및 공통 액자/격자/alpha 검사 기록은 `*-changes.json`, `validation.json`과 상위 `asset-validation.json`에 있다. 배포 결과는 `publication.json`.

[전후 비교](https://yoonjl-svg.github.io/halfsword-codex/encounters/hero-profiles-20261023/details-20261024/comparison.png)

후속 색 보정: 사용자 요청으로 방금 내린 두 셀만 `#6E503B`→`#4F3829`로 한 톤 어둡게 했다. 위치·나머지 그림 불변, 실제 PNG 차분5000픽셀 확인. `darkening-validation.json` / 최신 색 배포는 `darkening-publication.json`.
