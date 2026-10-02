# Native upright 활성 비트와 실제 회복 대조 6차

첫 기립 직후 운동에너지 증가를 `k=d=0` 모터의 잔류 동작으로 설명하는 가설은 이번 두 장면에 맞지 않았다. **첫0.35초의 실제 요청 계수는 모두 양수였다.** zero 요청만 끄는 후보는 개입0건으로 기존과 같은 궤적을 냈다. 이를 모터 비활성화의 성공이나 회복 개선으로 판정하지 않는다.

## 첫 실행: 요청과 엔진 동등성

기준 game commit은 `5e6ef218eef0e3b3aba0f389cec6239045544458`이다. [기존 같은 누움 runner](../../tools/sim/experiments/same_lying_recovery_probe.mjs)와 [별도 엔진 API](native_motor_api_round1.md)를 사용했다. seed7, longsword, paired 그립, 받침.1/반사on/강도1, 실제 heavy down 후 건강/앞다리 controller health.45, 각25초 관찰이다. 임상 부상이나 사용자 장면의 완전 재현은 아니다. 공개 게임·npm·제어 소스는 변경하지 않았다.

npm baseline2행과 rebuilt baseline/observe/zeroFirstStand 각2행의 총8행을104.44초에 실행했다. 같은 low-down native/controller/input, 첫 stand 직전 native/controller/누적 prefix, 실제 관찰 메서드 dispatch, sourceStable을 통과했다. npm과 rebuilt의 원판 전체 trace·low native snapshot도 이 두 장면에서 exact였다. rebuilt 관찰 clone과 zero 후보는 기존 projected 전체 trace와 exact였다. 이 표본 밖 엔진 동등성은 미입증이다.

실제 Position configure 호출은 건강8,208건/손상7,992건이므로 모터 호출이 없는 관찰이 아니다. 그중 첫 stand42스텝은 각126요청이었다. 같은 handle·anchor·구조를 유지했고 getter는 마지막 solver substep의 값으로만 취급했다.

| 첫 stand 이후42스텝 | 건강 | 앞다리 health.45 |
|---|---:|---:|
| 첫 stand 시각 s | 4.216667 | 5.575 |
| 첫 요청 k / d | 915.65784 / 120.86683 | 170.55038 / 22.51265 |
| 창 k 최솟값 | 536.48544 | 169.27012 |
| 실제 zero 요청 / disable | 0 / 0 | 0 / 0 |
| group support 확인 step | 42 | 42 |
| 첫 physics 이후 K J | 22.27082 | 16.39659 |
| 공통 직전 상태 대비 ΔK J | +19.54077 | +14.69493 |

`native-recovery-r1.json` SHA256은 `f64365b62960badf61b0cc71c66644eb5e13150a3e12b09afd6a4521029cebc8`이다. `.summary.json`, `.analysis.json`, 실행 로그를 외부 evidence에 보존했다. 최초 실행의 hardcoded 모듈/교정 경로와 후속 CLI 일반화는 소스 해시로 구분한다.

## 이어진 가설

다음 대조는 (1) 첫 stand42스텝에 양수 요청까지 포함해 upright3축 enabled bit를 모두 끄기, (2) 첫 stand 이후 관찰 종료까지 실제 zero 요청만 끄기다. 기존 관절을 유지하므로 [5차 관절 삭제/재생성](recovery_handoff_round5.md)과 구별한다. 첫 실제 bit 변경 직전 상태와 요청을 맞추고 첫 순간·짧은 창·전체 재넘어짐을 따로 판정한다. 검사 실행과 결과는 아래 후속 근거를 따른다.

## 후속 실제 개입: 두 가설 모두 실행

r3는 rebuilt baseline/allOff42/zeroAfterStand × 건강/손상6행을50.29초에 실행했다. r1의 원판·npm·관찰 clone 검증은 core/harness/runner 원문, 엔진/교정, 안정된 생성 모듈의 해시와 새 baseline 전체 trace exact로 재사용했다. 첫 configured 요청 또는 첫 zero 요청 직전 native/controller/누적 prefix가 동일하고, setter 전후 강체의 pose·속도·질량·userForce/torque·kinematic next target과 관절 handle/anchor/구조가 그대로였다. 첫 개입의 native 요청28개·목표·질량변화·명시적6~7경로 force/torque가 exact였다.

| 후보 | 건강 재넘어짐 | 손상 재넘어짐 | 실제 비활성화 횟수 건강/손상 | 판단 |
|---|---:|---:|---:|---|
| baseline | 0 | 3 | 0 / 0 | 같은 누움 기준 |
| allOff42 | 1 | 2 | 126 / 126 | 양수 보조까지 제거, 건강 회복 후퇴로 미채택 |
| zeroAfterStand | 0 | 1 | 66 / 60 | 제한된 개선, 첫 재넘어짐은 예방하지 못함 |

allOff42는 [5차 실제 관절 제거/재생성](recovery_handoff_round5.md)의 첫 K, 첫0.35초 관찰뿐 아니라 **25초 전체 physical trace도 두 조건에서 exact**였다. 따라서 이 두 장면에서 삭제/재생성 이력은 앞선 결과 차이의 혼입 원인이 아니었다. 일반적인 solver 이력 무관성의 증명은 아니다. 첫 K는 건강22.27082→16.59949J, 손상16.39659→15.79749J였지만 이후 건강 최대K84.12→286.20J와 재넘어짐 후퇴가 남았다. 단순 upright 제거는 회복 해법으로 채택하지 않는다.

zeroAfterStand의 첫 실제 개입은 건강5.016667초/손상6.225초이며 첫 stand+.35초 창 **이후**다. 손상의 첫 재넘어짐6.216667초는 그대로이고 뒤의 두 재넘어짐이 없어져3→1이다. 첫 실패를 예방했다고 보고하지 않는다. 손상 첫 개입 스텝 K는 baseline209.41907J/후보223.45367J로 후보가14.03460J 높다. 직전291.66818J에서 양쪽 모두 줄었으므로, 이 장면의0계수 모터 경로는 제동에도 기여했다. “0모터가 언제나 에너지만 공급한다”는 해석은 성립하지 않는다. 그 차이를 upright 모터 자체의 정확한 일로 간주하지 않는다.

첫 stand 이후 관찰의 최대K/관절 gap은 건강 baseline84.12J/2.450mm → zeroAfterStand78.16J/2.450mm, 손상291.67J/3.434mm →291.67J/2.223mm다. 건강·손상 각1장면, 실제 부상·전투·다른 무기·입력·모바일 체감은 미검증이다. 격리 연구로 유지하며 일반판/엔진을 교체하지 않는다.

## 실패 보존과 계측 정정

r2는 임시 import의 mkdtemp UUID 절대 경로까지 생성 소스 해시로 비교하여 물리 실행 전0행에서 중단됐다. source 원문과 안정된 clone의 해시는 같았고, runner 임시 import URL만 정규화하여 r3를 실행했다. r2를 물리 실패나 성공 표본으로 세지 않는다.

r3의 늦은 개입 시각은 `G.t` 누적값과 `frame×DT` 값 사이 약1e−13 차이가 있어 `firstZeroFrame` 전용 포인터가 저장되지 않았다. 초기 optional 비교는 양쪽 undefined를 같다고 보아 해당 관문을 잘못 통과시켰다. 원자료의 실제 `frames`에는 각 사건이 정확히1행씩 남아 있어 **그 행을 재연결한 별도 후처리·독립 감사·디렉터 재검증**으로 위 요청/힘 동일성을 확인했다. 물리를 재실행하거나 raw를 덮어쓰지 않았다. 전체 모터3축의 enabled는 baseline true/후보 false였다.

후속 driver는 관찰 시간을 정수 프레임으로 정규화하고 필요한 프레임/필드가 없으면 throw한다. **r3 실행본과 수정본 해시는 다르며 수정본은 구문·교정 출처 확인만 수행했다.** [통합 기록](native_recovery_round6_metrics.json)에 실행 소스, 두 성공 실행·실패·후처리 SHA, 실제 첫 변화4개 원자료 대조를 보존했다. 원래 summary의 `afterFirstStand.noSupportIntervalS`는 전체 관찰구간의 최댓값이어서 통합 기록은 `wholeObservationMaxNoGroupSupportS`로 명시한다. post-stand 전용 값으로 읽지 않는다.

```sh
node tools/sim/experiments/native_recovery_probe.mjs --module=/tmp/my-native-motor-research/rapier.js/rapier-compat/builds/3d/pkg/rapier.mjs --calibration=/tmp/native-api.json --out=/tmp/native-recovery-fresh.json
# 이전 core/engine/교정 parity와 실제 baseline trace를 검증하며 대조 재사용
node tools/sim/experiments/native_recovery_probe.mjs --reference=/workspace/halfsword-hybrid-evidence/native-recovery-r1.json --out=/tmp/native-recovery-followup.json
```

다음은 0계수 모터의 실제 비활성화를 근력/지지 설계의 한 요소로 유지하면서, 도달 가능한 발 배치와 손·무릎→발 하중 이전을 고치는 일이다. 첫 인계의 양수 보조, 다리 목표 단절과 추가 발 질량은 별도 원인으로 남아 있다. 전신 힘 전달·중력 이점·가속/관성·충돌/피해·휴대폰 체감 목표 전체는 계속 미완료다.
