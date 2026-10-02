# Reachable held endpoint — round 2

단계 완료. **후보 기각, 사람용 모바일 비교판 승격 보류.** 실제 관절 길이로 IK 모델의 약 5 mm 불일치는 바로잡았지만, held 입력의 도달 불가능한 원래 목표를 해결하지 못했다. 올려베기에서는 원래 목표에 대한 손 오차와 어깨의 명시적 일이 증가했다. 두 번째 후보나 조건 확장은 하지 않았다. 공개 게임 코드·엔진·기존 실험 파일을 수정하거나 커밋하지 않았다.

## 후보와 원인 분리

이전 `held_follow_endpoint_round1`의 held latch를 그대로 재사용하고, 활성 latch 동안만 실제 native shoulder/elbow/grip anchor 길이와 elbow 한계를 IK에 적용했다. 새 입력과 release에는 기존 경로로 돌아간다. 몸 위치·속도, 힘·gain, native joint 설정은 바꾸지 않는다.

실제 주팔 upper 길이는 0.300000012 m, elbow→grip 길이는 0.265000001 m이다. 기존 IK는 0.30/0.27 m를 사용한다. 실제 외측 반경은 0.565000013 m, elbow 최대각 2.5 rad에서 내측 반경은 0.181226839 m이다. 기존 `ARM.slack = 0.005`를 재사용한 요청 shell은 0.186226839–0.560000013 m이다. 반대팔 길이 0.300000012/0.275000001 m와 실제 grip 위치도 기록했다. 이 반경 검사는 shoulder 각도·두 손 grip의 모든 제약을 만족한다는 증명이 아니다.

기존 `armIK`가 이미 거리를 clamp하므로 단순 목표 투영과 실제 길이 보정을 따로 비교했다.

| 모드 | 개입 및 비교 대상 |
| --- | --- |
| original / observe / clone | 실제 원본, 관찰, 복제 동일성 검사 |
| held | 이전 endpoint latch만 적용하는 기준 |
| projectionOnly | 기존 IK 계산은 유지하고 이미 clamp한 목표만 보고값으로 기록 |
| lengthOnly | native 길이·shell을 IK에 적용, 원래 보고 목표 유지 |
| nativeReach | lengthOnly와 같은 IK + 적용 목표를 명시적으로 기록하는 후보 |
| capHeld / budgetHeld / budgetNative | 기존 명시적 shoulder/wrist cap 기준 및 같은 수치 cap의 기준·후보 replay |

`projectionOnly`는 `held`와 전체 native/physical control trace가 정확히 같았다. `nativeReach`도 `lengthOnly`와 정확히 같았다. 따라서 목표 표시를 clamp한 효과는 물리 개선이 없고, 궤적 변화는 native 길이와 shell을 사용하는 IK에서 발생했다. 보고 목표 오차가 줄어든 부분을 입력 의도 추종 개선으로 세지 않는다.

## 실행과 검증

HEAD `e5d2f081de320e42634526e27a68804baf754993`에서 실제 `G.step` 및 skill dispatch를 사용했다. longsword down/up 두 입력, seed 7, 준비 3 s, drag 0.55 s, hold 1.2 s에 위 10모드를 실행해 **최종 20행**을 얻었다. 조건별 210회 dispatch, latch 첫 호출 67, 활성 held 144회다. 반복 표본·다른 무기·사람 pointer jitter의 검증으로 해석하지 않는다.

원본 대비 observe/clone의 전체 native 및 physical control trace, 시작 native/controller 상태, 입력 sequence가 정확히 같다. 후보는 전체 stroke 및 첫 latch 전 상태가 기준과 같다. 실제 native IK가 처음 바뀌기 직전 상태도 같다. 모든 행은 finite/stand 검사를 통과했고 실행 전후 source manifest가 같았다.

strict replay는 매 step의 **명시적 shoulder와 wrist 최종 벡터 cap 수치**를 같은 것으로 제한한다. 기준 replay는 `capHeld`와 전체 trace가 같고, 후보도 같은 수치 cap과 1e−9 Nm 허용오차 검사를 통과했다. native elbow, elbowGravity, offHand와 solver/contact 전체 예산까지 동일하다는 뜻은 아니다.

실제 game-step lifecycle fixture에서 latch → 실제 offset 0.03 m 변경(`inputActive=false` 포함) → rearm → relatch → release를 검사했다. release의 기존 follow decay와 inactive IK 목표가 정확히 복원되며 inactive 목표 동일성 68회를 확인했다. 이는 scripted 새 입력 검증이며 사람의 jitter 의도를 판정한 결과는 아니다. 별도 9개 native-anchor geometry fixture는 body 상태를 쓰지 않고 길이별 forward kinematics를 검증했다. 기존 IK는 약 5 mm 오차, native IK 최대 오차는 4.58e−16 m였다. 실제 실행에서 pre-physics IK와 같은 시점의 chest로 측정한 native FK 오차는 최대 0.162 µm였다.

## 물리 결과

아래는 **이전 held latch 기준 → 이번 nativeReach**다. 원본 대비 변화에 이전 latch 효과를 섞지 않았다. 손 오차는 clamp 전 원래 입력 목표에 대한 hold 구간 최대값, axis travel은 입력 종료 뒤 구간의 칼날 방향축 누적 이동량이고, 운동에너지는 종료 값이다.

| 조건/예산 | 원래 손 목표 오차 (m) | 입력 종료 뒤 axis 누적 이동량 (rad) | 종료 sword K (J) | hold 최대 grip gap (m) | 종료 실제 blade aim error (rad) |
| --- | --- | --- | --- | --- | --- |
| down, 기존 | 0.286635 → 0.286598 | 0.248672 → 0.247328 | 0.00003525 → 0.00003554 | 0.001354 → 0.001380 | .0101959 → .0102087 |
| down, 같은 수치 cap | 0.291740 → 0.291825 | 0.250008 → 0.251354 | 0.00003605 → 0.00003602 | 0.001333 → 0.001413 | .0102072 → .0102188 |
| up, 기존 | 0.489492 → 0.491615 | 1.353477 → 1.316716 | 0.00281310 → 0.00257668 | 0.000954 → 0.001282 | .0565892 → .0610954 |
| up, 같은 수치 cap | 0.498492 → 0.500681 | 1.330353 → 1.303655 | 0.00310494 → 0.00324378 | 0.000887 → 0.001063 | .0563620 → .0625359 |

down 원래 목표는 기준과 후보 모두 **144개 held frame 중 141개에서 실제 팔 외측 반경 밖**, 144개에서 slack shell 밖이다. 적용 목표는 후보의 shell 안으로 들어갔지만 입력 목표를 만족한 것은 아니다. up의 실제 외측 반경 밖 횟수는 기존 예산에서 4→0, 같은 cap에서 0→0이며, 원래 손 오차는 각각 **2.123 mm / 2.190 mm 증가**했다. 입력 종료 뒤 axis 누적 이동량 감소만으로 채택하지 않는다. 실제 종료 방향 오차는 네 비교 모두 늘었다.

다음은 hold 구간 각 명시적 경로의 signed midpoint work다. 반작용 body를 포함한다. sword gravity work는 실제 COM 높이 변화의 위치에너지 차로 계산했다. native solver/contact의 총 일 또는 총 actuator 효율은 아니다.

| 조건/예산 | shoulder (J) | wrist (J) | elbow (J) | offHand (J) | sword gravity (J) |
| --- | --- | --- | --- | --- | --- | --- |
| down, 기존 | 4.470 → 3.788 | 0.030 → −0.241 | 1.468 → 1.461 | −1.261 → −1.435 | −1.945 → −1.952 |
| down, 같은 수치 cap | 4.792 → 4.300 | 0.119 → −0.313 | 1.341 → 1.323 | −1.855 → −2.072 | −1.958 → −1.965 |
| up, 기존 | 36.940 → 39.603 | −13.245 → −12.765 | 0.842 → 0.872 | −11.891 → −12.137 | −6.542 → −6.605 |
| up, 같은 수치 cap | 37.719 → 39.637 | −12.399 → −12.897 | 0.763 → 0.781 | −11.136 → −10.674 | −6.723 → −6.787 |

실제 sword 질량은 1.600000024 kg, local COM은 y=0.240081474 m, principal inertia는 (0.180193156, 0.001013680, 0.180193156) kg·m²이며 principal frame은 identity다. 실제 torque requests·cap·target/actual angular velocity·ending motion은 원자료와 metrics에 남겼다. 전체 구간 grip gap 최대는 0.001510112 m다.

## 증거와 남은 범위

- 구현: `tools/sim/experiments/reachable_held_endpoint_candidate.mjs`
- 실행기: `tools/sim/experiments/reachable_held_endpoint_probe.mjs`
- 수치·source manifest·guards: `docs/strike/reachable_held_endpoint_round2_metrics.json`
- 최종 원자료: `/workspace/halfsword-hybrid-evidence/q04-reachable-held-r2-final.json`, SHA256 `47fe8f0c0aa633bd7f3c7d76a8ad515908c36239a86ab760ccd428638965a7b9`, 최종 실행 13.073 s.
- 재실행: `node tools/sim/experiments/reachable_held_endpoint_probe.mjs /workspace/halfsword-hybrid-evidence/q04-reachable-held-r2-rerun.json` (기존 원자료를 덮어쓰지 않는다).

첫 cheap 실행은 FK를 post-step chest와 비교한 observer timing 문제가 있어 최종 실행으로 대체했다. 물리 후보를 추가하거나 tuning한 것은 아니다. 변하지 않은 기존 observation/explicit budget 계약은 source SHA256 동일성으로 재사용했다. off-grip 반경 진단은 post-step chest의 근사 진단이며 모든 양팔 관절 제약의 증명이 아니다. 새 입력/release 직후 경로 복원 fixture는 통과했지만 extended gameplay의 전환감과 인간 조작은 미검증이다.

최소 다음 구현 대상은 **follow extension 자체에서 원래 입력과 물리 팔/grip 범위를 연결하는 endpoint 매핑**이다. 원래 목표와 남은 의도 오차를 유지해 기록하고, 비선형 매핑의 첫 개입·입력 재개·release를 먼저 입증해야 한다. native 길이 보정은 별도의 모델 일치성 발견으로 남긴다. 또 다른 구면 clamp나 gain 변경을 해결책으로 취급하지 않는다.

이 보고서의 측정은 종료되었고 source/engine/HEAD 동결 요구를 해제한다. 생산 반영·모바일 배포는 없다. 새 네 파일의 소유권을 integration 담당자에게 반환한다.
