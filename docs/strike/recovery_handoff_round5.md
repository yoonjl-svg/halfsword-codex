# 회복 목표 인계와 초기 upright 경로 — 독립 연구 5차

**목표 quaternion의 첫 점프는 확인했고 연속 목표로 줄일 수 있었다. 그러나 두 회복 후보 모두 채택하지 않았다.** 같은 기립 직전 상태의 추가 대조에서는 upright native 제약 경로가 첫 스텝 운동에너지에 기여했다. 이를 제거한0.35초 전체의 운동에너지는 오히려 더 커졌다. 첫 순간의 에너지 차이, 이후 지지·제동 역할, native 일의 미계측을 구별한다. 공개 게임 변경·새 회복 채택은 없다.

## 근거와 범위

기준은 `bc4c85d3ec2ef39835d69a70f5e195f72bde35ab`이며, 기존 같은 누움 runner를 건강/앞다리 controller health.45, seed7, longsword, B(.1/on/1), paired로25초 실행했다. 건강·손상은 실제 인간 부상 표본이 아니다. 원본 reference는 우리 저장소의 `b6483ea65f6ff4097b2386493ee9487f711527d4` archive다. 상대 자료 조회는 없다.

[후보](../../tools/sim/experiments/recovery_handoff_candidate.mjs)와 [도구](../../tools/sim/experiments/recovery_handoff_probe.mjs)는 연구용이며 실제 game source를 수정하지 않았다. Gait/Fighter source clone의 THREE·CONFIG 및 상대 imports는 원래 절대 모듈 URL로 연결했다. 변경 없는 clone과 후보 메서드는 `ledger.replaceObservedMethod`로 관찰 wrapper 안의 실제 dispatch를 교체했다. source 내 update counter와 applyPose/updateState 호출 증거를 함께 확인했다. 단순 prototype 교체를 실행 증거로 쓰지 않았다.

유효 첫 행렬 `recovery-handoff-r2`는65.46초,6행(두 시나리오 × clone/targetBlend/contactPivot)이다. 건강·손상 original 전체 trace와 변경 없는 clone projected 전체 trace가 기존 reference에 exact였다. 각 후보는 동일 low-down native/controller/input checkpoint를 통과하고, 첫 stand 직전 native snapshot·명시 controller·body/goal 누적 prefix도 clone과 exact였다. 실행 중 source manifest도 동일했다. 기록한 commit과 파일별 해시를 구별하며 실제 실행 바이트·clone 해시는 [metrics](recovery_handoff_round5_metrics.json)에 보존한다.

| 유효 원자료 | SHA-256 |
|---|---|
| `recovery-handoff-r2.json` | `1f45665b1f2d5bea0b515eeaa55301704d201d739ad3505b894e0e4d17802993` |
| `recovery-handoff-upright-causal-r2.json` | `5d07a96c6d3869920a70f574ca558fab274d2b8f6f82e0c4aad9a35ff825c84e` |

원자료·summary·log·추가 분석 JSON은 `/workspace/halfsword-hybrid-evidence`에 있다. 각 파일의 크기·SHA·명령·소스 manifest는 metrics에 보존했으며 외부 백업이 확인된 것은 아니다. 이후 root의 별도 source 수정과 이번 실행 source를 섞지 않는다. source 검증 완료 뒤에만 root에 수정 가능한 시점을 알렸다.

## 실제 첫 인계 불연속

건강 첫 stand는4.216666666666667초, 손상 첫 stand는5.575초였다. getup에서는 상대각 기반 다리 목표를 만들고, stand에서는 `Gait.enter`가 두 발 모두 stance로 설정한 뒤 발마다2kg 추가 질량을 요청하고 `poseLegs`의 world-ankle IK로 전환한다. `resetRates`는6관절 목표속도 기록을 지운다. 원래 의도는 목표가 점프할 때 큰 feedforward를 억제하는 것이지만, 들어오던 목표 속도도 첫 stand에서0이 된다.

| 첫 stand 관찰 | 건강 | 손상 |
|---|---:|---:|
| 기존 최대 quaternion 목표 변화 | 0.71415rad | 1.12664rad |
| 들어오던 최대 목표 각속도 | 1.78889rad/s | 1.29694rad/s |
| 첫 stand native configured 목표속도 | 모든6관절0 | 모든6관절0 |
| targetBlend의 최대 첫 목표 변화 | 0.01491rad | 0.01079rad |
| targetBlend의 최대 configured 목표속도 | 1.78959rad/s | 1.29499rad/s |

손상 앞발은 인계 직전 실제 ankleY0.161618m에서 plantY0.062m로 바뀌고 x/z도0.101877m 이동했다. 건강 뒷발은 실제 ankleY0.122819m에서0.062m로 바뀌며 x/z가0.055347m 이동했다. 신선한 collectSupportContacts로 실제 지지를 별도 기록했다. Gait의 오래된 N/stance 값만으로 지지 여부를 선언하지 않았다.

**계측 정정:** r2 도구의 hip 위치 계산은 drop0.07m를 썼으나 실제 `Gait.sense`는0.04m다. r2의 hip 좌표 및 모든 파생 reach 값을 판정에서 제외한다. 새 도구는0.04m로 고쳤다. 기존 preStand checkpoint의 rigid-body pose·Gait side로 인계 전 거리도 별도 후처리 재구성했다. raw를 덮어쓰거나 추가 simulation하지 않았다.

| 정정된 인계 전 거리 | hip→plant | hip→실제 ankle |
|---|---:|---:|
| 건강 뒷발 | 0.92184m | 0.83992m |
| 손상 앞발 | 0.94803m | 0.83162m |

이 값은 첫 physics step **이전**의 상태다. physics 이후 또는 수평 reach 값과 혼합하지 않는다. 표의 plant 거리는 현재 기구학 다리 길이0.85m보다 길다. 실제 발목은 그 길이 안쪽인데 평평한 발 reference로 바꾸면서 더 멀어진다. 이는 목표 연속성만으로 낮은 자세의 지지 기하를 해결할 수 없다는 근거다.

## 두 목표 후보와 기각

`targetBlend`는 이전 목표 quaternion과 마지막 두 목표에서 측정한 incoming 회전속도를 시작 조건으로 사용한다.0.35초 동안 incoming 방향으로 이어지는 기준 목표와 매 프레임의 IK 목표를5차 smooth weight로 연결한다. 시작·끝의 weight 미분은0이며, 첫 목표의 finite difference를 유지하도록 enter에서 지운 prevRV를 복원한다. 요청 궤적을 정규화한 것이며 몸의 실제 각속도·속도·높이를 제한하지 않는다.0.35초는 연구용 전환 시간이고 생리 상수가 아니다. 움직이는 IK 목표의 모든 도달 가능성이나 실제 근육 토크 상한까지 보장하지 않는다. stand→getup 역방향 전환은 이번 후보가 평활화하지 않는다.

`contactPivot`는 실제 지원 contact patch에서 관찰한 pivot과 foot-local 위치, 현재 foot quaternion을 기록하고, 이를 기준으로 ankle/foot 목표의 rollout을 요청한다. 지지가 확인된 발만 적용하고 지지를 잃으면 해당 계획을 해제한다. 기존 mass·stance·IK·heelOff/toePivot·pinFeet 처리는 유지했다. 특히 ankle helper 뒤에 legacy heel/toe 보정도 실행되므로 정확히 pivot을 보존하는 최종 ankle 궤적이 입증된 것은 아니다. 추가 힘이나 물리적 contact 고정은 하지 않았다. 이 실행의 효과를 실패 후보로 기록하고 파라미터/보정 순서 튜닝으로 확장하지 않았다.

아래는 첫 stand 뒤25초 관찰 종료까지의 극값과 confirmedSupportPoints slip이다. 그 사이 다시 getup이 된 프레임도 포함되며 정상 보행만의 통계가 아니다. native 실제 모터 토크는 미계측이고 configured k/d/목표/목표속도 및 `k*(configured target−current rotvec component)` proxy만 기록했다. 이 proxy는 solver 전달 토크가 아니다.

| 후보 | 재넘어짐 | 최고K J | 최고골반 m | 최대gap mm | support slip 평균 / P95 m/s |
|---|---:|---:|---:|---:|---:|
| 건강 clone | 0 | 84.12 | 0.98218 | 2.450 | 0.00500 / 0.00251 |
| 건강 targetBlend | 0 | 222.94 | 1.02453 | 3.241 | 0.00409 / 0.00158 |
| 건강 contactPivot | 0 | 171.57 | 1.00791 | 2.013 | 0.00396 / 0.00215 |
| 손상 clone | 3 | 291.67 | 0.93926 | 3.434 | 0.05302 / 0.23962 |
| 손상 targetBlend | 2 | 330.88 | 0.97849 | 4.569 | 0.03856 / 0.08820 |
| 손상 contactPivot | 2 | 396.20 | 0.89209 | 2.725 | 0.03440 / 0.04475 |

목표 점프와 일부 slip이 줄어도 에너지·관절 gap·재넘어짐을 함께 해결하지 못했다. 두 후보 모두 기각했다. 손상 첫 재넘어짐은 clone6.216667초, targetBlend6.225초, contactPivot6.191667초였다. 반복 gain/시간 파라미터 검색이나 관찰용 stand 진입 문턱 조정은 하지 않았다.

## 첫0.35초 upright 직접 분리

질량 고정의 실제 dispatch/질량 불변 대조는 [3차](support_motor_limits_round3.md)에서 이미 검증했으므로 반복하지 않았다. 대신 같은 r2 건강·손상 clone을 기준으로 **새2분기만** 실행했다. 즉 기존2대조와 새2분기의4 matched 비교이며4개의 독립 인간 표본이 아니다.

`uprightOff`는 첫 stand 직전 native/controller/prefix exact를 확인한 후 upright native joint만 실제 제거한다. 다음42 physics step의126 motor 요청을 억제하고 원래 free generic joint와 ForceBased 모델로 재생성한다. k=d=0을 configure하여 제거했다고 부르지 않는다. 첫 제거가 body pose/velocity/mass를 바꾸지 않는 관문도 통과했다. 발 질량 변경과 목표는 그대로다. clone source hash·실행 의존 source hash는 r2와 exact였으며 sourceStable이었다. causal-r2 실행은18.97초, 두 행의 모든 관문 통과였다.

첫 스텝에는6관절 native 요청·quaternion 목표·massChanges·명시적 net force와 모든7 source path의 force/torque 벡터가 두 경우 exact였다. 원래 제어/상태·직접 작용 입력이 같은 조건에서 upright 제약 경로 하나를 바꾼 대조다.

| 첫 physics step | 유지K | 실제 제거K | 유지−제거 |
|---|---:|---:|---:|
| 건강4.216666666666667초 | 22.27082J | 16.59949J | 5.67132J |
| 손상5.575초 | 16.39659J | 15.79749J | 0.59910J |

그 직전 K는 각각2.73005J,1.70166J였다. **upright native 제약 경로가 첫 결합 에너지 응답에 기여한다는 직접 근거**다. 제거 후에도 상당한 K 증가가 남는다. 위 차이는 upright 모터 자체의 정확한 공급 일이 아니다. 제약 제거에 따라 다른 native 모터·접촉의 solver 응답도 달라지며 native 전달 토크·일은 JS API에서 측정하지 않았다.

첫42스텝은 건강4.216667–4.558333초, 손상5.575–5.916667초다. 아래 ΔK/ΔE는 공통 인계 직전 상태부터 창 마지막까지이며 ΔE=`Δ(K+9.81·mass·COM.y)`다. 창 중 질량 변화가 포함되므로 고정질량 폐쇄계 장부라고 하지 않는다.

| 창 누적 | 건강 유지 | 건강 제거 | 손상 유지 | 손상 제거 |
|---|---:|---:|---:|---:|
| ΔK J | 58.792 | 173.558 | 125.359 | 206.872 |
| ΔE J | 81.972 | 15.941 | 9.565 | 10.780 |
| 명시적 힘·토크 signed work 근사 J | 29.140 | −85.309 | 52.253 | 67.646 |
| 확인된 group 상향 normal impulse N·s | 385.227 | 169.764 | 265.751 | 207.048 |
| 모든 몸 raw ground normal impulse N·s | 386.851 | 170.145 | 270.245 | 229.236 |
| 측정 group support 없는 step | 0 | 4 | 0 | 0 |

명시적 일은 force ledger의 midpoint 속도 근사이며 native 모터/접촉 일과 다르다. 지원 group은 foot/shin/빈손 forearm proxy이고 모든 몸의 지면 접촉을 대변하지 않는다. normal impulse를 접촉 일로 바꾸거나 운동량 residual을 에너지 공급량으로 부르지 않는다. 같은 첫 힘 입력이라도 첫 physics 결과의 속도가 달라지면 midpoint 일 근사도 달라진다.

upright 제거의 창 ΔK가 더 크지만, 건강 제거의 위치에너지는 약157.62J, 손상 제거는 약196.09J 감소했다. 건강 전체 창 ΔE는 오히려 감소했으며 손상 ΔE는 비슷했다. 이후에는 접촉·질량·다른 제어 입력도 달라지므로 창의 차이를 upright 일 하나로 배분할 수 없다. 전체25초에서는 건강 재넘어짐0→1, 손상3→2이며 새로운 회복 채택 근거가 아니다.

**다른 시점의 반례도 유지한다.** 3차의 손상 catchLoad6.433333초 matched 상태에서는 기존0계수 upright 유지 다음K70.627J 대 실제 제거24.205J,6.491667초에는3,456.561J 대14.980J였다. 그 늦은 폭주 직전 대조와 이번 실제 기립 인계 대조는 상태·요청 계수·접촉·목표가 다르다. “upright를 언제나 제거하면 해결된다”거나 “upright는 언제나 에너지만 공급한다”로 일반화하지 않는다.

## 미완료 자료와 다음 판단

`recovery-handoff-diagnosis`는 checkpoint activate 전에도 afterStep이 호출되는 것을 놓친 계측 오류로7.67초에 중단했다. `recovery-handoff-upright-causal`은 afterStep에 ledger 인자가 전달된다고 잘못 가정해1.73초에 중단했다. 두 자료는 개입 전 실패이며 물리 판정에서 제외하고 raw/summary/log를 보존했다. 오류를 고친 r2/causal-r2만 사용했다.

다음은 이 자료가 남긴 도달 불가능한 flat plant와 실제 접촉의 가동 방향을 고려해, 낮은 자세에서 손·무릎·다른 발로 하중을 옮긴 뒤 발을 재배치하는 전신 경로를 설계하는 일이다. 목표 quaternion 보간만으로 지지 기하가 맞아지지 않으며, native 에너지 기여와 제동 기능도 같은 상태에서 분리해야 한다. 지난 bounded 근력 실패를 다시 반복하지 않았다. 몸통→검 전달·중력·관성·제동·충돌·모바일 체감의 전체 해결 목표는 계속 유지하고, 이번 부분 측정을 전체 물리나 인간 자연스러움의 완료 판정으로 바꾸지 않는다.
