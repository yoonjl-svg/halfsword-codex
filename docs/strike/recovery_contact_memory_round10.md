# Q02 새 서기로 넘어오는 오래된 마찰 하중 — 10차

2026-10-02. **새 서기 시작 때 이전 서기의 마찰 하중 peak `Nf`만 비우자, legacy 건강/부상·무외란/좌/우 6조건 모두 최대 발 미끄럼이 줄었다.** 기립 시간이나 반사 gain을 조절한 후보가 아니라 접촉 기록의 수명을 고친 후보다. 후속 [선택형 실제 게임 연결·회귀](stance_memory_trial.md)까지 로컬 검증했으며 일반판 승격이나 전체 기립 해결이 아니다. projected 지지의 재넘어짐은 해결되지 않았다.

기준 HEAD `e5d2f081de320e42634526e27a68804baf754993`. [24행 원자료 요약·SHA·독립 감사](recovery_contact_memory_round10_metrics.json). 발견 과정은 [9차](recovery_capture_round9.md)다.

## 결함과 최소 변경

`Gait.pinFeet`는 현재 접촉 하중 N과 감쇠하는 과거 peak Nf 중 큰 값으로 발을 붙잡는 한도를 만든다. 연속된 같은 지지에서 하중의 순간 흔들림을 완화하려는 기록이다. 그러나 `Gait.exit`/`enter`는 이 값을 비우지 않고, down/getup 동안 pinFeet를 실행하지 않으므로 기록도 나이를 먹지 않는다.

이번 같은 누움에서는 이전 서기의 F484.442N/B2126.392N이 새 서기까지 남았다. 부상 첫 stand5.575초 뒷발의 **현재 N은0인데 Nf는1896.033N, 마찰 한도1706.430N**이었다. 후보는 이 순간 Nf/한도0으로 현재 접촉을 다시 읽게 했다. 다음 실제 하중이 있으면 기존 식으로 정상 재계산한다.

격리 helper `clearStanceFrictionMemory(gait)`는 `Gait.enter` 직전에 **양발의 Nf만0**으로 만든다. N/Nsum, 몸 질량, 위치/속도, plant, IK 목표, 모터/반사/지지 gain은 유지한다. COM 보정 후보는 결합하지 않는다. 기록이 다른 접촉 세대로 넘어오는 문제와 기존 마찰 스프링·명시적 감쇠의 안정성은 별도다.

## 실제 게임 선별

기존 actual `G.step`/Rapier 같은 low-down checkpoint에서 건강/앞다리 controller .45를 대조했다. longsword·paired·assist .1/catch on/1, 각25초다. 좌우 외란은 checkpoint .4초 뒤부터 .2초 동안 골반 COM에18N(같은 world 방향/24step)이다. 실제 검 충돌 부상과 사람 동작은 아니다.

- legacy 무외란·좌·우와 projected 무외란 × 건강/부상 × baseline/observer/reset = 8조건24행.
- clone/observer baseline trace exact, 첫 실제 entry 직전 native/controller/prefix와 다리6개 강체의 질량·위치·속도·모터 요청8/8 exact. entry마다 Nf0, N 보존 확인.
- 독립 감사는 실제 force를 바꾸기 전의 동등성을 확인했다. 후속 재기립은 개입 뒤 갈라진 상태이므로 baseline과 native state가 같아야 한다고 요구하지 않는다.
- 초기 projected r1은 이 후속 entry에도 equality를 요구하는 **검사 오류**로 중단됐다. 원자료와 실행 당시 probe를 외부 보존했고, 첫 entry만 equality로 고친 뒤 r2를 완주했다. helper/물리 개입은 바뀌지 않았다. r1의 완료된 반복 행과 중단 행을24행의 독립 결과에 더하지 않는다.

다음 극값은 첫 stand 이후25초까지다. slip은 확인된 발 접점의 수평 상대속도이며 COM 속도가 아니다.

| 지지 / 조건 | 재넘어짐 A→B | 최대 slip m/s | 평균 slip m/s | 최대 gap mm | 최대 K J |
|---|---:|---:|---:|---:|---:|
| legacy 건강 무외란 | 0→0 | 3.109→1.474 | .00313→.00215 | 1.700→1.100 | 30.920→33.484 |
| legacy 부상 무외란 | 0→0 | 4.319→.893 | .00307→.00206 | 2.092→2.090 | 28.193→31.318 |
| legacy 건강 좌 | 0→0 | 3.103→1.475 | .00291→.00217 | 1.686→1.099 | 30.924→33.482 |
| legacy 부상 좌 | 0→0 | 4.308→.894 | .00319→.00205 | 2.089→2.095 | 28.189→30.524 |
| legacy 건강 우 | 0→0 | 3.178→1.468 | .00297→.00210 | 1.700→1.101 | 30.862→33.421 |
| legacy 부상 우 | 0→0 | 4.220→.893 | .00329→.00210 | 2.074→2.095 | 28.204→32.311 |
| projected 건강 | 0→0 | 3.591→3.061 | .00500→.00413 | 2.450→2.462 | 84.117→87.772 |
| projected 부상 | 3→3 | 7.942→7.922 | .05302→.05401 | 3.434→3.096 | 291.668→311.270 |

부상 좌/우의 gap은 각각약6/21µm 늘었다. 모든 수치가 개선됐다고 하지 않는다. 첫 stand 시각은 기존과 같고 자연스러운 기립/피해 시 주저앉음의 사용자 수락은 아직 아니다.

## K 증가의 해석과 한계

건강 조건 K 최대는 첫 stand step이다. 같은 step pinFeet 순일은−4.322→−.309J로, 오래된 큰 마찰 제동을 없앤 결과와 K증가가 양립한다. **K가 낮다는 이유만으로 과도한 마찰을 더 좋은 동작이라고 판정하지 않는다.**

부상 후보의 K31.318J peak는5.991667초(stand+.416667초)다. 첫 step과 다른 접촉/재딛기 구간이며 같은 시각 baseline19.258J, 후보 COM vx .57248m/s다. 뒷발 raw normal impulse1.904→11.973Ns도 함께 달라졌다. native 전체 일을 측정하지 않았으므로 증가 원인을 첫 step의 pin 제동 해소로 단정하지 않는다. 해당 frame은 compact 원자료에 남겼다.

legacy의 선별 결과는 후속 후보 검토를 지지한다. projected 부상은 재넘어짐3회가 그대로고 K·평균 미끄럼이 악화했다. **철회한 지지 연구판을 다시 공개하지 않는다.** 실제 접촉 아래 근육/관절 반작용으로 일어나는 전체 설계, 양측/반대쪽 손상·다른 누움·무기/체중 범위는 남아 있다.

## 재현

```sh
node tools/sim/experiments/recovery_contact_memory_probe.mjs --support=legacy --out=/tmp/q02-memory-legacy-new.json
node tools/sim/experiments/recovery_contact_memory_probe.mjs --support=projected --out=/tmp/q02-memory-projected-new.json
node tools/sim/experiments/recovery_contact_memory_probe.mjs --support=legacy --pulse=left --out=/tmp/q02-memory-left-new.json
node tools/sim/experiments/recovery_contact_memory_probe.mjs --support=legacy --pulse=right --out=/tmp/q02-memory-right-new.json
python3 tools/sim/experiments/recovery_contact_memory_report.py --evidence-dir=/workspace/halfsword-hybrid-evidence --out=/tmp/q02-memory-compact-new.json
```

원자료는 새 경로에 보존하고 덮어쓰지 않는다. 초기 실행 당시 probe archive SHA와 현재 두 줄의 관문 수정 범위는 감사 JSON에 있다. 원자료 로컬 보존과 원격 백업은 별도이며 compact 근거/소스만 프로젝트에 포함한다.
