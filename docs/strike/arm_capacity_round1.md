# 팔 actuator 한도·힘 전달 연구 1차

기존 어깨·손목 swing 한도 뒤에 붙는 twist 토크가 전체 명시적 actuator 한도를 넘는 경로를 확인했다. finalCap은 이 명시적 벡터 전체를 기존 한도 안으로 제한했지만, 손 목표 오차와 일부 속도·입력 종료 응답이 후퇴했다. **이 연구 실행 단계에서는 일반·공개 게임에 연결하지 않았다. 이후의 실제 코드 통합·배포 상태는 [선택형 비교 기록](arm_capacity_trial.md)을 따른다.** native 팔꿈치 모터를 자유 두 강체 implicit PD로 교체하는 후보는 채택을 기각한다. 전체 전신 물리 목표는 열려 있다.

기준 commit은 `bc4c85d3ec2ef39835d69a70f5e195f72bde35ab`다. 보고서의 `pass`는 복제·계측·상태 보존·수치 검증 관문 통과이며 인간 동작이나 제품 채택 판정이 아니다. 이 문서 작업은 신규 Markdown/JSON 두 파일만 작성했다.

## 범위와 대조

- 정상 60행 + armWeak 60행: sabre/zweihander × down/up/cross × release/target_hold × baseline/clone/finalCap/portHill/combined. seed 7, 준비 3초, stroke 0.55초, 종료 후 1.2초, dt=1/120초. 같은 stroke를 두 종료 조건으로 이어가는 행과 clone 반복을 독립 표본으로 세지 않는다.
- armWeak는 동일 준비 checkpoint에서 **armS=.15만** 설정했다. 상처·damage·실제 부상 재현이 아니다.
- 실제 G.step/native bodies를 실행했다. 준비 그립과 지지는 legacy, 측정 구간 그립은 paired다. 상대 접촉이 없는 scripted stroke이며 실제 결투·모바일 체감 검증은 포함하지 않는다.
- finalCap은 어깨/손목의 기존 swing cap을 appended twist까지 포함한 **각 명시적 actuator 최종 벡터**와 공유한다. 근력·gain·목표·반작용 방향을 증량하지 않는다. native elbow/spine/offarm 모터와 offhand spring을 합친 생리학적 총 팔 한도가 아니다.
- portHill은 손목의 실제 전완/가슴 반작용 수신자 속도로 Hill 입력을 계산한다. combined는 finalCap+portHill이다. 후퇴가 있어 finalCap-only와 분리한다.

각 정상/armWeak 행은 준비 native/control/input exact, 설정 직후 native/control exact 및 실제 driveSword/manualMuscle dispatch를 확인했다. 각 12 baseline 관찰 대조와 12 clone은 전체 trace exact다. 진단이 있는 각 48행은 callback errors 0이며 실제 dispatch가 실행됐다. 기존 소스의 before/after SHA는 정상·armWeak 각 63파일, elbow 65파일에서 일치한다. 전체 manifest와 각 행 trace/input SHA는 [metrics](arm_capacity_round1_metrics.json)에 보존했다.

## 실제 토크·power 계측

진단 최종 토크와 force ledger의 실제 addTorque 입력은 모든 정상/armWeak/elbow 행에서 벡터 차이 0, 수신자별 torque·angular velocity로 계산한 순간 power 차이 0이다. 정상 명시적 반작용 합의 최대 잔차는 3.39e-15Nm, 순간 power 항등식 잔차는 2.28e-13W였다. 이는 JS 호출 입력의 폐합이며 native Float32 누산과 solver 전체 work의 폐합을 주장하지 않는다.

clone은 원본과 trace exact이므로 다음 원본 경로의 계측 대조로 사용했다. 초과는 capRatio > 1+1e-9로 집계했다. baseline에 진단이 없다는 이유로 capRatio=0이라고 해석하지 않는다.

| 조건·무기 | clone 어깨 최대 ratio | clone 손목 최대 ratio | finalCap 어깨/손목 초과 호출 |
|---|---:|---:|---:|
| healthy sabre | 1.565460 | 1.000252 | 0 / 0 |
| healthy zweihander | 1.183018 | 1.088512 | 0 / 0 |
| armWeak sabre | 1.324585 | 1.000222 | 0 / 0 |
| armWeak zweihander | 1.514672 | 1.971065 | 0 / 0 |

정상 sabre 어깨 최대 1.565460, zweihander 손목 최대 1.088512로 기존 swing cap을 넘었다. finalCap/combined는 양 조건 모두 초과 0이며 raw 최대 1.0000000000000004는 double 반올림 오차다. portHill만으로 최종 벡터 한도를 보장하지 못한다.

## 속도·목표 오차·종료 응답

아래는 각 12개 조건/종료 조합에서 baseline 대비 차이다. 속도 저하·오차 증가·종료 후 travel 증가를 모두 남겼다. 개수는 동일 stroke 종료 분기가 포함된 행 수이며 독립 표본 수가 아니다. travel 증가만으로 제동 실패를 확정하지 않는다.

| 조건 | 후보 | stroke 속도 낮은 행 /12 | 손 오차 큰 행 /12 | 종료 후 travel 큰 행 /12 | Δstroke 속도 범위(m/s) | Δ최대 손 오차 범위(m) | Δ종료 travel 범위(rad) |
|---|---|---:|---:|---:|---:|---:|---:|
| healthy | finalCap | 6 | 12 | 3 | -0.571 ~ 0.601 | 0.0005 ~ 0.0133 | -0.172 ~ 0.241 |
| healthy | portHill | 6 | 8 | 6 | -1.100 ~ 0.207 | -0.0016 ~ 0.0041 | -0.103 ~ 0.147 |
| healthy | combined | 4 | 10 | 3 | -1.414 ~ 0.453 | -0.0004 ~ 0.0148 | -0.153 ~ 0.206 |
| armWeak | finalCap | 8 | 12 | 7 | -0.724 ~ 0.073 | 0.0013 ~ 0.0263 | -0.080 ~ 0.154 |
| armWeak | portHill | 10 | 6 | 9 | -0.599 ~ 0.153 | -0.0022 ~ 0.0027 | -0.021 ~ 0.124 |
| armWeak | combined | 8 | 12 | 7 | -1.106 ~ 0.133 | 0.0025 ~ 0.0244 | -0.042 ~ 0.304 |

정상 finalCap은 12행 모두 최대 손 목표 오차가 커졌고, armWeak에서도 12행 모두 커졌다. 정상 sabre down/release는 stroke peak 15.563→16.164m/s지만 손 오차 0.3005→0.3112m, 종료 후 travel 1.762→1.998rad로 늘었다. armWeak zweihander cross/release는 13.629→12.905m/s, 손 오차 0.5265→0.5528m, travel 2.481→2.636rad였다. 속도 증가만 선택해서 개선을 선언하지 않는다.

`strokePeakTipMps`는 active stroke, `wholePeakTipMps`는 stroke+종료 후 구간이다. 예컨대 정상 sabre up/release finalCap은 stroke 11.215m/s인데 전체 peak는 12.915m/s다(원본 stroke 11.786, 전체 12.852). 전체 peak만 쓰면 stroke 속도 후퇴가 가려진다. metrics는 두 peak와 phase, after_input 표본 peak를 별도로 보존한다. release도 제어기가 계속 작동하며 target_hold와 함께 자동 복귀·필터·목표 변화를 기록했다. 자유 비행이나 강제 각속도 제동 시험이 아니다.

선택한 driveSword/manualMuscle/elbowGravity 경로의 signed work는 segment midpoint 근사다. 양/음의 경로 순 work와 body별 분배를 stroke/after_input별로 보존했으며 **total muscle work라고 부르지 않는다.** native 관절·제약·다른 actuator work는 빠져 있다. sabre의 offHandGap은 비파지 손과 pommel 사이 거리이므로 grip 결함 지표로 쓰지 않는다. zweihander의 실제 관절 anchor gap/slip은 별도 수치다.

## 팔꿈치 후보: 기각

건강한 down/target_hold 10행은 두 무기 × baseline/elbowObserve/elbowRecreate/elbowBounded/combinedElbow다. farmS native hinge만 같은 anchor/frame/limit로 재생성했다. observe는 원본을 그대로 전달했고 두 무기 trace exact다. recreate-only는 native motor/기존 FF를 유지하지만 solver 이력을 잃으므로 원본과 trace가 달라진다. bounded는 native 모터를 never-configured로 재생성하고 실제 configure 입력 tz/vz/k/d와 j.max×mus를 받아 implicit PD+기존 gravity FF를 합친 뒤 한 번 제한했다. 원래 elbowGravity dispatch를 대체해 FF 중복을 막고 부모/자식에 ±torque를 적용했다.

free-pair 식은 λPD=[k(tz−θ)+(d+dt·k)(vz−ωrel)]/[1+a(dt·d+dt²·k)]이며 기존 명시적 FF는 분모 밖에 더한다. inherited Hill은 기존 위치 clipping tz에만 있다. 감쇠/FF 전체의 힘-속도 교정이나 결합 native solver와의 동등성을 주장하지 않는다.

| 무기 | 후보 | stroke peak(m/s) | 최대 손 목표 오차(m) | 종료 travel(rad) | elbow cap 최대 ratio |
|---|---|---:|---:|---:|---:|
| sabre | baseline | 15.563 | 0.3005 | 0.712 | — |
| sabre | elbowObserve | 15.563 | 0.3005 | 0.712 | — |
| sabre | elbowRecreate | 15.611 | 0.3025 | 0.743 | — |
| sabre | elbowBounded | 13.299 | 0.4100 | 0.768 | 0.276478 |
| sabre | combinedElbow | 12.101 | 0.4132 | 0.839 | 0.275003 |
| zweihander | baseline | 16.932 | 0.4322 | 0.972 | — |
| zweihander | elbowObserve | 16.932 | 0.4322 | 0.972 | — |
| zweihander | elbowRecreate | 17.218 | 0.4259 | 0.989 | — |
| zweihander | elbowBounded | 12.102 | 0.4404 | 0.907 | 0.310886 |
| zweihander | combinedElbow | 11.866 | 0.4488 | 0.935 | 0.309392 |

elbowBounded는 recreate-only 대비 sabre 15.611→13.299m/s, zweihander 17.218→12.102m/s로 낮아지고 손 오차도 둘 다 커졌다. cap ratio는 각각 0.276478/0.310886으로 한도에 도달한 호출 0이다. 따라서 약화는 포화된 torque cap의 효과로 설명할 수 없고 **native 결합 solver를 자유 두 강체 근사로 대체한 영향**으로 분리한다. combinedElbow도 속도/손 오차 후퇴가 남아 채택하지 않는다. 종료 travel은 sabre에서 증가·zweihander에서 감소해 일괄 개선이라고 부르지 않는다.

8개 설치 행은 native body/control 보존 및 actual intercept/forwarding/actuator dispatch 관문을 통과했다. bounded/combinedElbow 각 210 configure 입력을 가로채고 native forwarding 0, paired actuator 210회다. 설치 복구는 wrapper를 해제하지만 재생성 관절과 잃은 solver 이력을 복원하지 않는다. 별도 fixture의 실제 단일 longsword stroke에서도 observer trace exact·상태 보존은 통과했으나 cap에 닿지 않고 손 오차가 후퇴했다.

## 재현·원자료 보존·미검증

어깨/손목 fixture 4그룹과 elbow fixture 6그룹은 모두 pass다. 후자는 실제 Rapier Float32 절대+상대 tolerances(torque 2e-3, angular momentum 4e-6, native scalar 3e-6), native tz/vz·prevRV reset·Hill 위치 clipping·FF disabled state·paired 반작용을 검증했다. fixture sourceStable은 각각의 기록된 파일 집합에만 적용하며 elbow 자체 2파일 동결 SHA는 별도로 metrics에 보존했다.

healthy/armWeak 실행 당시 probe SHA는 bbbb5923…, elbow는 guard를 강화한 0b69cc18…이다. 이는 의도한 검증 단계 차이다. 각 run의 sourceBefore/After 전체를 보존했고 하나의 현재 probe SHA로 과거 실행을 대표하지 않는다. 아래는 원자료를 덮지 않는 재현 예시다. 실제 사용한 전체 명령은 metrics에 기록했다.

```sh
node tools/sim/experiments/arm_capacity_probe.mjs --out=/tmp/arm-capacity-round1-rerun.json
node tools/sim/experiments/arm_capacity_probe.mjs --conditions=armWeak --out=/tmp/arm-capacity-weak-round1-rerun.json
node tools/sim/experiments/arm_capacity_probe.mjs --weapons=sabre,zweihander --directions=down --endings=target_hold --variants=baseline,elbowObserve,elbowRecreate,elbowBounded,combinedElbow --out=/tmp/arm-elbow-smoke-rerun.json
node tools/sim/experiments/arm_capacity_candidate.test.mjs /tmp/arm-capacity-tests-rerun.json
node tools/sim/experiments/elbow_actuator_candidate.test.mjs /tmp/elbow-actuator-tests-rerun.json
```

| 원자료(저장소 밖) | SHA256 앞 12자리 |
|---|---|
| arm-capacity-round1.json | 0af7fa50f37c |
| arm-capacity-round1.summary.json | bf85f8705249 |
| arm-capacity-weak-round1.json | fdd156f664fa |
| arm-capacity-weak-round1.summary.json | d6221bb02b41 |
| arm-elbow-smoke.json | 5cac0c1612a1 |
| arm-elbow-smoke.summary.json | e292c8b5e616 |
| arm-capacity-candidate-tests.json | c1ab2da703fc |
| elbow-actuator-candidate-tests.json | 7e176da765d4 |
| elbow-actuator-candidate-summary.json | c9bf80c7c48a |

전체 SHA256·byte수·설정·130행 수치·selected-path work·trace/input hash는 [arm_capacity_round1_metrics.json](arm_capacity_round1_metrics.json)에 있다. 원자료 디렉터리는 `/workspace/halfsword-hybrid-evidence/`이며 이 문서 작성 중 원자료를 변경하지 않았다. elbow 첫 실패(Float32 축 길이/optional detached state fixture)는 elbow fixture 요약이 가리키는 별도 실패 원자료와 해시로 보존했다.

후속은 finalCap-only sharedCap 선택형 비교 설계와 실제 양쪽 AI 결투 16회다. 본 보고서에는 그 후속 결과를 포함하지 않았으며 실행·성공을 선언하지 않는다. 실제 부상·피로·접촉·사용자 모바일 체감·전신 근력/관성/제동·기립·damage 모델과 생리학적 한도는 미검증이다.
