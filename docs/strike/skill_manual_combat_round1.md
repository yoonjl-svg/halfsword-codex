# 처음부터 검술 보정 없음: legacy 팔·절삭 및 실제 전투 검증 1차

**입력 추종은 개선됐지만 전투 수락을 완료하지 않았다.** 접촉 없는 legacy 조건 7쌍 모두 보정 없음에서 정지 후 원래 입력 기준 오차와 검축 이동이 줄었다. 실제 반응형 AI 전투에서는 부상·사망·접촉 경로가 달라졌다. 같은 seed의 결과를 같은 적중에서의 개선으로 해석할 수 없다. 보정 없음의 tap 중 살아 있는 빈팔에서 큰 관절 간격이 재현됐으나, 이 사건은 정상 라운드가 종료됐을 시간보다 뒤까지 입력을 계속한 스트레스 프로토콜에 속한다.

## 측정 계약과 증거

- 원 측정 소스: HEAD `c810e06d09365687e101d146f9610fc8748385b3`. 매 실행 전후 `src`, harness, helper, probe, Rapier JS/WASM 및 lockfile SHA와 HEAD를 비교했다. 원 실행과 상세 진단 모두 동결 확인.
- 실제 `skill_from_start_probe.mjs` helper prefix를 임시 모듈로 재사용했다. 실제 arm 할당만 `sharedCap→legacy`, 실제 cut 할당만 `budgeted→legacy`; paired grip 및 엔진 클래스·native step은 유지했다. 원 helper와 runtime은 수정하지 않았다.
- 약함은 첫 물리 스텝 전 `level=.4, autoGuard=true`, 없음은 `level=0, autoGuard=false`. 설정 중간 전환 실험이 아니다. 준비 종료 상태는 설정에 따라 달라지므로 준비 후 같은 물리 상태의 분기 비교로 부르지 않는다.
- 원 raw: `/workspace/halfsword-hybrid-evidence/skill-manual-combat-round1.json`, SHA `662800b957fec44d9a9e4fe66a0881ef2fc78b044b5105c22107bda2775cc3aa`.
- 원 측정 도구 보존본: `/workspace/halfsword-hybrid-evidence/skill-manual-combat-round1-tool.mjs`, SHA `871eeafe0b1fc632aa74758ac0d8c4309e84b4952dfc027133fc09b57ed406a7`. 현재 도구에는 별도 진단/라운드 창 옵션이 추가되어 SHA가 다르다.
- 상세 gap raw: `/workspace/halfsword-hybrid-evidence/skill-manual-combat-gap-diagnosis.json`, SHA `852b18d24d999758e2b1fe61c18dc81f05ec3d91ace5fc03299407d2036f13c9`.
- 공유 요약/전체 소스 manifest/각 실행 trace digest: `skill_manual_combat_round1.json`. Raw에는 실제 프레임, 접촉 이벤트, 부상 결과와 상태가 있다. 

원 검증은 primary 14행+관찰 비교 2행, 전투 8행+관찰 1행, 상세 진단 2행+관찰 1행으로 28회 실행했다. 관찰 없는 대조와 native snapshot 전체 trace, controller trace, 외부 입력, reactive AI 입력, wound/tap 요청이 모두 exact였다. 상세 진단 weak/off도 원 전투 trace와 exact였다. 총 wall 123.075초, simulated 296.8초. 유한성은 전체 native body의 위치·회전·선속도·각속도로 검사했다.

## 접촉 없는 primary

sabre/zweihander × down/up/수평 × reinput, zweihander 수평 hold 대조를 선별했다. 동일 외부 raw 입력·시점이며 원 3차와 같은 준비/정지 프로토콜을 사용했다. 오차는 raw offset의 guard direction을 yaw로 변환한 검축 방향 기준이다. 이는 명시적 입력 벤치마크이며 사람의 실제 의도를 완전히 측정한 것은 아니다.

| 무기·입력 | 정지 후 검축 이동 rad 약함→없음 | raw 평균 오차 rad 약함→없음 | raw 최종 오차 rad 약함→없음 |
|---|---:|---:|---:|
| sabre down reinput | 1.234→0.849 | 0.186→0.111 | 0.149→0.063 |
| sabre up reinput | 1.067→0.281 | 0.094→0.024 | 0.046→0.015 |
| sabre horizontal reinput | 3.945→0.379 | 1.314→0.037 | 1.229→0.031 |
| zweihander down reinput | 1.703→1.309 | 0.350→0.227 | 0.245→0.038 |
| zweihander up reinput | 1.588→0.914 | 0.195→0.098 | 0.092→0.065 |
| zweihander horizontal reinput | 2.545→0.770 | 0.735→0.096 | 0.728→0.053 |
| zweihander horizontal hold | 2.602→0.757 | 0.868→0.066 | 0.843→0.020 |

이 조건에서는 단순히 이동이 줄어든 것과 함께 raw 오차도 줄었다. 그러나 zweihander down/up reinput의 최종 검 K는 각각 `0.4074→0.4631J`, `0.0840→0.1172J`로 증가했다. 제동·에너지 문제가 전부 해결됐다고 볼 수 없다.

## 실제 접촉과 reactive AI: 18초 스트레스

실제 `newRound`, 원 normal reactive AI longsword를 사용했다. 시작 간격 1.85m, 벽 없음, 두 fighter legacy arm, legacy cut, paired grip. 플레이어 AI는 없고, 4.4초 주기로 guard→down→release→up→horizontal→hold→reinput을 작성했다. 이동 스틱은 첫 2초 .25 전진, 이후 guard 구간 .08 전진. 실제 `Skill.thrust()` 요청은 물리 시각 2.2/6.6/11/15.4초에 입력 단계에서 실행했다. 생존 게이트를 지켰고 근력·손상·body pose/velocity를 주입하거나 synthetic contact를 호출하지 않았다.

표의 wound는 **실제 onWound 콜백 수**다. severity 0 또는 이미 죽은 피해자의 콜백을 포함할 수 있어 적용된 부상 수와 같지 않다. `playerWounds`는 플레이어가 공격자인 콜백이며 플레이어가 입은 부상 수가 아니다. 실제 부상 판정은 raw의 limbs/blood/state와 함께 읽는다. 전투 오차에는 사망·무장 해제 후 프레임도 포함되어 통제감 개선 점수로 사용하지 않는다.

| 무기·seed | wound 콜백 약함→없음 | clash / fresh 약함→없음 | tap 수락 약함→없음 | 주요 플레이어 결과 |
|---|---:|---:|---:|---|
| sabre 7 | 19→11 | 208/16→189/8 | 4→3 | 약함 stand; 없음 getup 576프레임, armS .299/blood .778 |
| sabre 19 | 28→29 | 166/12→76/10 | 4→2 | 약함 stand; 없음 사망, dead 529프레임 |
| zweihander 7 | 22→21 | 285/13→246/16 | 4→4 | 둘 다 stand; 없음 armO .118/blood .884 |
| zweihander 19 | 12→5 | 37/7→0/0 | 4→4 | 둘 다 플레이어 stand; 없음 적은 .983초부터 dead |

sabre seed7은 weak/off 둘 다 실제 `enterParry` 1회 진입했다. 따라서 level0/autoGuardfalse도 모든 자동화 제거 계약이 아니다. 짧은 무기의 독립적인 자동 parry/내딛기 경로가 남는다. sabre seed19에서는 진입 0회였다. 이 작은 표본으로 parry 전체 회귀 수락을 주장하지 않는다.

## 살아 있는 빈팔의 스트레스 반례

zweihander/seed19/off의 `15.666666666666417s` **동일 프레임**에서 다음이 발생했다.

- 플레이어 빈팔 어깨 `uarmO` native gap **89.053mm**. joint와 양 body 모두 valid.
- 플레이어 빈팔 전완 `farmO` 각속도 **260.4087rad/s**, 선속도 **21.1149m/s**. 검 각속도 최대와 혼동하지 않는다.
- 플레이어 `stand`, alive/armed/gripping=true, grip joint valid, 절단 부품 없음. tap `t=.2666667`, thrustPush=true, finish/plunge=false.
- 상대는 dead, alive=false. 상대 corpse gap을 제외해도 플레이어의 살아 있는 팔 반례는 남는다. 플레이어 gap >20mm는 1프레임이었다.

weak 쪽 최대 body 각속도 49.471rad/s는 10.5417초 적이 놓친 검이었다. 실제 붙어 있고 살아 있는 부품 최대는 9.1167초 적 검 48.511rad/s였다. weak의 플레이어 gap 최대 3.055mm는 16.1583초 shinB이며 위 off 사건과 다른 부품/시각이다.

**정상 공개 라운드의 같은 상황 재현으로 확대하지 않는다.** 측정 시 main의 `checkRoundEnd`는 적/플레이어 사망을 감지한 다음 rAF부터 unscaled real dt를 누적하고 >3.5초에서 pause/input disable한다. roundOver 뒤 물리는 최대 .5배, 결정타 slowMo는 .25배다. 적이 .983초에 죽은 실행을 18 물리초까지 계속 입력한 것은 정상 라운드 종료 이후의 스트레스다. 15.4초 tap과 15.667초 gap은 빈팔/armIK/tap coupling 연구 반례로 보존한다.

## 후속 재현·체크포인트 인계

동결 당시 core/harness/helper SHA가 같은 환경에서 다음 명령은 weak/off zweihander19와 off 관찰 대조만 재실행한다. 새 output path가 필요하다.

```sh
node tools/sim/experiments/skill_manual_combat_probe.mjs /workspace/halfsword-hybrid-evidence/skill-manual-combat-gap-followup.json --diagnose
```

현재 raw는 전체 native trace의 SHA와 진단 위치를 저장했지만 **복원 가능한 native snapshot 바이트와 JS controller clone은 저장하지 않았다**. 원/상세 진단 deterministic exact 재현이 확인됐으므로 root 소유 새 probe에서 기존 `combatRun`/`G.before` 경로를 그대로 재실행하고 다음 위치를 캡처할 수 있다.

- 첫 큰 gap을 만든 physics loop **index 1879**의 `G.step()` 직전: `G.t≈15.658333333333s`. 입력·AI 갱신도 함께 진단하려면 이 위치부터 분기한다.
- 마지막 tap 이전 체크포인트: index **1848**, `G.t≈15.4s`. 원 함수를 실제 호출하기 전 snapshot/controller/prefix를 기록한다.
- `G.before`는 enemy AI.update 이후, player.step 이전이다. 그 안의 캡처와 전체 `G.step()` 직전 캡처는 다른 계약이므로 구분한다.

`recovery_joint_response_probe.mjs`의 native capture/`RAPIER.World.restoreSnapshot`/body handle 재결합 패턴은 native 한 스텝 연구용이다. controller를 갱신하지 않고 force/torque를 초기화하므로 이 tap 상태의 그대로 복원 분기로 사용할 수 없다. `recovery_reach_load_probe.mjs`의 native/controller/prefix checkpoint exact 검증은 동일 deterministic 재실행 후 개입 패턴으로 재사용 가능하다.

기존 도구에서 일반적인 full JS controller round clone은 확인하지 못했다. `ownState`/`control`은 진단 serializer이며 복원 함수가 아니다. 가장 작은 안전한 대안은 후보마다 동일 입력·seed를 처음부터 재실행하고 개입 직전 native/controller/input-prefix가 exact인지 확인하는 것이다. native restore를 택한다면 양 fighter body/joint/world, colliderInfo/Combat, G.step closure, EventQueue/AI 참조, skill/gait/finish 캐시, RNG, 게임 시각·접촉 cooldown까지 재결합해야 한다.

## 정상 라운드 종료 창 추가 검증

primary를 반복하지 않고 실제 전투 8행+관찰 대조 1행만 실행했다. wall **87.264초**, 물리 누적 **144.092초**. 새 raw `/workspace/halfsword-hybrid-evidence/skill-manual-combat-round-window.json`, SHA `1742d16d83bea750f0dc13d0bc9532c04baa992610b91fb6f66752229b970807`. 소스 전후 동결/유한성/옵션 복원 및 관찰 native/controller/외부 입력/AI/wound/tap 모두 exact. 사망 없는 6행은 원 18초 스트레스의 전체 native/controller/input/AI trace와도 exact였다. 모든 실제 물리 스텝의 프레임을 저장하고 peak의 부품·alive·절단·state·tap/finish 상태를 raw/요약에 보존했다.

main은 `checkRoundEnd(dt)`를 rAF 끝에서 **실시간 dt**로 호출한다. 물리 accumulator만 roundOver 후 .5배이며, 사망 최초 감지 프레임은 roundOverTime을 누적하지 않는다. 본 검증은 120Hz 가상 실시간 프레임에서 이 감지/누적/>3.5초 pause 계약을 구현했다. roundOver 이후는 2개 real frame당 native 1step으로 진행하고 pause에서 입력과 물리를 중단했다. 최대 18 real seconds다.

결정타 slowMo(.25), hitStop(.12), 가변 rAF와 main의 화면 입력 소비는 재현하지 않았다. 따라서 **브라우저 완전동등 실행이 아니라**, 같은 엔진과 물리 시각 입력을 사용한 라운드 종료 창 검증이다. .5를 유지한 종료 이후 물리 진행은 main의 slowMo를 제외한 보수적인 상한이다. 입력/tap script는 계속 physics clock에 묶여 있어 실제 실시간 손가락 입력과도 구분한다.

| 무기·seed·설정 | 종료 physics s | 사망 감지→pause real s | wound / clash(fresh) / tap | player/enemy gap 최대 mm | body 각속도 peak rad/s·부품·physics 시각 |
|---|---:|---:|---:|---:|---|
| sabre 7 weak | 18 | 사망 없음 | 19 / 208(16) / 4 | 2.290 / 5.069 | 89.683 · 적 farmS · 11.9583 |
| sabre 7 off | 18 | 사망 없음 | 11 / 189(8) / 3 | 2.503 / 2.966 | 71.844 · 적 sword · 14.4 |
| sabre 19 weak | 18 | 사망 없음 | 28 / 166(12) / 4 | 2.573 / 3.026 | 132.926 · 플레이어 sword · 15.25 |
| sabre 19 off | 15.35 | 13.6→17.1083 | 29 / 76(10) / 2 | 1.927 / 2.112 | 109.662 · 플레이어 sword · 3.1417(getup) |
| zweihander 7 weak | 18 | 사망 없음 | 22 / 285(13) / 4 | 2.472 / 2.932 | 74.931 · 적 sword · 16.225 |
| zweihander 7 off | 18 | 사망 없음 | 21 / 246(16) / 4 | 2.798 / 2.810 | 103.729 · 적 sword · .3583 |
| zweihander 19 weak | 18 | 사망 없음 | 12 / 37(7) / 4 | 3.055 / 4.552 | 49.471 · 적 **놓친** sword · 10.5417 |
| zweihander 19 off | 2.7417 | .9917→4.5 | 2 / 0(0) / 1 | 3.094 / 2.362 | 26.892 · 플레이어 sword · 2.4333 |

위 peak는 놓친 검 한 항목을 제외하고 alive/attached 상태였다. weak zwei19의 살아 있는 붙은 body peak는 적 검 48.511rad/s(9.1167s)이다. gap peak와 omega peak는 서로 다른 시각·부품일 수 있으므로 표에서 합친 하나의 사건으로 판단하지 않는다. 각 peak 상태는 JSON `roundWindow.rows[].diagnostics`와 `diagnosticPeakFrames`에서 확인한다.

zweihander19/off의 창 내 player gap peak **3.094mm**는 2.35s `uarmO`, stand/alive/armed=true, gripping=false, gripJoint valid, 절단 없음, tap t=.15/thrustPush=true, finish/plunge=false였다. 상대는 dead였다. 89mm/260rad/s 스트레스 사건은 창 안에 발생하지 않았고, 15.4초 tap도 요청되지 않았다. 사망 콜백은 기존 physics .9833초이며, physics step 종료 후 `alive=false` 감지 시각은 .9917초다.

sabre7 weak/off의 짧은 무기 enterParry 진입 각 1회는 그대로 남았다. sabre19/off 사망·getup/부상 차이도 남아 실제 전투 개선을 단정할 근거는 아니다. 이 2seed 표본은 큰 gap 반례의 **정상 라운드 범위 정정**과 실제 접촉 경로 검증이며 전투/UX 전체 수락은 아니다.

```sh
node tools/sim/experiments/skill_manual_combat_probe.mjs /workspace/halfsword-hybrid-evidence/skill-manual-combat-round-window-followup.json --round-window
```

## 적용 판정

입력 추종 결과는 `level0 + autoGuardfalse`를 **첫 스텝 전** 선택하는 연구 계약을 지지한다. touch 감도/좌표 보정은 authored pose steering과 별개다. 자동 보정을 반드시 유지해야 한다는 전제는 없다. 다만 이 결과만으로 공개 기본값, 전투 승률, 부상 감소, 완전 제동 또는 모든 자동화 제거를 추천하지 않는다. 정상 라운드 창에서는 큰 gap 스트레스 반례가 제외됐지만, 실제 부상 경로와 빈팔/tap 결합 진단을 함께 판단해야 한다.
