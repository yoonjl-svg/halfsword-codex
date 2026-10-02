# Q02 기립 중 무게중심 이전과 서기 인계 — 8차

2026-10-02. **접촉에 맞춘 무게중심 보정을 기립 중부터 시작하고 서기 인계까지 이어주자, 연구용 projected 지지의 부상 재넘어짐이 줄었다. 현재 일반판의 legacy 지지에서는 부상 조건의 미끄럼·운동에너지 후퇴가 남아 일반 적용하거나 지지 연구판을 재공개하지 않는다.** Q02의 첫 구현·선별·좌우 외란 확장까지 실행했으며 전체 하중 이전과 Q06 완료가 아니다.

기준 HEAD `86a9fa06e64bd216f8952b4f3f2ef6754f18a6f1`. [원자료 SHA·명령·배치별 실행 소스·guard·요약](recovery_com_transfer_round8_metrics.json)을 보존했다. 게임 src·엔진·기본값은 수정하지 않았다. 이전 [7차](recovery_reach_load_round7.md)의 stand 이후 발 목표 수정과 달리, 이번 개입은 **getup 단계의 수평 이동 목표**에서 시작한다.

## 원인과 작은 후보 두 개

기존 getup은 앞으로 무릎을 세운 자세에서 시간에 맞춰 다리를 펴지만, `driveBalance`의 수평 목표는 0이다. 일반 Gait의 무게중심 유지와 무게 옮기기는 이 단계에서 실행되지 않는다. 기존 raw에서 부상 stand 직전 실제 COM은 확인된 발 접촉 영역 밖에 있었다. 발이 닿아 있다는 사실과 몸을 안정적으로 받을 수 있다는 사실은 다르다.

[격리 helper](../../tools/sim/experiments/recovery_com_transfer_candidate.mjs)는 실제 발·정강이·빈손 전완의 fresh support manifold 중 양의 raw normal impulse가 있는 지점만 수평 convex hull로 모은다. 실제 동적 신체·검·부속물의 질량/COM으로 계산한 무게중심에서 그 영역의 가장 가까운 점으로 향하는 목표속도를 만든다. 기존 `GAIT.holdGain=1.5/s`와 보정 성분 한도 `.3m/s`를 사용한다. 이 한도는 전체 속도/힘의 한도가 아니며 뒤의 기존 근육·가속·힘 clamp가 그대로 작동한다.

- `supportShift`: getup에서만 기존 want에 보정 속도를 더한다.
- `supportShiftCarry`: 같은 보정을 첫 getup 이후 stand에서 기존 인계 신호 `levH`만큼 곱해 이어가고, `levH=0`부터 요청을 멈춘다. 상태 이름이나 stand 전환 시각을 늦추지 않는다.

두 후보 모두 실제 위치·속도·관절 구조·모터 한도를 순간 변경하지 않는다. 접촉 영역은 COP나 충분한 체중 지지 능력이 아니다. 손은 별도 손바닥이 아닌 전완 collider, 정강이도 독립 무릎 힘판이 아니다. **기존 직접 수평력·upright가 남아 있다.** 이 연구는 그 제어에 주는 목표의 원인을 분리하며, 발 관절만으로 지면 반력을 만들어 전신을 움직이는 구현이 아니다.

## 실행 계약과 판정 가능한 범위

실제 `same_lying_recovery`/`G.step`/Rapier를 사용한다. seed7·longsword·paired·B(assist .1/catch on/1), 건강 또는 앞다리 controller health .45, 각 25초다. 자연 heavy-down으로 만든 기존 누움에서 native/controller checkpoint가 같음을 확인한 뒤 개입한다. **실제 검 충돌로 생긴 부상, 사람의 운동 표본은 아니다.**

1. 첫 r1 6행: projected × 건강/부상 × baseline/observe/shift. 기존 참조 궤적·복제 관찰·첫 개입 직전 native/controller/input·source/HEAD guard 통과.
2. r2 16행: projected/legacy × 건강/부상 × baseline/observe/shift/carry. r1의 projected 6행은 반복이며 독립 표본에 더하지 않는다. legacy는 같은 낮은 누움 checkpoint 이후 **실제 설정을 legacy로 바꾸는 대조**다. raw의 `row.model='projected'`는 공통 runner 인수이고 실제 지지 방식은 각 배치 `protocol.support`를 따른다.
3. r3 12행: projected × 좌/우 외란 × 건강/부상 × baseline/observe/carry. checkpoint .4초 뒤부터 .2초 동안 골반 COM에 18N, checkpoint의 오른쪽 축으로 정한 같은 world 방향을 24스텝 적용했다. 요청 시각·힘 시퀀스 exact와 carry 인계 신호 관문을 추가했다. 다른 넘어짐 자세·무기·실제 상처로 확대된 것은 아니다.

각 배치의 수정 없는 clone/observer는 baseline 전체 physical/control trace와 같았다. 첫 후보 보정은 실제 수평력 차이로 이어졌다. r1 건강 첫 힘 차이는 2.208333초 Fx −28.395117→−28.463615N, 부상은 2.808333초 Fx +4.651181→−3.801970N이었다. `applications`는 **목표속도 보정 횟수**이며 전체 사후 힘 차이 횟수나 새 힘 적용 횟수가 아니다. 이후 힘 차이는 물리 되먹임도 포함한다.

독립 감사는 r1의 각 행 3,000프레임에서 선택 몸의 질량이 ledger와 같고 COM 차이가 최대 `4.45e−16m`임을 확인했다. r2 carry 네 행은 같은 시각의 실제 levH를 이용한 사후 검사에서 가중식 오차 최대 `1.11e−16m/s`, 인계 종료 뒤 요청 0이었다. 이는 r2 당시 런타임 guard와 구별되는 원자료 후처리다. r3는 해당 levH/24스텝 외란 guard를 실행 시 직접 보존했다.

## 결과: projected 개선과 legacy 후퇴를 함께 보존

아래 극값은 **첫 stand 이후부터 25초 종료까지**다. 평균 미끄럼은 확인된 발 solver 접점의 수평 상대속도이며 발 COM 속도가 아니다. 재넘어짐·다시 기립한 구간도 포함하므로 분포 점유시간이 다르다.

| 지지 / 상태 / 후보 | 재넘어짐 | 최고 K J | 최대 관절 gap mm | 미끄럼 평균 / 최대 m/s |
|---|---:|---:|---:|---:|
| projected 건강 baseline | 0 | 84.117 | 2.450 | .00500 / 3.591 |
| projected 건강 shift | 0 | 82.089 | 4.306 | .00405 / 1.581 |
| projected 건강 carry | 0 | 47.568 | 1.765 | .00187 / 1.527 |
| projected 부상 baseline | 3 | 291.668 | 3.434 | .05302 / 7.942 |
| projected 부상 shift | 0 | 63.594 | 1.832 | .00317 / 3.284 |
| projected 부상 carry | 0 | 48.030 | 2.124 | .00378 / 3.026 |
| legacy 건강 baseline | 0 | 30.920 | 1.700 | .00313 / 3.109 |
| legacy 건강 carry | 0 | 30.493 | 1.119 | .00113 / .531 |
| legacy 부상 baseline | 0 | 28.193 | 2.092 | .00307 / 4.319 |
| legacy 부상 shift | 0 | 33.022 | 2.234 | .00512 / 4.914 |
| legacy 부상 carry | 0 | 33.435 | 1.710 | .00482 / 4.902 |

건강/부상 첫 stand는 모든 후보에서 기존 4.216667/5.575초로 같다. 건강 shift의 gap 후퇴는 stand 1.45초 뒤 착지 구간에서 나타났다. carry가 이 후퇴를 줄였지만, 인계 보정을 더 오래 실행한 효과와 총 근육 일/효율을 같다고 해석하지 않는다.

projected stand 직전 COM의 지지 영역 밖 거리는 건강 .381→.237m, 부상 .644→.315m로 줄었다. **여전히 영역 밖**이므로 정적 자립 지지나 인간다운 회복을 입증하지 않는다. legacy 부상은 baseline 자체가 재넘어짐 0이고 후보는 K·미끄럼을 늘렸으므로 일반판 개선이라고 할 수 없다.

| projected 외란 / 상태 | 재넘어짐 baseline→carry | 최고 K J | 최대 gap mm | 최대 미끄럼 m/s |
|---|---:|---:|---:|---:|
| 좌 18N / 건강 | 0→0 | 86.283→45.917 | 2.476→1.781 | 3.661→1.490 |
| 우 18N / 건강 | 0→0 | 183.419→45.389 | 2.374→1.803 | 3.138→1.512 |
| 좌 18N / 부상 | 1→0 | 167.537→48.899 | 2.861→2.130 | 5.762→3.061 |
| 우 18N / 부상 | 2→0 | 228.027→48.566 | 3.597→2.124 | 8.617→3.020 |

## 남은 작업과 재현

Q02는 **이번 projected의 두 회복 조건에서 접촉 보정과 서기 인계를 잇는 후보가 개선됐다**는 구현 근거를 얻었다. 이후 우선순위는 (1) legacy 부상에서 증가한 미끄럼의 첫 실제 힘/발 접촉 변화, (2) 이 수평 제어의 반작용을 실제 지지 관절로 전달하는 경로, (3) 실제 전투 상처·양측/반대쪽 손상·다른 누움/무기로 확장이다. 지금 결과만으로 Q06을 닫거나 철회한 지지 연구판을 다시 공개하지 않는다.

초기 실행의 Git child-process EPERM 뒤 권한이 허용된 로컬 실행으로 같은 명령을 수행했다. 각 배치 물리/직렬화 벽시계는 약 68.7/83.3/76.0/96.3/93.0초이고, 병렬 실행 간 성능 비교는 아니다. 원자료는 저장소 밖 로컬에 있으며 외부 백업을 확인하지 않았다. 재현 시 새 출력 경로를 사용한다.

```sh
node tools/sim/experiments/recovery_com_transfer_probe.mjs --support=projected --carry=yes --out=/tmp/q02-projected-new.json
node tools/sim/experiments/recovery_com_transfer_probe.mjs --support=legacy --carry=yes --out=/tmp/q02-legacy-new.json
node tools/sim/experiments/recovery_com_transfer_probe.mjs --support=projected --screen=carry --pulse=left --out=/tmp/q02-left-new.json
node tools/sim/experiments/recovery_com_transfer_probe.mjs --support=projected --screen=carry --pulse=right --out=/tmp/q02-right-new.json
```

[후처리 도구](../../tools/sim/experiments/recovery_com_transfer_report.py)는 기존 JSON을 읽어 SHA·실행 관문·실제 첫 힘 차이·인계 가중치를 검증한다. 미기립은 관찰 종료까지 getup을 집계하고 빈 지지 영역은 별도 횟수/null로 남긴다. 초기 r1/r2에는 해당 집계 정정이 결과를 바꾸는 행이 없었다. P-01~P-06은 계속 미완료다.
