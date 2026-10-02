# Q04 입력 보존·어깨 목표 각속도 1차

2026-10-02. **비틀기 목표속도를 보존하는 후보 한 가지를 구현·실행했지만 채택하지 않는다.** 첫 두 조건의 16행에서 복제·관찰·입력·개입 전 native/controller·실제 dispatch·소스 동결 관문을 통과했다. 내려베기 손 오차의 작은 개선은 동일한 수치 토크 한도에서는 사라졌고 횡베기의 오차/입력 종료 회전량 후퇴도 남았다. up·가벼운/무거운 검·다른 종료 조합 확장은 이 선별 결과로 정당화되지 않아 실행하지 않았다. Q04 전체와 P-01~P-06 완료가 아니다.

기준 HEAD `86a9fa06e64bd216f8952b4f3f2ef6754f18a6f1`. 정확한 Fighter·엔진·공용 도구·후보 SHA, 물성, 입력과 실행별 요약은 [metrics](body_input_transfer_round1_metrics.json)에 있다. 게임 core·엔진·기존 도구·기본 제어는 변경하지 않았다.

## 후보와 실제 제어 경로

`driveSword`는 heading yaw로 월드 손/검 방향을 만들고, `armIK`는 실제 가슴 회전의 역변환으로 어깨 상대 목표를 계산한다. 가슴이 돌 때 이 상대 목표의 반대 회전은 기존 월드 입력 목표를 유지하는 역할을 한다. `manualMuscle`의 swing 감쇠는 이미 상대 목표 quaternion 차분에서 얻은 `wT`를 따르지만, twist 감쇠는 상대 회전 `wTw`를 0으로 보낸다. 두 축의 목표속도 처리 차이를 분리했다.

기존 `eTw*25 − wTw*.8`을 후보 `eTw*25 − (wTw − wT·boneAxis)*.8`로 바꿨다. 이는 목표를 따라 회전하는 위팔 비틀기에도 목표속도 감쇠를 쓰는 한 줄 수정이다. 이전 full/yaw 가슴 목표 추종, 손/검 목표 운반, gain 검색, 자동 복귀 삭제는 포함하지 않는다. [격리 후보](../../tools/sim/experiments/body_input_transfer_candidate.mjs)는 임시 모듈에만 변환한다.

세 가지 실제 native 강체 fixture에서 목표 twist 속도 0/+2/−2rad/s를 만들었다. 목표가 +2이고 실제 상대 속도도 +2인 경우 후보 토크 변화는 기존 대비 뼈축 +1.6Nm이며, 0에서는 기존과 같다. −2에서는 −1.6Nm다. 이 fixture는 설정한 자세/속도에서 식을 확인한 것이며 게임 동작 성공이나 사람의 실측이 아니다. 비계측 후보가 원문에서 정확히 이 식만 바꾸는 검사도 통과했다.

## 같은 입력과 같은 수치 한도를 구별

실제 `runStroke`/`G.step`/Rapier/Fighter를 썼다. 롱소드 down/release와 cross/target_hold, seed7, legacy 준비 3초 뒤 모든 측정에서 paired 그립·legacy 지지·세계 중력 −9.81, drag .55초와 종료 관찰 1.2초다. **release에도 원래 자동 중앙 복귀·자세 회복이 남는다.** 충돌/상처/결투/폰 검사는 없다.

각 조건에 baseline(계측 없음), observe, 원문 clone, 후보, 기존 sharedCap 기준/후보, 같은 수치 한도 기준/후보의 8행을 실행했다. observe/clone은 기존 physical/control trace·매 스텝 native snapshot trace·실제 controller trace가 baseline과 exact였고, observe/clone의 계측된 동적 강체 trace도 exact였다. 후보/clone의 `manualMuscle` 실제 dispatch는 각 210회다. 후보 전 준비 native/controller와 요청 입력, 첫 손/검 방향 목표는 같았다. 후보 이후 실제 가슴 위치·skill 되먹임이 달라질 수 있으므로 전체 동적 궤적의 월드 목표가 같다고 주장하지 않는다.

sharedCap 기준/후보는 같은 명목 한도 공식이지만 Hill 감쇠와 근육 상태에 따라 실제 수치 한도가 달라진다. 추가 budget 대조는 sharedCap 기준의 매 스텝 **어깨 최종 cap과 검 손목 최종 cap** 210쌍을 저장하여 양쪽에 그대로 재생했다. 준비에는 개입하지 않았으며 budget 기준의 전체 기존 physical/control trace가 sharedCap 기준과 exact였다. 두 budget 행의 cap 수치·schedule SHA는 매 스텝 같고, 최종 어깨/손목 토크는 각각 수치 오차 1e−9Nm 안에서 한도 이하였다. native 팔꿈치·별도 elbowGravity·빈손 그립을 포함한 전신 예산은 아니다.

## 결과와 기각 이유

peak는 drag 중 최고 칼끝 속도다. 종료 axis는 blade axis의 누적 이동각이며 순 회전량/정지 거리와 다르다. 끝 K는 종료 관찰 1.2초 뒤 검의 선·회전 운동에너지다. 아래 기준→후보는 같은 행 쌍이다.

| 조건 / 예산 | peak m/s | 최대 손 오차 m | 종료 axis rad | 끝 검 K J |
|---|---:|---:|---:|---:|
| down/release · 기존 | 17.54179→17.58148 | .370929→.369657 | 1.34403→1.34870 | .003806→.003600 |
| cross/hold · 기존 | 14.76883→14.76553 | .299526→.300217 | 1.45079→1.45163 | .002444→.002419 |
| down/release · 같은 수치 cap | 17.52619→17.37018 | .371102→.371910 | 1.34515→1.33875 | .003831→.003693 |
| cross/hold · 같은 수치 cap | 14.66091→14.64977 | .302948→.303762 | 1.38316→1.38685 | .002560→.002501 |

최고속도 감소만으로 기각하지 않았다. 같은 수치 cap의 down은 끝 K·axis 이동량이 줄지만 손 오차가 늘고, cross는 손 오차와 이동량이 모두 늘었다. 기존 예산의 down 오차 개선은 약 1.27mm에 그치며 종료 axis는 늘었다. 전체 입력 보존·제동 개선을 지지하지 않는다. 모든 행 stand 유지·유한값이었고 최대 관절 gap은 .001511m였지만 자연스러움 합격 기준은 아니다.

측정 검 질량은 1.600000024kg, local COM은 (0,.240081474,0)m, principal inertia는 (.180193156,.001013680,.180193156)kg·m², local principal frame은 identity다. 방향에 따른 world COM 초기값은 metrics에 따로 남겼다. 다른 검 비교나 질량만 바꾼 인과 실험으로 해석하지 않는다.

검 COM 중력 일은 실제 pre/post 위치에너지 차다. 어깨·손목·elbowGravity 토크 요청과 명시적 경로의 midpoint 순 일을 원자료에 기록했다. 어깨 down의 drag 순 일은 기존 −31.086→−31.849J, 같은 수치 cap에서는 −32.447→−32.447J다. cross는 기존 −1.799→−1.630J다. 양/음 경로 순 일과 개별 근육 총 양의 일은 다르며, 더 작은 끝 K나 더 음의 순 일로 전달 효율·총 제동 일을 선언하지 않는다. **전체 native 모터/관절/contact 일은 미측정**이다.

## 보존·재현과 다음 가설

[실제 probe](../../tools/sim/experiments/body_input_transfer_probe.mjs), [기구 검증 fixture](../../tools/sim/experiments/body_input_transfer_candidate.test.mjs)를 보존했다. 기존 whole-body의 ledger/harness/runStroke/package-lock SHA가 현재와 exact이므로 변경되지 않은 관찰 계약을 재사용했다. npm Rapier 0.19.3 엔진/wasm SHA는 전후 같았다. Q03의 별도 custom native API 교정을 npm 전체 일 측정의 근거로 전용하지 않았다.

최종 원자료 `/workspace/halfsword-hybrid-evidence/q04-body-input-final.json`, SHA256 `4f48f5c35603c7818d9d7eeb849f939c06779cc8a9e24cc9f7bb2ddaa21d564f`, 물리 배치 벽시계 약 9.99초다. fixture 원자료는 `q04-body-input-fixtures.json`이다. 첫 12행 실행은 마지막 Git child-process의 EPERM으로 JSON 직렬화가 끝나지 않아 log만 남았다. HEAD 파일 읽기로 수정했다. 다음 12행은 계측의 elbow 경로 이름 오타가 있어 해당 경로가 누락됐고, 최종 16행에서 수정했다. 이 앞선 반복 행은 독립 표본에 더하지 않는다. baseline은 계측이 없으므로 그 work 카운터 0은 실제 일 0이 아니다. 일 비교에는 observe를 쓴다.

```sh
node tools/sim/experiments/body_input_transfer_candidate.test.mjs /workspace/halfsword-hybrid-evidence/q04-body-input-fixtures-rerun.json
node tools/sim/experiments/body_input_transfer_probe.mjs --screen=cheap --out=/workspace/halfsword-hybrid-evidence/q04-body-input-rerun.json
```

출력 경로가 이미 있으면 덮어쓰지 않는다. broad `--screen=expanded` 옵션은 구현되어 있으나 이번에는 실행하지 않았다.

다음 가설은 twist gain 확대가 아니라 **release 직후 자동 복귀의 목표속도 반전이 손목/어깨를 얼마나 다시 가속하는지**다. 첫 반전 프레임의 `skill.recovering`, `aimVel`, 실제 handOffset, 어깨 `wT`, 손목 `wAim`과 적용 토크를 관찰하고, 같은 종료 상태의 유지 목표와 정상 복귀를 분리한다. 몸 transform/속도를 순간 변경하거나 native 한도를 늘리지 않고 처음 영향을 주는 제어 항을 확인한 뒤 다음 후보를 결정한다.
