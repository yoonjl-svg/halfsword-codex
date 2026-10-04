# 그립 힘·속도 계약 확인 / 연속 속도 유지판 공개 기각

2026-10-04. 목적은 **충돌을 팔이 받아내면서 큰 베기·날 정렬·찌르기 의도를 보존하는 것**이다. [첫 충돌 진단](qinggang_contact_20261004.md)의 다음 단계다. 기준 `711d6773c5e388283268a7c4dc4e17c7cdad4c8e`; 게임/손/공개 엔진 변경은 없다. 실제 dirty 도구·외부 자료·실패/명령·해시는 [JSON](native_grip_wrench_20261004.json)에 기록했다.

모터의 힘 방향/목표 속도 계약은 확인했다. 빌드 lock에 맞는 Rust Rapier0.30.1의 [고정 소스](https://github.com/dimforge/rapier/blob/36f91a6a07de2565137e32be30951d03aba03b94/src/dynamics/solver/joint_constraint/joint_constraint_builder.rs#L614)는 body1 관절 좌표의 단위 축을 사용한다. 저장된121.42° 상대 자세의 분리9행에서도 힘 방향과 cap×dt 응답, 순간 속도 목표가 일치했다. 남은 힘을3축에 나누는 이론적 vector 예산은 성립한다. 전체 접촉/관절 운동량이나 기존 paired 후보의 엄격 실패를 합격시킨 것은 아니다.

| 생성부터 켠 청강검 · 같은 큰 베기 입력 | 기존 → 후보 |
|---|---|
| 내려베기 최대 칼끝 속도 | 12.347→12.379m/s |
| 같은 구간 검 길이축 속도 최대 | 5.292→7.899rad/s, 약49% 증가 |
| 후속 베기 같은 속도 | 5.717→8.157rad/s, 약43% 증가 |
| 날 평면 방향의 최대 차이 | 내려베기7.42° / 후속7.97° |

무접촉516스텝의 기준은 과거 native·입력·제어·사건과 exact다. 후보도 동일 실제 입력이며 접촉·상처0, 관절 연결과 칼끝 속도는 유지됐지만 **큰 베기 전체 보존을 통과했다고 할 수 없다.** 남은 힘이 없던28스텝은 모터를 추가하지 않고 기존 토크를 보존했다.

계약 확인 뒤 생성부터 실제 전투1080스텝을 한 번 확장했다. 기준의 찌르기는 tick803 수락, 후보는 getup 전환 뒤 tick804 거절이었다. 요청 방향 입력은 전부 같지만 실제 찌르기·피격·칼 맞부딪힘이 달라졌다. 최대 축속도42.61→7.90rad/s는 **같은 실제 공격/충돌의 효능 근거가 아니다.** 기립 상태 차이도 인간 회복의 성패로 쓰지 않는다. 두 검사 모두 검 든 팔 절상은 없었다.

**판정:** 현재3축 속도 유지판의 공개 적용은 기각한다. 첫 충돌만 같은 상태에서 비교한23.21°→9.49°는 국소 진단으로 보존한다. 그 수치만으로 연속 적용을 권하지 않으며 같은 모델의 gain/seed 탐색은 중단한다. 게임4궤적은2조건×기준/후보이고 독립 효능4표본이 아니다. API9행·정적 감사·파생 계산을 별도로 센다.

```sh
node tools/sim/experiments/native_grip_wrench_probe.mjs --reference=/workspace/halfsword-handoff/qinggang-contact-20261004/native-grip-follow-run06.json --module=/workspace/halfsword-research-import-20261003/engine/rapier.mjs --out=/tmp/NEW-grip-operator.json
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/no-tap-run03.json --module=/workspace/halfsword-research-import-20261003/engine/rapier.mjs --out=/tmp/NEW-free-cut.json --modes=observe,nativeContinuous --tick=0 --after=515
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/contact-tap-run06.json --module=/workspace/halfsword-research-import-20261003/engine/rapier.mjs --out=/tmp/NEW-live-grip.json --modes=observe,nativeContinuous --tick=0 --after=1079
node tools/sim/experiments/native_grip_motion_metrics.mjs --free=/tmp/NEW-free-cut.json --live=/tmp/NEW-live-grip.json --out=/tmp/NEW-grip-metrics.json
```

당시 argv·실측 도구SHA는 JSON을 참조한다. 외부 reference/연구 엔진을 같은 해시로 준비하고 기존 원자료를 덮어쓰지 않는다. 1e−5/solver1은 순간 속도 좌표만의 분리 검사이며 게임 timestep은1/120이다.

다음30–45분은 기존 손목 제어가 요청한 방향·날 정렬 토크를 native 그립 안으로 전달하는 최소 경로를 준비한다. 현재 속도 유지 대신 **손이 요청한 공격을 방해하지 않으면서 충돌을 받아내는 것**이 관문이다. 같은 무접촉 베기와 저장된 첫 충돌부터 판정하고, 효과/입력 보존 실패 시 공개하지 않는다. 전체2단계 P-03/P-04 진행 중이며 메이저 일반 승격은 없다. 새 사용자 테스트 요청도 없다.
