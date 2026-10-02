# 검술 보정의 입력·팔 한도 간섭 1차

2026-10-02. **동일한 실제 게임 상태와 손 입력에서 검술 보정 약/보통은 더 빠르게 도는 칼 목표와 입력 종료 뒤 추가 이동을 만들었다. 팔 finalCap에서도 이 경로는 남았다.** 사용자가 보고한 브라우저 장면을 그대로 재현한 결과는 아니며, 보정/팔 후보의 일반 설정을 변경하지 않았다.

기준 소스는 `7cbac075e093c5b9450e718ef9b7790347eab7de`. [실행 도구](../../tools/sim/experiments/skill_interference_probe.mjs), [수치·원자료 SHA](skill_interference_round1_metrics.json). 원자료는 저장소 밖 `/workspace/halfsword-hybrid-evidence/skill-interference-round1-final.json`이다. 최초 출력은 보존했고 최종 재실행을 별개의 독립 표본으로 세지 않는다.

## 검증 범위

실제 Fighter/Skill/Gait/Combat/Rapier를 실행했다. zweihander, seed7, 내려베기 `[.02,.52]→[.02,-.45]` .55초 뒤 1.5초 hold/release × level0/.4/.7 × arm legacy/sharedCap의 **12행**, 관찰 없는 대조2행이다. 상대는 멀리 옮겨 접촉이 없었다. grip paired, cut budgeted를 고정했다. 새 제어기·근력·gain·몸 위치·속도는 주입하지 않았다.

모든 행은 기존 level .7/팔 legacy/grip legacy로3초 준비한 **동일 native/controller 상태**에서 시작하고, 시작 직후 선택한 level/arm/grip/cut을 적용했다. 따라서 각 메뉴 설정으로 게임을 처음부터 시작한 비교와 다르다. 시작 hash·외부 drag hash·소스 파일 hash·HEAD 전후 일치, 전 행 finite, 관찰 유무2쌍의 전체 physical/control trace exact를 통과했다. 최종 벽시계4.67초, 준비/대조를 포함한 시뮬레이션70.7초다.

`sameRequestedInput`은 기존 runStroke의 **외부 drag+시간만** 해시한다. hold/release boolean이나 자동 복귀가 바꾼 handOffset을 포함하지 않는다. per-step `handHeld/inputActive/actualHandOffset`를 따로 저장했고 각 종료 조건의 boolean을 직접 확인했다. target readout은 native step 전, 실제 강체 readout은 step 후다.

## 실제 관찰

아래는 팔 legacy이며 sharedCap에서도 가까운 결과였다. 축 이동량은 입력 종료 뒤1.5초의 누적 blade-axis 이동량이며 끝 방향 오차와 다르다. 실제 omega에는 비틀림이 포함되지만 blade-axis 이동에는 포함되지 않는다.

| 보정 | 자세 지도 비중 | 목표 축 최대속도 rad/s | 실제 검 최대 omega rad/s | hold 종료 축 이동 rad | release 종료 축 이동 rad |
|---|---:|---:|---:|---:|---:|
| 끔0 | 0 | 6.03 | 7.24 | .378 | .378 |
| 약.4 | .64 | 27.50 | 12.30 | .727 | 1.537 |
| 보통.7 | 1 | 41.34 | 24.46 | .975 | 2.092 |

최대 목표 속도는 설정 전환 직후가 아니라 **drag 중 .2083/.1917/.1833초**, filtered pad y=.3105/.3233/.3291에서 발생했다. 첫 관찰 프레임에는 이전 관찰이 없어 목표 차분을0으로 두었으며 그 프레임을 peak로 세지 않는다. 이는 모든 시작 과도응답을 배제했다는 뜻은 아니다. 보통 행은 준비와 같은 level .7을 유지했다.

약/보통의 follow 최대는 .060/.105m. release에서 .8083초에 자동 복귀가 시작되어 handOffset은 `[.18,-.28]`에 갔다. 끔은 `[.02,-.45]`를 유지했다. hold에서는 자동 복귀가 없지만 follow 감쇠와 필터/몸 응답은 계속됐다. 약 release의 sharedCap 축 이동은1.535rad로 legacy1.537과 가까웠다. budgeted cut은 전 행 cutting 접촉0이어서 이 추가 이동의 원인이 될 수 없다.

## 입증된 코드 경로와 남은 가설

1. 메뉴 약은 `.4`이지만 [guardWeight](../../src/fighter.js#L619)는 `min(1,1.6*level)`이다. [손 위치·칼 방향 혼합](../../src/fighter.js#L1863)과 [몸 목표](../../src/fighter.js#L628)에 .64가 적용된다. 보통 .7부터 이미1이다. 약은 아주 작은 자세 개입이 아니다.
2. [Skill.update](../../src/skill.js#L559)는 `follow += vel*dt*.6*level`, `follow *= exp(-dt/.3)`, 최대 `.15*level`, `aimRaw=anchor+follow`를 사용한다. 손을 유지해도 follow가 줄면서 적용 목표가 되돌아간다. [기존 입력 종료 진단](release_intent_diagnosis_round1.md)은 같은 경로의 hold/release 공통 반전을 확인했다. [끝점 유지 후보](held_follow_endpoint_round1.md)는 회전량을 일부 줄였으나 도달 불가 요청이 늘어 일반 적용하지 않았다.
3. [자동 자세 복귀](../../src/skill.js#L593)는 `autoGuard && level>=.35` 문턱이다. 약.4도 켜지며 .25초 idle 뒤1.2m/s로 homeGuard에 handOffset 자체를 옮긴다. 복귀 속도에 level 배율이 없다. 이것이 이번 release에서 별도 추가 이동을 만든 것은 확인했다.
4. [몸 보정](../../src/fighter.js#L628)은 aimRaw, 손/칼은 filtered aim을 읽는다. [현재 holdAmount](../../src/config.js#L483)가1이므로 보정의 몸 목표 진폭은 activity가 줄어도1이고, holdSpeed .3은 추종 속도만 줄인다. 이것이 사용자 장면의 춤 전체를 설명하는지는 미검증이다.
5. [RBF 자세 지도](../../src/guards.js#L159)는 폭.15m의 가중 방향 평균을 정규화한다. 이번 filtered pad 궤적의 평균 방향 norm 최소는 .541/.544/.538로 [fallback 문턱.35](../../src/guards.js#L207)보다 크다. **이번 peak를 nearest 방향으로 갈아타는 불연속 때문이라고 설명하지 않는다.** 실제로는 지붕→황소 영역에서 매끄럽지만 가파른 방향 매핑이 관찰됐다. 다른 좌우/8자 입력에서 fallback 경계가 문제가 되는지는 후속 가설이다.
6. [팔 finalCap](../../src/fighter.js#L1849)은 어깨/손목 최종 torque 벡터를 기존 cap 안에 넣는다. 목표 생성·native 팔꿈치/빈팔/척추·그립 전체 한도는 수리하지 않는다. [cutBudget](../../src/cut_reaction.js#L60)는 실제 접촉 반작용/에너지 장부의 별도 경로다. [기존 상호작용 검사](arm_cut_interaction_round1.md)의 순간 예산 통과는 이번 검술 보정 조작감의 수락 근거가 아니다.

## 최소 다음 비교

같은 준비/입력으로 약.4의 **autoGuard만 off**인 release를 먼저 비교해 사용자 입력 뒤 자동 이동 기여를 분리한다. 다음은 hold에서 **follow만0**과 원래 약을 비교해 목표 감쇠의 기여를 분리한다. 둘 다 작은 격리 후보로 만들고 기존 수치 토크 예산을 유지한다. 그 뒤 방향 매핑만 조사한다. 현재 결과로 gain/힘을 올리거나 약의 표시값만 낮춰 해결했다고 선언하지 않는다.

현재 도구의 단일 무기/수직 입력 외에 횡베기·연속8자·다른 무기·근접 자동 내딛기·실제 충돌/부상·모바일 입력·사용자 체감은 미검증이다. 실제 브라우저의 입력 누적·hitstop·감정·저장 설정도 재현하지 않았다. core/공용 도구/엔진/HEAD/배포를 변경하지 않았다.

```sh
node tools/sim/experiments/skill_interference_probe.mjs /workspace/halfsword-hybrid-evidence/skill-interference-new.json
```
