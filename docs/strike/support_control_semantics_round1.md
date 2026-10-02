# 기립 제어의 실제 동작 재검증 — 2026-10-02

기준 소스는 `626729f6482e8b2270187e896e57b51eba9ba3df`다. 지지 연구판 공개 철회는 유지한다. 이번 작업은 동일한 낮은 누움 이후의 인과 대조와 native 모터 수명 관리 수정 후보이며, 기립 성공이나 재공개 판정이 아니다. 원본 저장소·상대 자료 조회 없이 우리 코드와 설치된 Rapier0.19.3을 사용했다.

[측정 지표·소스/원자료 해시](support_control_semantics_metrics.json).

## 1. 0 계수는 모터 비활성화가 아니었다

이전 실험의 `noUpright`는 native generic 관절을 제거하지 않고 회전3축의 강성/감쇠를0으로 설정했다. 같은 native snapshot의 고정 앵커+2kg 등방성 큐브 대조에서 이 설정은 첫 스텝의 각속도를2.177→약0rad/s로 만들었다. 실제 제거와 한 번도 모터를 설정하지 않은 관절은 자유 회전을 유지했다. 모터가 움직이던 상태에서도4.172→약0이었고, 새 관절을 만든 직후0을 설정해도 같았다. 기존 모터 이력만의 현상이 아니다. 무중력·무접촉·sleep 비활성의 이 fixture 자체에서는 발사나 양의 에너지 증가가 없었다.

따라서 이전의 “upright 제거가 발사를 만들었다”는 해석은 정정한다. **0계수 설정과 실제 연결 제거를 구별하지 않은 실험 해석 오류**였다. 현재 axial의 지지 없음 분기도 같은0계수 호출을 사용한다. 중력·질량이 계산되더라도 제어가 그 응답을 다르게 만들 수 있다는 구체적인 사례다. 전신 발사의 유일 원인을 확정한 것은 아니다.

```sh
node tools/sim/experiments/zero_motor_probe.mjs --out=/tmp/zero-motor.json
node tools/sim/experiments/upright_motor_candidate.test.mjs
```

`upright_motor_candidate.mjs`는 세 축 요청을 먼저 검증한 뒤, 끄는 축이 있으면 자유 generic 관절을 재생성하고 필요한 양수 축만 설정한다. 모두 끄면 제거하고, 모두 양수인 기존 제어는 같은 관절을 유지한다. native 시험에서 양수 제어360스텝의 기존 궤적 exact, 전체/부분 축 비활성, 움직이는 운동학 앵커에서도 자유 운동,50회 전환의 native 관절 개수0/1을 확인했다. 이는 메모리 누수 검사나 전신 기립 안정성 검사가 아니다. 재생성은 남은 축의 solver 이력도 초기화한다. helper는 아직 게임에 연결하지 않은 연구 후보다.

## 2. 같은 누움에서 제어를 분리했다

기존 `same_lying_recovery_probe`의 원판 전체 궤적과 checkpoint native/제어 해시 관문을 유지했다. 건강2.2초·편측 다리 .45 손상2.8초의 자연 누움에서만 개입을 켠다. 무기 longsword,seed7,B(.1/on/1),paired,legacy 준비3초,실제 `knockDown(true)`,각25초 관찰이다. 손상은 controller health 합성 조건이며 실제 검 상처 재현은 아니다. 같은 결정적 기준의 반복은 추가 독립 표본으로 세지 않는다.

| 개입 | 건강 재넘어짐 | 손상 재넘어짐 | 판단 |
|---|---:|---:|---|
| 기존 투영 축력(projected) | 0 | 3 | 이전 실패 재현 |
| 기립 보조 모터를 계속0계수로 설정 | 10 | 7 | 최고 골반47.86/18.77m·관절 간격21.61/32.73m, 기각 |
| 기립 보조 연결을 계속 제거 | 10 | 7 | 낮게 누운 채 회복 실패, 관절 간격.145/.171m, 기각 |
| 무접촉의0요청 때만 실제 제거/재생성 | 0 | 1 | 부분 개선이나 재넘어짐과 접촉 부재가 남음 |
| 관절 목표속도 항 제거 | 8 | 6 | 회복 실패, 기각 |
| 다리 stance gain을 지지 중 유지 | 0 | 2 | 부분 변화, 해결 아님 |
| checkpoint 이후 발 추가 질량 변경 금지 | 0 | 1 | 부분 변화, 해결 아님 |

무접촉 때만 보조 연결을 제거한 경우 손상 조건 최대 COM 상향속도1.192→1.004m/s·관절 간격3.434→2.223mm, 최종 관찰 기준(levH<=0)의 기립 보조 종료는18.967→12.075초였다. 그러나 최장 native 지면 접점 부재는.100→.142초로 늘었다. 건강 조건도.117→.142초로 늘었다. 재넘어짐 감소만 채택 근거로 삼지 않는다. 실제 연결의 제거/재생성 효과에는 solver 이력 초기화도 포함된다.

## 3. 다음으로 분리한 접촉 판단

기존 보행 코드는 기립 직후(`levH>0`) 발바닥 중심 높이가 높으면 발끝 접촉·실제 하중과 무관하게 발을 공중으로 판단할 수 있다. 손상 원판의5.983초 catch 시작에서 앞발 중심 높이.0578m, fresh support=true,raw normal force551N인데 cached gait N=0이었다. 지면을 누르고 있는 발을 다시 옮기는 사례다. 이것이 전체 회복 실패의 충분 원인인지는 별도 비교한다.

같은 checkpoint 뒤 실제 접촉도 확인하는 air 조건과0계수 회피 조합을 비교했다. 원본 그대로 복제한 Gait 모듈은 두 조건의 전체 궤적이 projected 대조와 exact였다. 접촉 air 수정도 projected 대조 궤적과 exact였으며, 조합은0계수 회피만 한 궤적과 exact였다. **이 장면에서는 효과가 없어 채택하지 않는다.** 추가 읽기 전용 계측에서 해당5.983초 앞발의 hip→plant 수평 거리가.667m로 기존 reach 기준도 동시에 초과했다. air 조건만 바꿔도 다른 OR 조건으로 catch가 시작됐다. 실제 접촉 판단 문제를 회복 실패 전체의 원인이라고 확대하지 않는다.

마지막으로 재사용 helper를 같은 전신 분기에 연결했다. 건강/손상 모두 단순한0계수 회피 대조와 전체 궤적 exact였다. 건강/손상 재넘어짐0/1, 각25초 끝의 연속 기립 기하 충족 구간은 별도 지표로 보존했다. 이 연결도 진단 도구 안에서만 실행한다. helper를 공개 게임에 활성화한 것이 아니다.

## 4. 계측 수정과 판정 한계

`same_lying_recovery_probe`의 `detailedSlip()`가 정의만 있고 호출되지 않았던 누락을 연결했다. 이전 `filteredSlip`의0표본/null은 미끄럼 없음의 증거가 아니다. 발사·재넘어짐 기존 기록은 별도 실제 측정으로 유지된다. 새로운 원판 전체 궤적은 이전 참조와 exact이므로 관찰 추가가 제어를 바꾸지 않았음을 확인했다.

`j.max`는 위치오차로 만든 근력 항만 제한하며 목표속도·감쇠와3축 총토크를 제한하지 않는다. 다만 gait 진입은 실제로 다리의 `prevRV`를 지우므로 “진입 첫 프레임의 다리 목표속도 급증” 가설은 기각했다. 전체 관절을 추가로 reset한 대조는 상체에도 영향을 주므로 다리 reset 결함의 증거로 쓰지 않는다.

유한값·종료코드0·최종 stand는 공개 합격이 아니다. 재넘어짐·기하 붕괴·무접촉 구간·에너지 극값·관절 간격·보조 종료 뒤 관찰을 함께 본다. 운동에너지 변화에는 발 질량/관성 변경이 포함되며 native 접촉/모터 일은 아직 직접 분리하지 못했다.

최종 원자료의 최초 요약은 보조 종료를 `levH>0`에서 정확히0으로 가는 전이로 찾았다. minJerk의 부동소수 오차로 한 스텝 약−2e−16을 거쳐 종료를 놓친 것을 발견해 `<=0` 관찰로 후처리했다. 원자료와 제어는 수정하지 않았고 재시뮬레이션도 하지 않았다. 최종 지표의 `finalNativeHelper`가 이 보정된 분석이며 원자료·분석 코드 해시를 함께 제공한다.

반복 비용: 첫 contactAir12행은 완료·보존했다. descriptor 복원 보강 뒤 불필요하게 시작된 두 번째 전체 반복은 결과 쓰기 전에 중단했고 부분 로그를 판정에 쓰지 않았다. 후속 native helper8행에서 새 관찰과 기존 원판 관문을 함께 확인했다.

## 재현과 보존

```sh
node tools/sim/experiments/recovery_control_probe.mjs --variants=projected,zeroUpright,removedUpright,noTargetVelocity,resetOnHandover --out=/tmp/recovery-control.json
node tools/sim/experiments/recovery_control_probe.mjs --variants=projected,safeUprightGate --out=/tmp/recovery-safe-gate.json
node tools/sim/experiments/recovery_control_probe.mjs --variants=projected,stanceCapacity,constantFootMass,safeGateStanceCapacity --out=/tmp/recovery-handover.json
node tools/sim/experiments/recovery_control_probe.mjs --variants=projected,cloneGait,contactAirborne,safeUprightGate,safeGateContactAirborne --out=/tmp/recovery-contact-air.json
node tools/sim/experiments/recovery_control_probe.mjs --variants=projected,safeUprightGate,nativeGate --out=/tmp/recovery-native.json
# 이미 기록된 원자료의 요약만 다시 계산한다. 물리 재실행 없음.
node tools/sim/experiments/recovery_control_probe.mjs --analyze=/tmp/recovery-native.json --out=/tmp/recovery-native-analysis.json
```

원자료는 파일당 수백 MB여서 저장소 밖에 보존하고, 소스 해시·실행 명령·압축 지표와 원자료 해시를 저장소에 남긴다. 공개 게임은 기존 legacy 지지·paired 그립·한손 자세 수정 상태를 유지한다.

다음 과제는 낮은 자세에서의 지지 영역과 체중 이동을 먼저 맞추고 보행 계획으로 넘기는 회복 제어다. 현재 stand 진입 시 양발의 hip→plant 거리가 이미 .87/.71m인 상태에서 catch가 반복된다. 관찰 높이 문턱만 붙여 getup에 가두는 이전 실패를 반복하지 않는다. 관절 실제 총토크 한계, 누운 자세의 손/무릎 접촉, 몸 중심 이동과 발 재배치를 함께 설계한다.
