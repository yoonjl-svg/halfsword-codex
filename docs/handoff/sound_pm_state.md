# 사운드 PM 상태 (늘 최신으로)

**최신 · 2026-10-02 21:12 KST:** 사용자가 A2-drawn-edge를 단축 약타격, B2-drawn-fiber를 단축하되 더 긴 강타격으로 선택·적용 승인했다. 코드 기본은 이제 `drawn`, 마찰 구간 .26/.35초,112 게임J로 분기한다. 찌르기는35차 유지. 실제 렌더/빌드/모바일 로컬 검사 완료, 인증401로 공개 웹에는 아직 미반영이다. [선택 반영 보고](../sound/slash_selected_short.md). 아래35차 기본 활성화는 이전 역사다.

## 독립 저장소의 후속 적용 — 2026-10-01

사용자가 이전 `slash35_heavy` 변경 사운드를 찾아 적용하라고 승인했다. 정확한 이름의 파일은 현재 기록에 없지만, 35차 강베기 구현은 커밋 `7119944eaa117f2c42fa04ead0b79e2a8c3e6243`의 `SYNTH.slashHit(kind='heavy')`와 `slashHeavy` 뱅크로 보존돼 있다. 이 35차 후보에 대응하는 요청으로 판단하여, 인계서의 적용 방식대로 독립 저장소 `SOUND.fleshHit` 기본값을 `samsho`로 바꿨다.

일반 베기는 `slashCut`, 112 J 이상 베기는 `slashHeavy`, 베고 지나감은 `slashThrough`, 찌르기는 `slashStab`를 사용한다. 합성 함수·세기 문턱은 원래 35차 구현 그대로이며, 사운드 비교 페이지에서 적용안과 이전 기본을 표시한다. 비교용 다른 후보는 남겨 둔다. 원본 저장소는 수정하지 않는다.

아래는 Fable 팀의 당시 기록이며, 35차 선택 대기는 위 승인으로 해소됐다.

갱신: 2026-09-30 (30차 뒤). 브랜치 `claude/pm-sound-impact`. 디렉터 `session_014nJCzE4hyxiYc9innhSUng`. 자세한 규칙은 `sound_pm_handoff.md`, 작업 기록은 `pm-sound-impact.md`.

## 맡은 일
- 모든 소리: `src/sound.js`(엔진·합성·녹음 로딩·BodySounds), `src/soundgen.js`(일꾼), `src/soundlab.js` + `sounds.html`(들어보기), `public/sfx/**`(CC0 위주, 출처 `LICENSE.txt`), `config.js` SOUND 블록.
- `src/main.js`는 디렉터 요청 시 사운드 호출 줄만. `src/fighter.js`·`src/gun.js`·`src/debris.js`는 건드리지 않는다.
- 역할 분담안(main `docs/pm_roles_charter.md` 부록 B): 에너지 눈금(150 J과 500 J이 다르게), 디딤 소리(동작 PM의 딛는 시각 φc·gait onTouchdown 'strike'), 센 타격·딛기가 소리에 맞는지 확인, 라운드 판정에 소리 의견.

## 진행 중 / 끝남
- [끝남] 32차(9/30): 참수 소리 — 절단감 `decapitate`(목소리 없음) + 떨어진 머리 `headLand`(맨머리/투구). BodySounds 로 연결, main.js 변경 없음. 그림 `decap_sound_before_after.png`.
- [진행 중] 31→33→34차(9/30): 칼→몸 소리 후보. 31차 "둔기·죽도" → 33차 날 선 칼("애매") → 34차 사무라이 쇼다운식(`samsho`) → 35차 "하오마루·갠주로·한조의 강베기처럼": 두꺼운 "쩌억" + 강베기 판 + 긴 피. 사장님 선택 대기.
- [끝남] 30차: 큰 타격 배경 소리 간격 `SOUND.stageHitGap` = 10초(`_spaced`; 종·불길·천·돌·새·박쥐·나뭇잎·풍경·까마귀). 타격음은 그대로.
- [끝남] 30차: 리볼버 총성 `sound.gunshot` (.357/.44급, 무대 방 울림 + 바깥 메아리 꼬리). gun.js `gunshotSound` 첫 줄이 넘긴다. 전후 그림 `gunshot_before_after.png`. 사장님 내일 시험.
- [끝남] 세기 눈금 준비: `sound.hitWeight(energy, e0)` — 베기·찌르기·강철 충돌 공통. `SOUND.hitScale`('legacy' 기본 = 지금 소리, 'log' = 200 J 위로 로그 무게). `sounds.html` "세기 눈금 A/B" 3행(150/300/500 J). 게임 호출은 안 바꿈.
- [끝남] 디딤 훅: `sound.footStrike(strength 0~1, pos)`. 아직 부르는 곳 없음(디렉터 R2/R4). `sounds.html` "디딤" 행.
- [안 함] 총성 후보: 디렉터 보류(사장님이 원하실 때).

## 열린 요청 / 기다리는 것
- (9/30 사장님 직접) 칼→몸 소리: 후보 'samsho'(34차) / 'rec'·'synth'(33차) / 지금 'legacy', 기본 'legacy'. 사장님이 사무라이 쇼다운 참고 장면 녹음을 주시면 재서 맞춘다(참고만, 가져오지 않음). **사장님 선택 대기** → 고르면 기본값 바꾸고 안 고른 쪽 지움. 'rec' 을 고르면 Freesound 가 열릴 때 edge 원본 2개(399616, 344404) 페이지에서 CC0 를 다시 확인.
- 화전 터(clearing) 소리: 사장님 실제 플레이 피드백 대기.
- 총성·간격(30차): 사장님 내일 시험 → 피드백에 따라 `SOUND.stageHitGap`·`gunshot` gain/크랙 조정.
- R3 에서 디렉터가 `sound.hitScale = 'log'`(또는 config `SOUND.hitScale`)로 넘기고, 타격 호출에 온몸 타격 에너지를 준다.
- R2/R4 에서 디렉터가 gait 딛는 순간에 `sound.footStrike(strength, pos)`를 잇는다.

## 재현 명령
- 참수 소리: `tools/browser/decap_shots.mjs` 로 장면을 만든다(playwright 는 `node_modules/playwright` 경로로). 용 투구(마르그레테)는 목을 머리 몸 기준 -0.11m 로 몰아야 목에 맞는다.
- 시뮬 3종(main과 바이트 동일해야 함): `node tools/sim/live_battery.mjs`, `node tools/sim/fights12.mjs`, `node tools/sim/hybrid.mjs fights12.mjs` — main 워크트리와 `cmp`.
- 스모크: `npx vite --port 5179 --strictPort --host 127.0.0.1` 뒤 `node tools/browser/smoke.mjs http://127.0.0.1:5179` → "ZERO console errors".
- 들어보기: `sounds.html` (같은 vite). 오프라인 렌더는 `window.lab.render({dur, events:[{t, call, args}], samples:true, returnAudio:'b64', seed})`.

## 관문 (최근)
- 35차: 시뮬 3종 main `b3d0a1b`와 바이트 동일, 스모크 콘솔 에러 0, 실제 게임 모든 모드 에러 0.
- 34차: 시뮬 3종 main `a96cba3`와 바이트 동일, 스모크 콘솔 에러 0, 실제 게임 네 모드 에러 0.
- 33차: 시뮬 3종 main `a96cba3`와 바이트 동일, 스모크 콘솔 에러 0, 실제 게임 세 모드 에러 0.
- 32차: 시뮬 3종 main `a96cba3`와 바이트 동일, 스모크 콘솔 에러 0, 실제 참수 4명(decap_shots 사본) 에러 0.
- 31차: 시뮬 3종 main `63f6b94`와 바이트 동일, 스모크 콘솔 에러 0, 실제 게임 세 모드 에러 0.
- 30차: 시뮬 3종 main `c9fc916`와 바이트 동일, 스모크 콘솔 에러 0, 실제 게임(성 안뜰·권총) 간격·총성 경로 확인.
- 29차: 시뮬 3종 main `940f665`와 바이트 동일, 스모크 콘솔 에러 0, 실제 게임 hitScale 'legacy'·w=0 확인.

## 다음 할 일
- 디렉터 지시 대기. 매일 18:00 KST 10줄 보고(끝남/진행 중/안 함 + 커밋 해시).
