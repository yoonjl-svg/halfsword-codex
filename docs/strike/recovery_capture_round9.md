# Q02 속도를 고려한 지지 목표와 착지 원인 분리 — 9차

2026-10-02. **COM 속도를 앞서 보는 목표를 구현했지만 legacy 부상의 최대 미끄럼이 더 커져 채택하지 않는다.** 이어 실제 발 강체와 모터 요청을 관찰해, 이전 서기에서 저장된 마찰 하중 `Nf`가 넘어짐/기립 동안 보존되어 새 서기에 넘어오는 경로를 확인했다. 이 별도 lifecycle 수정은 [10차](recovery_contact_memory_round10.md)에서 다룬다.

기준 HEAD `e5d2f081de320e42634526e27a68804baf754993`. 게임 src/공개 기본값은 동결했다. [20행 원자료 요약·SHA·실행 관문·독립 감사](recovery_capture_round9_metrics.json), [착지 관찰 6행](recovery_touchdown_round9_metrics.json)을 보존한다. 기존 [8차](recovery_com_transfer_round8.md)의 같은 누움/건강·앞다리 controller health .45/longsword/paired/assist .1/catch on/1, 각 25초를 재사용한다. 실제 충돌로 생긴 부상은 아니다.

## 구현과 실행

`captureCarry`는 실제 선택된 동적 몸체의 질량과 운동량으로 COM 속도를 구하고 `c + v/ω`를 fresh 양의 지지 접촉 hull에 투영한다. `ω=sqrt(9.81/max(.5, COM.y))`는 기존 footing의 평지 높이 바닥값을 재사용했다. 기존 holdGain·보정 속도 한도 .3m/s·stand의 levH 인계는 동일하다. 기존 골반 속도 감쇠에 **COM 속도를 고려한 보정이 추가**되는 것이며, 감쇠가 전혀 없던 제어에 처음 감쇠를 넣은 것이 아니다.

낮은 회복 자세의 다관절 신체가 일정 높이의 역진자라고 가정할 수 없으므로, 이 식은 선행 목표 가설이다. 실제 COP/마찰·근력 여유나 안정성을 보장하지 않는다. 기존 직접 수평력과 upright는 남아 있으며 지면 반력만으로 회복하는 구현이 아니다.

- legacy/projected × 건강/부상 × baseline/정적 observer/capture observer/기존 staticCarry/새 captureCarry = 20행.
- 기존 baseline/staticCarry 8쌍은 8차 전체 trace와 exact. observer 두 종류도 baseline과 exact.
- 첫 개입 전 native/controller/prefix와 입력이 같고, 실제 수평력 차이를 확인했다. 독립 감사 60,000프레임에서 질량 오차0, COM 최대4.45e−16m, P/m 속도 최대6.67e−16m/s, 보정식 최대1.12e−16m/s였다. levH 종료 뒤 요청0.
- 실제 지지 방식은 `protocol.support`를 따른다. 공통 runner의 `row.model='projected'`를 legacy 결과의 실제 설정으로 오독하지 않는다.

## 결과

다음 극값은 첫 stand부터 25초까지이며 재넘어짐/재기립도 포함한다. slip은 확인된 발 접점의 수평 상대속도다. 최고 K는 동작·시점과 함께 읽어야 하며 낮을수록 항상 더 좋은 점수가 아니다.

| 지지 / 상태 / 후보 | 재넘어짐 | K 최대 J | gap 최대 mm | slip 평균 / 최대 m/s |
|---|---:|---:|---:|---:|
| legacy 건강 baseline | 0 | 30.920 | 1.700 | .00313 / 3.109 |
| legacy 건강 staticCarry | 0 | 30.493 | 1.119 | .00113 / .531 |
| legacy 건강 captureCarry | 0 | 29.466 | 1.142 | .00158 / .577 |
| legacy 부상 baseline | 0 | 28.193 | 2.092 | .00307 / 4.319 |
| legacy 부상 staticCarry | 0 | 33.435 | 1.710 | .00482 / 4.902 |
| legacy 부상 captureCarry | 0 | 32.247 | 1.189 | .00414 / 5.243 |
| projected 건강 staticCarry → captureCarry | 0 → 0 | 47.568 → 58.566 | 1.765 → 2.107 | .00187 → .00201 / 1.527 → 1.570 |
| projected 부상 staticCarry → captureCarry | 0 → 0 | 48.030 → 48.460 | 2.124 → 2.150 | .00378 → .00404 / 3.026 → 3.060 |

위치·속도 목표만으로 다리 미끄럼의 원인이 해소되지 않았다. 해당 후보의 gain/시간 전수 탐색을 하지 않고 접촉·마찰 작용 경로로 이동했다.

## 후속 관찰에서 찾은 별도 경로

`recovery_touchdown_probe.mjs`는 legacy 건강/부상 × baseline/observer/capture 6행을 다시 실행해 이전 전체 trace와 일치함을 확인했다. 이는 새로운 독립 회복 표본이 아니라 추가 관찰이다. 실제 native 발 강체의 속도/회전/에너지, 관절 anchor, native motor 요청, pinFeet의 명시적 근사 일을 기록했다. 요청 속도는 solver가 실제 낸 토크/충격량이 아니다.

부상 baseline의 뒷발 yaw 속도는 첫 stand 이후 약 `+8.16, −15.57, +7.34, −10.89, +20.62, −23.02rad/s`로 번갈아 바뀌었다. 첫 step의 발목 모터 목표속도는0이고 이후 yaw 목표속도도 작았다. 따라서 모터의 목표속도 점프 하나로만 설명할 수 없다. 일부 step에서 pinFeet는 양의 근사 일을 했지만 스프링의 에너지 반환과 적분 효과가 섞이므로 **양의 일 자체만으로 버그를 확정하지 않는다.**

소스와 실제 entry 기록에서 분명한 lifecycle 문제는 `Gait.exit/enter`가 `Nf`를 비우지 않는다는 점이다. 이전 서기의 뒷발 peak가2126N인 채 down/getup을 지나고, 새 stand 첫step에는 현재 N=0인데도 decay 뒤1896N이 남아 마찰 한도1706N으로 쓰인다. 해당 기록의 수명과 실제 접촉 사건을 분리한 10차 대조로 영향을 검증한다.

9차 frame의 `ankles.ankle`은 Gait.sense가 **physics 전에 저장한 값**이다. step 뒤 native 발목 위치라고 하지 않는다. 추가 observer의 native body/anchor 기록과 시점을 구별한다. 몸 위치·속도 주입이나 새 근력 한도는 이번 연구에 없다.

## 재현과 보존

```sh
node tools/sim/experiments/recovery_capture_probe.mjs --support=legacy --out=/workspace/halfsword-hybrid-evidence/q02-capture-r1-legacy.json
node tools/sim/experiments/recovery_capture_probe.mjs --support=projected --out=/workspace/halfsword-hybrid-evidence/q02-capture-r1-projected.json
node tools/sim/experiments/recovery_touchdown_probe.mjs --support=legacy --out=/tmp/q02-touchdown-new.json
python3 tools/sim/experiments/recovery_capture_report.py --evidence-dir=/workspace/halfsword-hybrid-evidence --out=/tmp/q02-capture-compact-new.json
```

기존 evidence 경로는 덮어쓰기를 거부한다. 재현은 빈 작업공간 또는 새 경로로 하며 touchdown 도구는 위 capture summary를 참조한다. 후처리 도구는 원자료 요약을 재생성하고 독립 감사 첨부는 별도다. capture legacy/projected 약97.7/106.7초, 추가 observer61.9초이며 병렬 자원·관찰량이 달라 속도 비교로 쓰지 않는다. 원자료는 저장소 밖 로컬, compact 근거와 실행 소스는 저장소에 보존한다.
