# B 기준 기립 지지·접촉점 속도 기초 관찰

기준 커밋 `5763d3ac3d7705abae18b98b12943e58f7e6f1aa`, 실제 `harness_m` 물리 루프, seed7, B=assist0.1/catch on/scale1. 각 실행의 core 파일 해시가 실행 전후 동일했다. 도구는 힘·모터를 덮어쓰지 않는다. 표는 **첫 getup→stand 직전 물리 스텝**이며 N은 원시 접촉 충격량/dt이다.

| 조건 | stand 전환 시각(s) | 직전 골반 높이(m) | 앞/뒤 발 raw N | 앞/뒤 실제 접촉점 최대 수평속도(m/s) |
|---|---:|---:|---:|---:|
| 건강 | 2.0083 | 0.9365 | 30.35 / 10.20 | 1.086 / 0.638 |
| 앞다리 기능 .45 | 2.7667 | 0.9261 | 73.75 / 29.20 | 0.632 / 0.477 |
| applyWound cut .8/60J | 2.7833 | 0.9248 | 75.39 / 40.35 | 0.574 / 0.467 |
| 동일 wound, +18 N·s | 2.7833 | 0.9244 | 78.05 / 31.68 | 0.604 / 0.455 |
| 동일 wound, −18 N·s | 2.7833 | 0.9246 | 72.96 / 42.72 | 0.603 / 0.480 |
| 양쪽 다리 기능 .2 | 전환 없음 | 관찰 끝 kneel 0.5664 | 끝 샘플 400.68 / 0 | 끝 샘플 0.0101 / 접촉 없음 |

- 앞의 다섯 전환 직전 정강이 바닥 solver 접촉은 모두 없었다. 이 표는 발/정강이 관찰이며 다른 몸 부위의 지지를 부정하지 않는다.
- getup에서 gait.active=false이고 `legs.F.N/B.N`은 다섯 장면 모두 이전 stand의 409.75/321.20으로 남았다. 코드의 `G.exit()`는 N을 지우지 않으며 비활성 때 `pinFeet()`가 호출되지 않는다. 따라서 retainedGaitN은 현재 기립 지지력으로 쓸 수 없다.
- 전환 시각은 기존 kneelTime+riseTime 바로 다음 스텝이다. 건강 직전 stateTime2.0000/timer2.0000, .45 조건 직전2.7583/timer2.7586. 실제 접촉점이 움직이는 상태에서도 시간으로 stand가 선언됐다.
- 점속도는 `rb.velocityAtPoint(solverContactPoint)`에서 고정 바닥 점속도를 뺀 값이다. 발 COM나 전체 몸 COM 속도를 미끄럼으로 치환하지 않았다. 접촉 존재와 하중 지지는 별개이며, 최대 점속도는 모든 접촉점의 최댓값으로 충격량 가중치가 없다.
- impulse 배열과 solver point 배열을 같은 인덱스로 대응시키지 않았다. 원시 N과 과거 6/7 해석을 별도 보존했으며 이번 버전의 솔버 환산을 교정했다는 뜻이 아니다.
- getup의 가상 load 최솟값·직접 골반 지지·upright 보조가 남아 있으므로 발 N≈Mg를 기립 통과조건으로 삼으면 안 된다. 이 probe는 접촉/부하/속도/높이/관절 회전을 기록하며 인간 성공 문턱을 만들지 않는다.
- 무릎·발목·고관절의 rest-relative 회전 벡터와 상대 각속도는 모든 저장 샘플 및 전환 직전/직후 원본에 남겼다. off-local-z 회전은 임상적 외반각이 아니다.
- 시작은 실제 `knockDown(false)`의 무릎 기립이며 바닥에 누운 상태에서 일어나는 시험이 아니다. wound는 실제 damage handler에 넣은 합성 입력이고 18 N·s도 시험용 외란이다. 임상 손상·사용자 최신 장면을 재현했다고 주장하지 않는다.
- 양쪽 .2 조건은 9초 관찰 중 kneel로 남았다. 이를 down 실패복귀 구현이나 인간다운 주저앉음의 증거로 해석하지 않는다.

실행 명령:

```sh
node --check tools/sim/recovery_support_probe.mjs
node tools/sim/recovery_support_probe.mjs --conditions=healthy,hurt,disabled --seconds=9 --out=evidence/recovery-support-b-initial.json
node tools/sim/recovery_support_probe.mjs --conditions=wound,wound_side_pos,wound_side_neg --seconds=12 --out=evidence/recovery-support-b-wound.json
```

두 JSON에 sourceBefore/sourceAfter, 설정·외란·스텝 간격·각 장면 전체 trace SHA256, 전환 직전/직후 샘플을 보존했다. 기본 저장은 4스텝마다이며 상태 전환은 항상 보존한다. 결과 `observed`는 도구 실행 완료를 뜻하며 자연스러운 기립 판정이 아니다. A/B/low_half/high_full의 2×2 선택은 CLI에 준비되어 있으나 이번 기초 관찰은 B의 여섯 장면만 실행했다.


후속 통합: 원자료는 `/workspace/halfsword-hybrid-evidence`로 옮겼고 [파일 해시·요약](recovery_contact_round1_metrics.json)에 보존했다. 이후 단순 정적 힘 교정에서는 6/7 보정이 맞았으나 관절 인체·과도 응답으로 일반화하지 않는다. [교정 결과](contact_force_calibration_metrics.json). 첫 접촉 기반 R은 건강 기립을 막아 기각했으며 [재현 패치](../../tools/sim/experiments/README.md)로만 보존한다. 이후 방향은 [전신 물리 개선 계획](physical_realism_plan.md)을 따른다.
