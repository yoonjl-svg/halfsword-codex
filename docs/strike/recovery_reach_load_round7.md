# 회복 발 목표와 지지 이전의 원인 분리 — 7차

2026-10-02. [48시간 계획 Q01](../codex_team/ACTIVE_PLAN.md)의 첫 선별 실험이다. **발 목표를 바꿔 부상 조건의 재넘어짐 횟수를 줄였지만, 첫 재넘어짐은 더 빨라졌다. 두 후보 모두 일반 적용하지 않는다.** 첫 stand 이후의 변경이며, 누움에서 처음 몸을 일으키는 getup 단계를 고친 결과가 아니다.

## 같은 상태에서 실제 개입

기준 `48c9c2b`의 게임 소스는 `79ce820`과 같다. [도구](../../tools/sim/experiments/recovery_reach_load_probe.mjs)는 실제 same-lying runner를 사용한다. 실제 heavy down으로 만든 건강/앞다리 controller health .45, longsword/paired/B(.1/on/1), seed7, 25초다. 상처를 실제 타격으로 입힌 조건이나 인간 부상 표본이 아니다.

두 조건 × baseline/clone/observedPlant/unsupportedReach = 8행, 90.47초. original의 과거 reference, low checkpoint, 첫 개입 전 native/controller/prefix, 실제 clone 메서드 실행, clone 전체 trace, 소스·HEAD 동결 관문을 통과했다. 게임 소스·엔진은 수정하지 않았다. [원자료 해시·guard·설정·요약](recovery_reach_load_round7_metrics.json)을 보존했다.

- `observedPlant`: 첫 회복 Gait.enter가 기존 설정을 마친 뒤, 두 plant를 실제 발목 3D 위치로 바꾸고 pin 참조도 현재 발의 기하에 맞춘다. 각 조건 2발에 적용했다. setter 전후 native/body 상태는 같다. **plant와 pin 참조를 함께 바꾼 후보**이므로 둘의 영향을 따로 입증했다고 하지 않는다.
- `unsupportedReach`: 첫 stand의 42스텝 동안 실제 지지가 없는 stance 발의 최종 IK 요청만 바꾼다. 목표 Y는 유지하고 XZ를 기존 IK의 도달 가능한 원판 안으로 이동한다. 기존 A=.43/B=.42, kneeMin을 사용하며 새 다리 길이/강도는 넣지 않는다. 수직 거리부터 도달 불가능하면 개입하지 않는다. swingPull/des/rel은 기존대로다.
- unsupportedReach의 건강 조건은 개입 0회·전체 trace exact인 **미개입 대조**다. 부상 조건은 5.616667초부터 2회 실제 개입했고 첫 개입 전 상태가 baseline과 같다.

몸 위치·속도를 순간 변경하지 않았고, 상태 전환 시각을 늦추는 조건이나 upright gain은 추가하지 않았다. 원래 관절의 기본 k/d·cap·gain 법칙을 유지했다. 다만 목표와 응답이 달라지면 기존 오차 기반 토크 제한이 effective configured k를 다르게 만들 수 있다. 요청 계수를 실제 전달 토크라고 하지 않는다.

## 결과

아래 극값과 slip은 **첫 stand 이후부터 25초 종료까지**, 재넘어짐/getup/다시 서는 구간을 포함한다. slip은 확인된 발 지지 solver point의 수평 상대속도이며 발 COM 속도가 아니다.

| 조건 / 후보 | 재넘어짐 | 첫 재넘어짐 s | 최고 K J | 최대 관절 gap mm | slip 평균 / P95 / 최대 m/s |
|---|---:|---:|---:|---:|---:|
| 건강 baseline | 0 | — | 84.117 | 2.450 | .00500 / .00251 / 3.591 |
| 건강 observedPlant | 0 | — | 92.383 | 2.553 | .00569 / .00216 / 4.085 |
| 건강 unsupportedReach | 0 | — | 84.117 | 2.450 | baseline exact·미개입 |
| 손상 baseline | 3 | 6.216667 | 291.668 | 3.434 | .05302 / .23962 / 7.942 |
| 손상 observedPlant | 2 | 6.208333 | 277.154 | 3.406 | .03475 / .06778 / 9.258 |
| 손상 unsupportedReach | 1 | 6.033333 | 210.187 | 4.051 | .01969 / .02460 / 6.378 |

첫 stand는 건강 4.216667초, 손상 5.575초로 같다. 도달 불가능한 최종 IK 요청은 첫 42스텝에서 건강 46→37(observedPlant), 손상 9→7(unsupportedReach)로 줄었지만 사라지지 않았다. 이 카운트는 IK 호출 수이며 독립 실패/인간 표본 수가 아니다. 내부 IK clamp의 최대 길이는 .849320m다. flat plant 원래 위치, heel/toe 및 가상 hip 높이 보정 이후의 입력, clamp 이후 길이를 구별한다.

unsupportedReach의 손상 조건은 평균 slip·최고 K·재넘어짐 수를 줄였지만 첫 실패가 약 .183초 빨라졌고 gap이 커졌다. observedPlant는 건강 조건의 K·gap·최대 slip이 증가했다. 평균 slip은 다시 일어나거나 안정된 구간의 점유시간이 달라진 영향도 포함한다. 총횟수/평균 하나로 인간다운 회복이나 자연스러운 주저앉음을 수락하지 않는다.

## 지지 측정과 다음 구현

관찰 첫 .008333초부터 매 physics step의 발/정강이/빈손 전완 지원을 기록했다. `handO`는 farmO collider proxy이며 독립 손바닥/손가락 강체가 아니다. shin은 전체 정강이 collider이지 무릎 힘판이 아니다. raw normal impulse를 upward로 투영했으며 6/7 등의 정적 교정을 인체에 적용하지 않았다. 이 group 밖 몸통·검 등의 접촉까지 모두 없다고 해석하지 않는다.

현재 `Fighter.applyPose`의 kneel 경로는 다리·척추 목표를 바꾸지만, 빈손 팔 목표는 kn과 무관하게 앞으로 드는 각도를 사용한다. `driveBalance`의 kneel load 최소 .6은 손·무릎의 실제 지지를 확인한 값이 아니다. 따라서 다음 Q02는 **getup 중 실제 지원이 언제 생기고 사라지는지부터 확인해, 다른 접촉이 하중을 넘겨받을 때 발을 재배치하는 작은 후보**다. 이 코드 관찰만으로 전완이 한 번도 땅에 닿지 않는다고 단정하지 않는다.

실제 phase 집계에서는 빈손 전완 지지가 존재했다. 첫 getup 동안 건강 조건은 .241667초·상향 raw 충격량 14.3744Ns, 손상 조건은 .183333초·5.57887Ns였다. 마지막 전완 지지는 각각 2.533333/3.108333초로 첫 stand보다 1.683333/2.466667초 앞섰다. 정강이 지지는 각각 stand .883333/1.016667초 전에 끝났다. 이 접촉 대리체를 독립 손바닥/무릎 관절로 해석하지 않는다.

두 조건의 첫 getup 241/332스텝 전체에서 측정한 다섯 group 중 적어도 하나의 지지가 있었다. 따라서 **전완 지지가 전혀 없다거나, 전완이 먼저 떨어진 순간 전체 지지가 끊겼다는 가설은 이 자료로 지지되지 않는다.** 접촉 존재는 충분한 체중 분담을 입증하지 않는다. Q02는 현재 접촉 아래 COM·발 배치와 실제 하중 분담, stand/Gait 인계 뒤 첫 지지 손실을 함께 다룬다. 첫 손상 stand 5.575초 뒤 앞발 지지는 5.608333초, 모든 측정 group 지지는 6.216667초에 처음 사라졌다. 이는 해당 trace의 순서이며 인과관계의 확정이 아니다.

독립 감사는 현재 manifest 일치·clone 동등·실제 요청 변경·미개입 조건을 원자료에서 확인했다. 이번 결과는 채택 가능한 회복 해결책이 아닌, 다음 하중 이전 구현을 좁히는 원인 자료다. 기존 공개 support 연구판 철회, 일반 legacy 지지는 유지한다.

```sh
node tools/sim/experiments/recovery_reach_load_probe.mjs --out=/tmp/recovery-reach-load-new.json
```

기존 원자료를 덮어쓰지 않는다. 원자료는 `/workspace/halfsword-hybrid-evidence/recovery-reach-load-r1.json`에 있으며 외부 백업이 확인된 것은 아니다.
