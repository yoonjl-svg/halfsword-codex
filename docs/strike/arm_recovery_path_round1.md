# 같은 회복 상태의 팔 활성 경로 분리 · 1차

2026-10-03 20:08 KST. **측정8실행은 유효하지만 팔 회복 후보의 공개·일반 승격을 계속 보류한다.** 실제 피격 뒤 회복 장면에서 검 추종/주팔 관절/중력 보상의 활성 소비를 분리했다. 같은 상태의 세이버 반례에서는 활성 소비를 모두 기존 수준으로 되돌려도 큰 검 방향 오차가 거의 그대로이며 뒤의 K는 오히려 높았다. 단순 활성 증량·감소를 해결책으로 채택하지 않는다.

[원자료·소스·재현 집계](arm_recovery_path_round1.json)는 최초6실행 소스 `601dec3`와 추가2실행 `62dd47d`를 분리한다. 이전 [생성부터 실제 전투1차](arm_recovery_from_spawn_round1.md)의 수령 raw를 재생 기준으로 썼다. 추가 물리 후보·게임 기본값·URL/UI 변경은 없다.

## 설계와 실제 개입

실제 harness의 Fighter/AI/Combat/게임 npm Rapier0.19.3으로 independent를 생성부터 켠 이력까지 재생했다. 모든 방식은 분기 전 native/full controller/기록 사건/요청·실제 손 패드가 exact이며 같은 분기 상태에서 시작한다. **관찰용 clone·전체 게임 상태복제·건강/pose/velocity 주입·AI 정지 없이 원메서드를 한번씩 호출한다.**

- **full:** 모든 주팔 경로가 원래 independent 필터값을 소비.
- **검 추종 ordinary:** `driveSword` 호출 중만 ordinary muscle을 소비. 손 목표·IK .12 gate·손목 cap/Hill/감쇠·중력·반작용을 포함하므로 순수 손목이라고 부르지 않는다.
- **관절 ordinary:** `driveJoints`와 `elbowGravity` 호출 중만 ordinary muscle을 소비. 주팔 어깨/팔꿈치 요청과 중력 보상이며 다른 다리·몸통 근육은 변경하지 않는다.
- **all ordinary:** 위 세 소비 경로를 함께 되돌린 진단. **생성부터 legacy인 게임이 아니다.**

메서드 안에서만 flag를 잠깐 legacy로 읽고 finally에서 복원한다. 원래 `step`은 independent 상태로 WeakMap 필터를 계속 갱신한다. 필터 읽기값이 호출 전후 exact이고 완결step flag 복원·대상별 매 step1회 호출을 검사했다. 실제 소비값과 미사용 잠재 필터값은 따로 센다. 게임 소스·gain·strength·상처·기존 입력·반작용 수신체는 유지한다.

실제 `addTorque`의 최종 벡터·수신체·pre-solver 각속도/순간 power와 팔꿈치 native 모터 요청을 읽었다. `debug.wristTorque`는 twist 추가 전이므로 최종토크와 분리한다. 토크 수신체 합은 반작용 보존 잔차이며 근력 예산이 아니다. native 모터 설정은 요청, last-substep 접점 속도/충격량은 readout으로만 해석한다. 전체 native 일·COP·개별점 하중을 측정했다고 하지 않는다.

## 장면1 · 실제 주팔 피격의 회복·요청0

팔쉬온seed7, 피격 뒤 `getup` 중 처음 요청이 움직임→잡고 유지로 바뀌는13.208333초에 분기했다. 주팔 건강은**.952651**로 경미한 실제 상처이며 심한 팔 부상 대조가 아니다. 분기 필터값 .600023, ordinary muscle .340175였다. 4방식×.5초60step와 full/all 관찰off 반복2, 총6실행이다. 요청 변화의 수치상0 허용오차는1e-12m, 경계 잔여값은9.992e-16m이고 요청/실제 패드는 모든 짝에서 exact다.

첫step의 검 목표·어깨/팔꿈치 목표는 같고 모든 IK .12 gate가 통과했다. 검 추종 경로만 되돌리면 손목cap11.538→6.574Nm지만 실제 적용검토크 norm은 약1.213→.976Nm로 두 cap보다 작았다. 관절 경로만 되돌리면 어깨 요청max46.411→26.471Nm, 실제 어깨토크 norm10.980→5.830Nm, 팔꿈치 stiffness232.054→132.354가 바뀐다. 따라서 이 첫step은 손목cap 포화 문제의 증거가 아니며 활성 변화가 여러 제어 요청을 바꾼다는 사실을 확인한다.

| .5초 공통 실제 부상회복60step | full | 검 추종 ordinary | 관절 ordinary | all ordinary |
|---|---:|---:|---:|---:|
| 평균 손 오차(m) | .09637 | .09637 | .10054 | .10054 |
| 평균 현재 검 방향 오차(rad) | .01559 | .01516 | .01533 | .01498 |
| 최대 검 K(J) | 1.0926 | 1.0872 | 1.0766 | 1.0711 |
| 최대 발 solver점 수평속도(m/s) | .024006 | .024013 | .023943 | .023946 |
| 최대 관절/그립 gap(mm) | .2583 | .2584 | .2560 | .2561 |

이 장면에서는 앞선 큰 발 접점 속도 후퇴가 재현되지 않았다. 미세 속도차를 loaded-foot slip이나 개선 수락으로 바꾸지 않는다. 실제 경로별 추가 활성 노출은full(60/60/60), 검ordinary(0/60/60), 관절ordinary(60/0/0), all(0/0/0)이다. 잠재필터는 all에도 계속 존재하며 실제 소비 노출0과 구분했다.

## 장면2 · 알려진 세이버 방향 오차 반례

이미 기록된 세이버seed19 healthy-arm getup의 cross→hold 경계11.8초에서 full/all을2회 더 비교했다. 분기 팔 건강1, 필터 .611179/body .376583이다. 빈팔 건강 .73185와 다른 상처는 보존되어 있으므로 몸 전체가 건강한 장면이 아니다. **실제 회복 장면이지만 주팔 부상 효능 검사가 아니다.** 두 방식 첫 토크 요청은 다르고, full의 최초 검cap·최종검토크는14.860Nm, all은9.223Nm이다. 어깨 실제토크 norm33.271→21.200Nm로 줄었다.

| .5초 회복60step | full | all ordinary |
|---|---:|---:|
| 평균 손 오차(m) | .12149 | .12723 |
| 평균 현재 검 방향 오차(rad) | .98237 | .98122 |
| 최대 검 K(J) | 4.2053 | 5.5607 |
| 최대 신체+검 K(J) | 6.4497 | 7.5998 |
| 최대 발 solver점 수평속도(m/s) | .28902 | .29630 |
| 최대 관절/그립 gap(mm) | .5281 | .3882 |

활성 소비를 되돌리는 것만으로 약1rad 방향 오차가 풀리지 않았다. 후반 K는 all에서 더 크므로 ‘증량이 K를 키웠다’거나 ‘감량이 제동을 개선했다’고 해석하지 않는다. **두 장면 모두 `wristBrake` latch 진입0회**다. 기존 aimDamping 등 감쇠·토크가 작동하지 않았다는 뜻은 아니다. 실제 검 추종 토크의 `T·omega_sword`가 음수인 frame도 full25/all29개다. 이는 검에서의 pre-solver 순간 power이며 전체 근육 일·native 제동 일은 아니다. 요청 변화량은0이지만 기록된 `|prevAim×currentAim|/dt`의 최초/최댓값은2.556rad/s다. 이는 clamp/검축 투영 전 목표변화율이므로 최종 wAim이나 blade의 toward와 동일하지 않다. 사용자가 입력을 멈춘 시점에 실제 목표도 즉시 정지했다는 전제가 성립하지 않았다. cap/Hill/목표각속도·release/latch 조건과 현재 관절/검 응답의 관계가 다음 질문이다.

## 직접 기전 창과 전체 장면 효과

기록된 strike/clash prefix가 달라지는 첫step은 팔쉬온1600tick/13.341667초, 세이버1430tick/11.925초다. 짝의 같은 기록 사건 창은15step/.125초와14step/.116667초로, 사전에 제안한24step/.2초 지속 기전 창을 확보하지 못했다. **첫 dispatch/첫 물리 응답의 동일 상태 대조는 유효하지만 지속 제동의 직접 원인은 아직 미확보**다. 지속 solver 지면접촉은 콜백 전에 이미 달라질 수 있으므로 콜백일치로 같은 지지기하를 보증하지 않는다.

같은 상태·입력·결정적 AI에서 후보가 만든 후속 AI/접촉 변화는 전체 게임 효과의 매개경로다. 따라서 .5초 표는 전체 국소 장면의 회귀로 보존하되 동일 상처의 순수 근육 효과나 사람 성능·다른 전투의 효능으로 일반화하지 않는다. 두 짧은 기전창과 .5초 회귀를 혼합하지 않는다. 어떤 방식도 죽거나 낙검하지 않았고 공통 회복60step을 확보했다.

## 검증·재현·다음 행동

- 두 실행에서 소스/HEAD 동결, 수령raw SHA·원래core/엔진/probe 해시 일치, 모든 분기prefix exact, full의분기후 원본재생 exact를 확인했다.
- 장면1은 full/all의 선택적 관찰off와 native/controller/input/events/길이/호출수가 exact다. 장면2의 새 observeroff는 수행하지 않았다.
- 집계는 각 raw의 보존 Git 커밋 객체/설치npm 해시와 기록 native/controller trace를 다시 계산했다. 최초 집계의 exact0단언은 경계 잔여값 때문에 중단되어 물리를 다시 돌리지 않고 명시적 수치오차로 정정했다. 실패/정정 기록을 raw 밖에 보존한다.
- 독립 읽기 감사가 첫step 목표/수신체각속도·실제소비/요청·원자료의 매step1회호출/필터복원과 주요평균/peak/직접창을 재계산해 일치를 확인했다. 총 실행 wall90.076초는 설계·감사·배포 시간이나8개 독립 부상 표본이 아니다. 원자료15,657,618bytes/SHA `a2a0d96f783b0508eaf386fe20328913b4dc1dbea741a5fc1b9b6a63b44f6bef`, 추가5,824,198bytes/SHA `8d39dc950f6e7bccef6550c8eed1d2da641ae5cdcb7044eafa2d58ca9e282c49`를 Git 밖에 보존했다.

```sh
node tools/sim/experiments/arm_recovery_path_probe.mjs --out=/tmp/arm-path-wounded-new.json --reference=/실제수령경로/research-from-spawn/run-01.json
node tools/sim/experiments/arm_recovery_path_probe.mjs --case=healthyStop --out=/tmp/arm-path-healthy-new.json --reference=/실제수령경로/research-from-spawn/run-01.json
python tools/sim/experiments/summarize_arm_recovery_path.py --raw=/tmp/arm-path-wounded-new.json --out=/tmp/arm-path-summary-new.json
```

명령은 현재도구 재현용이고 당시raw의 정확한실행/소스는JSON을 따른다. 새출력만사용한다. 복제된 전체game snapshot을 저장/복원하는 도구가 아니다.

**다음 활성45–60분:** 같은 세이버hold 경계의 목표각속도·검/전완 상대각속도·toward/tgtSp·cap/Hill·release/latch 조건과 팔꿈치 요청→응답을 먼저 계측한다. 목표를 멈췄다고 가정하지 않고 yaw/몸통/thrust로 움직이는 목표와 관절 제약 반응을 분리한다. 공개보류·양손 제외를 유지하고, gain탐색·실패 지지/절삭 재시험·일반판 승격은 하지 않는다. native clean rebuild는 이 질문의 선행조건이 아니며 별도 재현성 과제로 남긴다. 새 물리 후보는 기전/회귀를 갖춘 뒤 선택형 공개를 판정하고, 메이저 일반 적용은 사용자 확인을 따른다.
