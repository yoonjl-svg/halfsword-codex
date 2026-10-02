# 사용자 선택 A2/B2 · 단축 약·강 베기 적용

2026-10-02 21:12 KST. 사용자 지시: A2-drawn-edge가 가장 마음에 들며 더 짧게, B2-drawn-fiber도 줄이되 A2보다 길게 만들고 힘의 크기에 따라 약·강 타격음으로 적용한다. **로컬 코드 기본값 적용·검증 완료, 공개 웹 미배포**다. 적용 승인에 따라 별도 선택 대기 옵션으로 남기지 않았다.

- [약베기 A2 단축](samples/2026-10-02-selected-short/01-A2-short-weak.mp3): 베는 마찰 구간 .39→.26초. 게임90J 세 번.
- [강베기 B2 단축](samples/2026-10-02-selected-short/02-B2-short-strong.mp3): .49→.35초. 게임140J 세 번.
- [약→강→약→강](samples/2026-10-02-selected-short/03-weak-strong-comparison.mp3).

각 약/강 파일은3초이며 .2/1.2/2.2초에 소리가 난다. .26/.35초는 한 번의 합성 마찰 구간이다. 기존 미세 재생률 변주·필터/작은 보조음의 꼬리는 별도다. 청취 파일은 실제 runtime 출력에서 MP3로 인코딩했으며 이후 음량 정규화나 추가 gain을 적용하지 않았다. 인코딩 손실은 있다.

## 구현

`src/slash_draw.js`는 [2차 합성](../../tools/audio/slash_draw_candidate.mjs)의 **heavy draw/fiber** 필터·입자·주파수 구성을 가져와 마찰 지속시간만 줄였다. `cut` 변형을 A2로 오인하지 않았다. 재생을 일괄 가속해 음높이를 바꾸거나 새 타격 덩어리를 추가하지 않았다. 버퍼는 각 .34/.43초이며 마지막 .08초는 필터 감쇠용 여유다.

`src/sound.js`의 `drawnCut`/`drawnHeavy` 뱅크와 `SOUND.fleshHit='drawn'`을 연결했다. 기존 강음 경계112 게임J 미만은 A2, 이상은 B2다. `main.js`가 전달하는 `r.energy`를 그대로 사용하며 이 수치는 게임 배율이 적용된 에너지로, 실제 힘 N이나 원시 물리 에너지와 같다고 하지 않는다. `r.pass`는 관통 결과이므로 강도와 독립시켰다. 약한 관통에 자동으로 강음이 붙지 않는다.

A2의 wet×.025/body×0, B2의 wet×.06/body×.035를 기존 레이어 계수에 곱했다. 이전 청취 보정을 참고해 전체 베기 이벤트에−6.8dB를 적용하고 실제 출력에서 다시 쟀다. 기존 청취본은 limiter 이후 보정이었으므로 두 파형의 완전 동일성을 주장하지 않는다. 선택적 log 눈금에서도 별도 큰 저음 thump를 추가하지 않는다. 찌르기는 기존 samsho 경로이며 둔기·갑옷·뼈와 물리/피해 판정은 수정하지 않았다. 소리 비교 화면도 새 기본과35차 비교를 구분한다.

## 확인한 근거

[렌더·출력 지표/해시](slash_selected_short_metrics.json), [완성 빌드 브라우저](slash_selected_short_browser.json).

- 44.1/48kHz 실제 Web Audio 경로49렌더: 약/강3seed,111.9/112J×관통/비관통 경계, 찌르기 대조, 이전 A2/B2 기준, 동시48타격 스트레스와 청취3종. 소스 해시 고정·유한 출력·분기 통과. 모든 조건에서 짧은 A2 < 짧은 B2이고 각각 이전보다 짧다. 소리 에너지95% 시각은 A2 .196–.213초, B2 .260–.283초다.
- 청취 MP3 약/강은−23.82/−20.58LUFS, true peak−9.65/−7.90dBTP. 강음은 더 길고 크게 나온다. 동시48타격의 raw peak는 .881/.906이며 기존12voice 예산에 따라36개가 감쇠 종료됐다. 인위적 중첩 시험이며 실제 결투48건이 아니다.
- 찌르기는 drawn/samsho의 event·layer·선택 뱅크가 정확히 같았다. 별도 OfflineAudioContext의 출력은 byte-exact가 아니고 최대 절대차2.384e−7, 상대 RMS최대4.26e−7이었다. float 허용치와 동일 그래프를 함께 확인했다.
- Vite production build70modules 통과. 로컬 완성 빌드의 모바일 Chromium에서 Worker 생성/강제 Worker 불가 대체 경로2조건, 사용자 탭 이후 AudioContext running, 뱅크3개씩 생성, 강도 분기·음소거·새 라벨·오류0을 확인했다. 직접 Sound.cut 호출로 재생 경로를 검사한 것이며 실제 폰 청취나 자연 발생 타격 수락은 아니다.

첫 렌더는 Vite 초기 새로고침으로 중단됐다. r2의49행은 소스/분기 검사를 통과했지만 찌르기에 byte-exact를 요구한 검사 때문에 실패했다. 재생 그래프는 같고 float차만 있음을 확인한 뒤 위 허용치를 기록해 r3를 다시 실행했다. r2 원자료를 보존했으며 반복을 독립 표본으로 더하지 않았다. 생성 음색을 직접 청취했다고 주장하지 않는다.

## 전달 상태와 재현

이번 독립 저장소 API 재확인도401 Bad credentials였다. 원격 쓰기/Pages 배포는 하지 않았다. 기존 공개 게임에서 새 소리가 난다고 안내하지 않으며, 인증 복구 뒤 [전송 절차](../codex_team/github_delivery.md)로 승인된 변경을 전달한다. 원본 저장소 수정/조회 없음.

```sh
node tools/audio/render_selected_slash.mjs http://127.0.0.1:4201 /tmp/selected-slash-new
python3 tools/audio/package_selected_slash.py /tmp/selected-slash-new
npm run build
npm run preview -- --host 127.0.0.1 --port 4202 --strictPort
node tools/browser/selected_slash_smoke.mjs http://127.0.0.1:4202 /tmp/selected-slash-browser-new
```

렌더는 새 출력 경로를 쓴다. 패키저는 이미 존재하는 최종 청취본을 덮어쓰지 않으므로 재패키징 비교는 임시 checkout의 빈 출력 디렉터리에서 수행한다. 기준 HEAD4f47eb6 위 미커밋 소스의 실제 해시는 지표에 기록했다.
