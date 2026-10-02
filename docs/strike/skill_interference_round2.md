# 검술 보정 제거·분리 2차

2026-10-02. **자동 복귀만 끄면 release 뒤 강제로 자세를 바꾸는 이동은 줄었지만, 그 자체가 모든 방향의 원래 입력 정확도를 개선하지는 않았다. follow만 제거한 후보도 내려/올려베기 종료 이동이 늘었다. 보정을 보존해야 한다는 요구는 두지 않으며, 다음 선택형 후보는 기존 level0의 입력 목표를 라운드 생성부터 쓰는 것으로 좁힌다.** 아직 일반 기본값·core·엔진·배포는 바꾸지 않았다.

기준 HEAD `7b72c4e3bc4a50fc56786362de6509c9d2270757`. [도구](../../tools/sim/experiments/skill_interference_round2.mjs), [수치·원자료 SHA](skill_interference_round2.json). 원자료 `/workspace/halfsword-hybrid-evidence/skill-interference-round2.json`은 저장소 밖에 보존한다. 상대 신규 자료는 열지 않았다.

## 실제 실행 범위

zweihander·seed7·actual Fighter/Skill/Gait/Combat/Rapier·sharedCap·paired grip·budgeted cut을 고정했다. **5후보 × 내려/올려/수평 × hold/release =30행**, 관찰 없는 대조3행이다. 수평 입력은 기존 `cross`의 사선이 아니라 `[-.42,.03]→[.42,.03]`로 y가 고정된다. 수직은 `[.02,.52]↔[.02,-.45]`. drag .55초 뒤1.5초를 관찰했다. 상대를 멀리 옮겨 접촉0이며 실제 충돌/상처/휴대폰 장면은 아니다.

후보는 weak(level .4), noAuto(weak+autoGuard false), noFollow(weak+followGain0), both, off(level0)다. 각 방향은 기존 .7/autoGuard true/기존 follow/legacy grip로3초 준비하고 **동일 native·controller 상태에서** 후보를 적용했다. 모든 시작 follow는0이었다. 설정을 처음부터 달리한 게임 시작과 다르며, 특히 off의 시작 과도응답을 일반 조작감으로 단정하지 않는다.

6개의 방향/종료 묶음에서 시작 native/controller와 **외부 입력 경로+handHeld/inputActive 종료 플래그까지** exact였다. 모든 강체는 finite, 관찰 유무3쌍의 전체 native-body/control trace exact, src 전체/엔진/probe의 hash와 HEAD 전후 일치였다. followGain/grip/Math.random은 각 행 뒤 복구했고 다음 준비도 기존값이다. 벽시계9.82초, 준비와 대조를 포함한 시뮬레이션166.65초. 반복 대조는 독립 플레이 표본이 아니다.

## 움직임과 원래 입력 오차를 함께 판정

`ownAimError`는 **후보가 현재 만들어 낸 목표**에 대한 오차다. 자동 복귀가 목표를 옮기면 이 오차만 작아질 수 있으므로 별도 기준을 둔다. `originalRawAimError`는 기존 Fighter.guardDir의 **보정 없는 매핑**을 외부 요청 손 위치에 적용하고, 입력 종료 뒤에도 원래 마지막 위치를 유지하여 실제 검 축과 비교한다. 이 기준은 명시적인 원래 raw 매핑이며 인간이 의도한 각도를 증명하는 것은 아니다. 현재 body yaw와 시작시점 world yaw 두 기준을 모두 보존했고 아래 결론은 두 기준에서 같았다.

표의 각 칸은 **종료 뒤 누적 검 축 이동 rad / 원래 raw 목표의 평균 각오차 rad**다. 이동량은 stop distance·끝 방향 오차·인체 자연스러움 점수가 아니다.

| 방향·종료 | 약 기준 | 자동복귀 off | follow0 | 둘 다 | 보정 off |
|---|---:|---:|---:|---:|---:|
| 내려 hold | .719/.070 | .719/.070 | .913/.089 | .913/.089 | .387/.042 |
| 내려 release | 1.535/.514 | .719/.070 | 1.684/.540 | .913/.089 | .387/.042 |
| 올려 hold | 1.311/.224 | 1.311/.224 | 1.516/.226 | 1.516/.226 | 1.091/.123 |
| 올려 release | 3.706/.899 | 1.311/.224 | 3.835/.901 | 1.516/.226 | 1.091/.123 |
| 수평 hold | 2.745/.874 | 2.745/.874 | 2.609/.825 | 2.609/.825 | 1.030/.091 |
| 수평 release | 4.933/.834 | 2.745/.874 | 4.507/.757 | 2.609/.825 | 1.030/.091 |

- autoGuard off는 세 release의 이동량을 줄이고 내려/올려의 raw 오차도 줄였다. **수평에서는 이동4.933→2.745rad로 줄면서 raw 평균오차 .834→.874rad, 끝 오차 .606→.842rad로 악화했다.** 자동 복귀 제거를 정확도 전체 해결로 채택할 수 없다.
- follow0는 수평에서 일부 줄었지만 내려/올려 hold 이동이 .719→.913/1.311→1.516rad로 늘고 raw 평균오차도 후퇴했다. follow가 목표 반전을 만드는 기존 관찰은 유효하지만, 제거만으로 실제 전신 응답까지 개선된다는 가설은 기각한다. follow0의 내려/올려 손 목표 최대오차가 작아진 것을 전체 개선으로 바꾸지 않는다.
- off는 이번6조건에서 raw 평균오차와 종료 축 이동이 가장 작았다. 다만 own 목표의 최종 up 오차는 약 .045→off .074rad로 커졌다. 서로 다른 목표의 own 오차와 원래 raw 기준의 오차를 혼동하지 않는다. off의 raw 최종 up 오차는 .127rad로 약 .175rad보다 작았다.
- **보정 off가 항상 최대속도까지 낮추는 것은 아니다.** 수평 hold의 검 omega peak는 약19.78rad/s(.925초) 대비 off32.80rad/s(.075초)다. off peak는 drag 초반의 같은-state level전환 뒤 발생했으므로, 생성부터 off인 라운드의 안전/조작감 관문이 필요하다. 축 이동은 비틀림을 제외하지만 omega는 포함하므로 이 값만으로 축 회전 폭주를 선언하지 않는다.

noAuto/both/off의 hold와 release는 `handHeld`를 제외한 **기록된 per-step 축·목표·손 위치·오차·bodyPose 필드가 exact**였다. 전체 control hash에는 의도적으로 다른 handHeld가 들어가므로 전체 trace hash는 다르다. 종료 조건 사이의 native snapshot/속도 전체 exact를 별도로 검증했다고 주장하지 않는다.

## 다음 선택형 구현의 계약

이번 결과는 보정의 유지가 개발 목표일 필요가 없다는 사용자 방향과 양립한다. 첫 후보는 **`targetCorrection=none`을 라운드 시작부터 적용**하는 계약이 적절하다. 이 명칭은 모든 자동 게임 행동을 끈다는 약속이 아니라 **자동 authored 손/검/몸 목표의 혼합을 사용하지 않는다는 범위**다.

1. 플레이어 첫 물리 step 전에 `skill.level=0`, `skill.autoGuard=false`를 설정한다. 현재 식으로 guardWeight0, follow cap0, 일반 skill lunge 배율0, 자동 homeGuard 복귀 없음이 된다. 보정 변경을 라운드 중간에 즉시 재적용하기보다 새 라운드에서 선택한다. 이번 .7→0 순간 전환의32.8rad/s peak를 생성부터 off인 후보의 결과로 숨기지 않는다.
2. 상대 AI의 level/autoGuard와 전역 SKILL.followGain을 바꾸지 않는다. 약·보통·기존 보정은 명시적 비교 선택으로 유지할 수 있으나 정답이나 필수 기반으로 간주하지 않는다.
3. 터치 감도/좌표 변환, 기존2cm anchor dead radius, 입력 목표 필터는 **입력을 해석하는 계약**으로 구분한다. 보정 제거를 ergonomic calibration 제거와 묶지 않는다. 입력 명령인 탭 찌르기도 별도이며 현재 level0에서도 동작하는 기존 경로다.
4. cap·근력·질량·native 모터·cutBudget은 그대로 두고 생성부터 none인 내려/올려/수평·hold/release를 먼저 재검사한다. 재입력·짧은 무기·실제 충돌/부상·브라우저 모바일 관문 뒤에 일반 기본값 승격을 판단한다.

현재 `Skill.enterParry`는 짧은 한손 무기에서 level과 무관하게 `gait.requestStep`를 호출한다(`src/skill.js:499`, 호출부555). 따라서 **level0를 ‘모든 보조 동작 off’로 안내하면 틀린다.** 완전 수동 이동 옵션까지 요구되면 자동 받아내기 내딛기의 별도 명시적 계약과 실제 충돌 검증이 필요하다. 이 실험은 해당 단계를 측정하지 않았다.

core/runtime·공용 도구·엔진·HEAD·빌드·배포는 바꾸지 않았다. 본 결과를 기립/전신 전달/충돌 해결이나 사람의 체감 수락으로 판정하지 않는다.

```sh
node tools/sim/experiments/skill_interference_round2.mjs /workspace/halfsword-hybrid-evidence/skill-interference-round2-new.json
```
