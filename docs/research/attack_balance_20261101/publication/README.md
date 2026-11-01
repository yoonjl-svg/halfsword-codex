# 공개 확인 영수증

자체 main 게시 커밋은 `8477a2129b680cbbc9a0dca0434a7c7d3643f6af`입니다. [Actions41255273863](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/41255273863)의 build/deploy가 모두 success인 뒤 공개 주소를 새 Chromium과 HTTPS 요청으로 확인했습니다. 고정 게임 기준은88a96061, 연구/원본 첫 커밋은f477b90e입니다. 이후 이 영수증·비용 분리 표기를 추가했으며 게임 수치는 바꾸지 않았습니다.

- [결과표](https://yoonjl-svg.github.io/halfsword-codex/encounters/attack-balance-20261101/report.html): 390×844와1000×800, 19행·페이지 가로넘침0·오류0.
- [연습](https://yoonjl-svg.github.io/halfsword-codex/encounters/attack-balance-20261101/?technique=schielhau): 실제 전투 진입·정상 렌더·19선택·JSON 다운로드 확인.
- 일반 저장 대조 sentinel 보존, 연구 key 쓰기/clear만 연구 범위에 반영.
- SW 등록/조회/해제·cache 조회/삭제·sw.js 요청·PWA경고·페이지오류 모두0. test.html은200·연구저장 격리·게임 probe 미주입.
- HTML/JS/결과표/목록/사진/빌드목록7파일806,948bytes의 공개 SHA256이 로컬과 일치합니다. 전체2,424파일을 전부 다운로드한 검증은 아닙니다.

상세는 http-verification.json, pwa-verification.json, report-verification.json과 실제 다운로드 JSON·공개 사진을 보십시오. 기존 게임 소스238개 불변 및 관측부 유무의 원시 결과 일치는 ../validation/recorder-invariance.json에 있습니다. 실제 휴대폰 성능/사람 성공률/손맛은 검증하지 않았습니다.
