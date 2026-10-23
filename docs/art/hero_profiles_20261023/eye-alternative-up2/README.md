# 올리비에 새 시안 — 눈 부위 두 칸 위로

사용자 요청에 따라 직전 별도 시안의 눈썹·눈꺼풀·눈동자 두 영역을 그대로 위로2셀(원본 캔버스100px) 이동했다. 원래 위치는 주변 피부 명암으로 메웠다. 두 영역의 내부 색/모양이 이동 전과 정확히 동일함을 배열로 검증했다.

- 가까운 쪽 영역: x11–13/y6–8 → y4–6. 먼 쪽: x15–16/y7–9 → y5–7. 좌표는0부터 센다.
- 눈동자 `(12,8)/(15,9)` → `(12,6)/(15,7)`. 턱14행과 크롭은 유지하므로 눈~턱 간격은 이번 요청에 따라8/7행으로 늘었다.
- 지정 영역 밖 셀, alpha, 액자1·22×22 격자·50px 크기 유지. 고화질 원본은 같은 기준 그림을 복사 보존했다. 원래 별도 시안과 갤러리37개는 덮어쓰지 않았다.
- `tools/content/raise_olivier_eyes_20261024.py`로 재현. `sprite.json`은 편집본, `validation.json`은 정확한 이동/영역 밖 보존/액자·격자·alpha와 파일 해시 검증이다.

사용자 검토용이며 우화 발송/게임 연결 없음. 배포 완료는 `publication.json`.

[이동 전후 비교](https://yoonjl-svg.github.io/halfsword-codex/encounters/hero-profiles-20261023/olivier-eye-alternative-up2/comparison.png)

[low](https://yoonjl-svg.github.io/halfsword-codex/encounters/hero-profiles-20261023/olivier-eye-alternative-up2/low.png) · [그리드](https://yoonjl-svg.github.io/halfsword-codex/encounters/hero-profiles-20261023/olivier-eye-alternative-up2/grid.png) · [원본](https://yoonjl-svg.github.io/halfsword-codex/encounters/hero-profiles-20261023/olivier-eye-alternative-up2/original.png)
