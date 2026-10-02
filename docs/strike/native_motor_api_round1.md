# Native 관절의 힘 제한과 실제 팔꿈치 1차

관절을 삭제하거나 자유 두 강체 제어로 바꾸지 않고, Rapier의 기존 결합 solver 안에서 모터 한도를 제한하는 경로를 확보했다. 독립 API 검사 **34개**, 실제 게임 타격 **32행**이 통과했다. 이는 한 축의 제어·계측 기반이며 기립·전신 근력·자연스러움의 완료가 아니다. 공개 게임의 npm 엔진은 교체하지 않았다. 공개 [팔 비교판](arm_capacity_trial.md)은 기존 엔진의 어깨/손목 finalCap-only다.

## 엔진과 재현 범위

공식 `dimforge/rapier.js` v0.19.3의 `0fd32c1cbbc7018af36f09b190c16ce72fbb9301`을 별도 디렉터리에서 빌드했다. Rust Rapier는 0.30.1, parry는 0.25.2다. upstream tag의 template는 package0.19.3/parry^0.25.3인데 committed lock은 package0.19.2/parry0.25.2여서, 생성 manifest를 lock에 맞췄다. 소스는 Rapier의 parry 재수출을 사용한다. Cargo/npm lock을 바꾸지 않았으며 `version()`은 0.19.2를 반환한다. **배포 npm 바이너리의 정확한 재빌드라고 주장하지 않는다.**

Rust1.89.0/wasm-pack0.12.1/wasm-bindgen0.2.100/Binaryen112로 컴파일하고 high-level ES module 초기화·World.step을 확인했다. 최초 axis 변환 컴파일 오류, npm 도구 설치 실패는 로그로 보존했으며 실제 수정 후 빌드가 성공했다. TLS 검증을 해제하지 않았다. 성공 모듈 SHA256은 `a3be9d8361b386b0b664ee7ba771f14ae60e93eda9a4ab825f1de1260dbb5623`이다.

[독립 빌드 recipe](../../tools/engine/README.md)에 고정 source/tool SHA, patch, 중복 적용 방지, 외부 cache 경계를 보존했다. 최초 실행 스크립트와 이식된 recipe의 해시는 provenance에서 구분한다. **이식된 recipe는 문법·패치 검사까지 통과했으며 별도 clean rebuild는 미실행**이다. 빌드 영수증·manifest 차이 해시·원자료·실제 게임 소스 해시는 [통합 기록](native_motor_api_round1_metrics.json)에 있다. 바이너리는 저장소에 넣지 않았다.

## API 의미를 먼저 검증

`world.impulseJoints.raw`에 다음 5개 바인딩만 추가했다: `jointSetMotorMaxForce`, `jointMotorMaxForce`, `jointSetMotorEnabled`, `jointMotorEnabled`, `jointMotorImpulse`. angular 축의 maxForce는 Nm다. cap setter는 모터를 자동 활성화하지 않으며 음수/NaN/무한대를 거부한다. 모터 on/off는 기존 handle·앵커·frame·강체를 유지한다.

34검사는 무중력/무감쇠/등방성 관성 두 강체에서 dt1/240·1/120·1/60, cap0·5·500, 위치/목표속도/감속을 대조했다. 실제 각운동량 변화는 cap×dt 이내이고 양쪽 합은 0이었다. 같은 handle에서 실제 disable은 초기 각속도 ±1.5rad/s를 유지했지만 `configureMotor(0,0,0,0)`은 ±1.08333으로 줄였다. 따라서 계수0과 모터off는 다르다.

**impulse getter는 마지막 solver substep의 값이다.** dt1/120·cap5·6회 substep에서 전체 강체 ΔL은 +0.041666664Nms인데 getter는 −0.0069444445였다. 포화 fixture에서는 비가 −6이지만 비포화에서는 절댓값 비가 최대99.78이었다. 마지막 값에6을 곱해 전체 충격량/일로 사용할 수 없다. disable 뒤 getter는 과거 −0.06944445 값을 유지하기도 한다. cap0에서 native limit 반작용으로 ΔL이 생겨도 motor getter는0이었다. 전체 운동량 잔차·수동 관절 한도·모터 충격량을 혼동하지 않는다.

## 실제 게임에서 관절을 보존한 후보

`native_elbow_probe.mjs`는 기존 실제 harness의 Rapier import만 별도 모듈로 바꾸고 나머지 Fighter/AI/Combat/G.step을 그대로 실행한다. native calibration의 PASS와 모듈 SHA가 다르면 중단한다. `native_elbow_candidate.mjs`는 실제 dispatch에서 기존 farmS 모터 요청을 받아 같은 관절에 힘 한도를 적용한다.

- 기존 k와 gain으로 근육 계수를 복원하고 `cap = j.max × muscle`을 사용한다. 새로운 인체 근력값을 도입하지 않는다.
- ForceBased spring의 요청 위치를 `target + gravityFeedforward/k`로 바꿔 기존 중력 보상을 같은 native 모터 한도 안에 넣는다. k/d/목표속도는 유지하며 별도 명시적 elbowGravity 토크는 억제한다.
- 이는 spring의 `k(target−angle)`에 FF를 더하는 수학적 대응이다. **이전 solver 밖 외부 FF와 동등한 제어가 아니다.** 결합 solver 안으로 이동하는 설계 변경이다.
- 관찰 clone과 baseline의 전체 trace/입력/native 시작 상태가 exact이고, install 자체는 상태를 바꾸지 않는다. 각 후보210회 실제 모터 호출/FF 억제/readback을 검증했다. 동일 값의 별도 함수만 실행한 시험이 아니다.

건강/armS=.15 × sabre/zweihander × down/up × npm/독립엔진 baseline/관찰/nativeCap = 32행, seed7, 준비3초+입력.55초+유지1.2초다. 약화는 armS 필드만 변경했으며 실제 전투 부상을 재현한 조건이 아니다. 15.93초에 완료했고 source/moduleStable, 유한값, 진단 오류0을 통과했다. npm↔새 엔진 기본8쌍도 해당 전체 궤적이 exact였다. 이 표본 밖 엔진 동등성은 미입증이다.

| 조건 | 기존 → nativeCap 칼끝 최고속도 m/s | 손 목표 최대 오차 m | 판정 |
|---|---:|---:|---|
| 건강 sabre 내려베기 | 15.5631 → 15.5638 | .30048 → .30044 | 앞선 자유 두 강체 교체의 큰 손실 없음 |
| 건강 zweihander 내려베기 | 16.932 → 16.860 | .4322 → .4388 | 거의 유지, 오차는 소폭 증가 |
| 약화 sabre 내려베기 | 11.916 → 11.756 | .3257 → .3346 | 속도·추종 소폭 후퇴 |
| 약화 zweihander 내려베기 | 11.3587 → 10.4787 | .5879 → .5401 | 속도 감소, 오차 감소 |
| 약화 zweihander 올리기 | 5.2328 → 4.5446 | .8674 → .8814 | 속도·추종 후퇴 |

약화 zweihander 내려베기의 마지막 substep 충격량/기존 cap 비는 최대1.66362였고 새 nativeCap은1.00000004(부동소수 오차 범위)였다. 19회 초과에서36회 포화로 바뀌었다. 건강 zweihander 내려베기도1.03530에서1.00000001로 제한됐다. **이는 측정한 마지막 모터 substep과 한 축의 한도**이며 전신의 모든 근육·접촉·관절 limit가 이 한도 안이라는 뜻이 아니다. 팔꿈치를 삭제하지 않은 후보는 앞선 자유 두 강체 교체의 건강 조건 힘 손실을 피했으나 약화 때의 더 느린 타격은 분명히 남는다. 전투·입력 종료·실제 상처·모바일 체감 검증 전 공개하지 않는다.

## 재현과 다음 실험

```sh
export ENGINE_RESEARCH_ROOT=/tmp/my-native-motor-research
bash tools/engine/setup_toolchain.sh
bash tools/engine/build_3d_compat.sh
node tools/engine/import_smoke.mjs
python3 tools/engine/write_receipt.py
node tools/sim/experiments/native_motor_api_probe.mjs --module="$ENGINE_RESEARCH_ROOT/rapier.js/rapier-compat/builds/3d/pkg/rapier.mjs" --baseline=node_modules/@dimforge/rapier3d-compat/rapier.mjs --out=/tmp/native-api.json
node tools/sim/experiments/native_elbow_probe.mjs --module="$ENGINE_RESEARCH_ROOT/rapier.js/rapier-compat/builds/3d/pkg/rapier.mjs" --calibration=/tmp/native-api.json --out=/tmp/native-elbow.json
```

다음은 [같은 누움·기립 인계](recovery_handoff_round5.md)에서 k=d=0인 upright 모터를 **관절 삭제 없이 enabled bit만 끄는** 대조다. 과거 제거/재생성의 solver 이력 혼입을 줄이고, 목표·발 접촉·다리 도달 거리·회복 결과를 함께 확인한다. 그 뒤 다리 native 축별 한도와 손/무릎→발 지지 인계를 결합한다. 마지막 substep readback으로 fullstep native 일을 대신하지 않으며, P-01~P-06 전체와 일반판 승격은 계속 미완료다.
