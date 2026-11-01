# 부모 generic/core 읽기 검수

`balance_generic_20261101.mjs`, `balance_core_20261101.mjs`, `special_balance.mjs`의 연구 옵션과 generic/a·b의 진행 중 원본을 읽었습니다. **부모 소유 파일은 수정하지 않았습니다.** 아래는 엄격 재생 보완 전 a140/b134행을 읽은 시점의 확인이며, 부모가 같은 시간에 드라이버를 보완하고 있습니다.

## 확인된 정상 경로

- generic은 `drillRun(...normalDamage:true)`를 전달합니다. 이 경우 상대 `applyWound/knockDown/dropSword`를 덮는 옛 억제 분기를 건너뛰므로 정상 피해·의식·사지·넘어짐 경로가 살아 있습니다.
- `observeRound`는 실제 몸의 `blood/consciousness/limbs/stamina` 전후를 읽고, `onWound`의 `pr.v.part` 콜라이더 부위를 보존합니다. 원래 콜백을 호출하고 물리 계수를 바꾸지 않습니다.
- 손 긋기는 `ScriptedTouchInput`의 실제 `Input` 처리기를 통과합니다. 이동은 `P.move/stickX/stickY` 명령 프록시이고 redondo/lianchi의 hold/tap은 별도 드라이버 프록시입니다. 현재 메타 설명에도 이 차이가 있습니다.

## 발견·전달한 문제

1. **좌표 검사 키 불일치:** 이전 `viewportValid`는 `e.x/e.y`를 검사했지만 실제 이벤트는 `clientX/clientY`여서 검증이 항상 통과했습니다. 부모에게 전달했고, 검수 중 현재 코드는 `clientX/clientY`와844×390 범위 검사로 바뀐 것을 확인했습니다. 추가로 부모 실행 프로세스가 import한 `ScriptedTouchInput` 버전도 새 pointerdown마다 화면 시작점을 되돌리는 버전인지 `inputEvents`로 확인해야 합니다.
2. **쓰바메 기회 부재:** a의 쓰바메 켬18행은 실제 시작0이고 첫 `oberhau`가 **18행 모두 `landed:true,bound:false`**입니다. 첫 베기가 맞았으므로 빗나감/막힘 조건을 만들지 못했습니다. 상처 심각도가0인 일부 행도 통증을 준 둔타면 landed가 참일 수 있습니다. 이 자료는 단발 위력0의 근거가 아닙니다. 실제 높은 막기 자세에 막힌 첫 칼, 또는 먼 첫 헛침 뒤 조건 창 안 접근·올려 긋기 같은 별도 조건부2~3건을 먼저 확인할 필요가 있습니다. ghost나 landed 참값 덮기는 필요하지 않습니다.
3. **같은 명령 쌍:** 이전 포인터 trace 비교에서 redondo18쌍은 모두 불일치했고 공통prefix도 달랐습니다. 부모가 찾은 `uq.winding`에 따른 release 피드백과 맞습니다. talho18·쓰바메18·코테18·요격18·체보요격 확인13쌍은 포인터 trace가 일치했습니다. 히라키기리16쌍은 공통prefix가 모두 같았고2쌍만 종료 후 trace 길이가 달랐습니다. 이 검사는 손 포인터만이며 스틱/hold/tap 전체가 같다는 뜻은 아닙니다.
4. **염시 입력의 실제 범위:** 이전 lianchi18쌍은 양쪽 `inputEvents`가 모두 빈 배열입니다. `cavBot`이 논리 탭으로 `P.skill.thrust()`를 호출하는 경로이므로 실제 터치 탭 판독까지 시험한 것으로 부르면 안 됩니다. 조건·실행·정상 피해 검사로는 유용합니다. 부모의 tap/hold/pointer/stick 전체 명령 기록·재생이 엄격 대조를 위한 적절한 보완입니다.
5. **결과 분류:** core의 `dead:!alive`, 기존 요약 `enemyDead`는 기절을 포함하는 게임 종료입니다. 원인 `cause`를 유지하고 사망/기절을 따로 집계해야 합니다. `started`는 새 motion-state 객체 수이므로 복합 동작의 여러 단계가 별도 객체로 생기면 공격 횟수와 같지 않을 수 있습니다. 기록된 `accepted/fired/requests/motion-state-start`를 함께 보아야 합니다.
6. **엄격 재생의 관측 종료:** on에서 상대가 일찍 종료되면 기록한 명령 plan도 짧아질 수 있습니다. off는 기본 종료시간까지 계속 관측할 수 있으므로 재생 길이·완료 여부·공통 prefix와 양쪽 실제 종료시간을 남겨야 합니다. 전체 혈액/기력 차이와 동일 관측시간 차이를 구분해야 합니다.

부모가 추가 중인 `commandFrame.ops(hold/tap/pointer)+stick`, `commandHash`, `replayedFrames`, `replayComplete`를 읽어 확인했습니다. off의 원래 조건 반응 운전은 우회하고 기록된 명령을 재생하는 구조이며, 보완 후 자료에서 명령 hash뿐 아니라 실제 포인터 수·좌표·종료 범위까지 검증하는 것이 좋습니다. 상처·넘어짐을 억제하거나 `src`를 변경할 이유는 발견하지 못했습니다.
