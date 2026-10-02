# 회복 자세별 관절 응답 4차

2026-10-02. **자세별 결합 응답은 크게 달랐다. 고정 gain이나 새로운 회복 제어는 채택하지 않았다.** 이번 측정은 자연스러운 누움→기립 경로에서 확보한 네 native 상태의 한 스텝 응답 검사다. 중력·관성·몸통에서 검으로 전달되는 힘·제동·충돌·모바일 체감이라는 전체 목표 중 회복 자세의 제약과 지지 인계를 조사한 부분이며, 전신 동작 해결 판정은 아니다.

## 근거와 재현

- 원자료 기록의 기준 커밋: `ca0809d098cbcb2b8526e94d0550ac526f3a9529`. 파일별 SHA-256과 실행 전후 manifest는 [metrics](recovery_joint_response_round4_metrics.json)에 보존했다. 커밋 표기와 별개로 실험 파일·의존 파일의 실제 바이트 해시를 기준으로 확인한다.
- 도구: [recovery_joint_response_probe.mjs](../../tools/sim/experiments/recovery_joint_response_probe.mjs). 도구 SHA-256: `43ce64bf4a01b053ed1b994e8d2dcdbf2a98c3e821b8cf9a1ff33338d2051af4`.
- 실행: `node tools/sim/experiments/recovery_joint_response_probe.mjs > /workspace/halfsword-hybrid-evidence/recovery-joint-response.log 2>&1`. 기존 결과 경로는 덮어쓰지 않는다. 재실행은 `--out=/workspace/halfsword-hybrid-evidence/새이름.json`과 별도 log를 쓴다.
- 실행 시간 28.01초, 종료 0, error 없음. 원자료 JSON·summary·log는 저장소 밖 evidence 디렉터리에 있고 아래 해시로 식별한다.

| 원자료 | SHA-256 |
|---|---|
| `recovery-joint-response.json` | `ac93531f24a7a7487ddfd52a63ceb1182791129bf0dcf1b236d221120ff09ab1` |
| `recovery-joint-response.summary.json` | `a61b2a85c1f908e2e166ee9f5bade36d4f9531b276c8c966431eb87e3ae4d840` |
| `recovery-joint-response.log` | `797ff98635d2575ecd336c4971d0d8031fa695eee5e33275fdd902799e31fd28` |

## native 상태와 검증 관문

건강·손상 시나리오 각각 기존 original의 전체 25초 trace를 먼저 검증했다. original 기준은 우리 저장소의 `b6483ea65f6ff4097b2386493ee9487f711527d4` archive이며 상대 자료가 아니다. 같은 낮은 down에서 projected로 전환하는 `expectedSwitch` native/controller 관문을 통과한 뒤, `activate`와 첫 실제 `stand`의 `afterStep`에서 snapshot만 저장했다. 상태 이름 `stand`는 관찰된 제어 인계 시점이며 인간다운 기립 성공 판정이 아니다.

| 시나리오·자세 | 회복 시작 뒤 timeS | 골반 높이 m | 가슴 tilt ° | 당시 uprightScale |
|---|---:|---:|---:|---:|
| 건강 낮은 down | 2.2 | 0.21536 | 86.8336 | 0.036250 |
| 건강 첫 stand | 4.216666666666667 | 0.74146 | 22.9209 | 0.366263 |
| 손상 낮은 down | 2.8 | 0.19621 | 103.0457 | 0.030861 |
| 손상 첫 stand | 5.575 | 0.54517 | 23.9949 | 0.068220 |

건강·손상 original trace는 각각 `dd37acfd…`, `87c3cb44…`, 관찰 snapshot을 추가한 projected trace는 각각 `b5153585…`, `83443272…`로 기존 전체 trace와 정확히 일치했다. 입력 hash와 switch hash도 일치했다. 네 상태 각각 복원 body exact, 재생성 body 보존, 관절 수 보존, 동일 입력 snapshot, 모든 분기의 시작 body/native exact, zero 재실행 exact, finite, 충격 직후 자유 pair 예측 일치, 다리 모터 미설정의 10개 관문을 모두 통과했다. source manifest도 실행 전후 동일했다.

측정은 저장한 snapshot의 **별도 복원 world**에서 진행했다. 여섯 다리 관절은 bounded helper의 설치 경로로 같은 anchor·frame·limit를 가진 native 관절로 재생성하고 모터를 한 번도 configure하지 않았다. 몸 자세·속도·질량은 그대로였다. 상체 모터와 upright는 각 snapshot에 기록된 native 설정을 유지했다. upright의 0계수/실제 제거 대조는 이번 범위에 없다.

모든 dynamic body의 user force/torque를 동일하게 초기화한 후 공통 응답 snapshot을 만들었다. 중력과 solver 설정은 유지하고 controller update 없이 native `world.step`을 한 번 실행했다. 각 선택 관절에서 child에는 +충격, parent에는 -충격을 가했다. 축은 checkpoint의 parent-local Z를 world로 회전한 방향이며 한 스텝 내내 고정했다. body freeze·자세/속도 teleport는 없다.

**4자세 × 3관절 × (zero 2회 + 두 크기 × 양·음 방향) = 72개 실험 분기**다. 이는 한 seed의 결정적 분기이며 인간 참여자 수나 독립 인간 표본 수가 아니다. 입력 snapshot 바이트는 각 분기에서 동일했다. 원본과 복원 body 상태는 정확히 같았고, 복원된 native 상태의 재직렬화 hash는 모든 분기에서 같았다. 다만 복원 후 재직렬화 바이트는 원본 snapshot 바이트와 다르므로 두 해시를 구별해 기록했다. native snapshot 바이너리는 실행 중 복원에 사용했지만 원자료에는 내보내지 않았으며, 해시·명시 body/controller 상태와 재현 도구를 보존했다.

## ±충격 응답

아래 중앙 응답은 `(ω_plus−ω_minus)/(2J)`이고 단위는 `(rad/s)/(N·m·s)`다. `ω`는 child-parent 상대 각속도를 checkpoint 축에 투영한 값이다. 괄호는 한 스텝 뒤 응답을 자유 pair의 `axis·(I_child⁻¹+I_parent⁻¹)·axis`로 나눈 비율이다. 충격 직후에는 이 자유 pair 예측과 Float32 허용오차 안에서 일치했다. 한 스텝 뒤에는 접촉·제약·상위 모터가 함께 반응하므로 이 비율을 고유 관성으로 역산하지 않는다.

| 자세 | 관절 | 자유 pair 예측 | ±0.001 중앙 응답 | ±0.01 중앙 응답 |
|---|---|---:|---:|---:|
| 건강 낮은 down | thighF | 39.6676 | 13.9344 (35.13%) | 13.7222 (34.59%) |
| 건강 낮은 down | shinF | 31.3780 | 10.5185 (33.52%) | 10.5510 (33.63%) |
| 건강 낮은 down | footF | 209.6177 | 20.9227 (9.98%) | 23.2340 (11.08%) |
| 건강 첫 stand | thighF | 45.0851 | 13.2965 (29.49%) | 13.2182 (29.32%) |
| 건강 첫 stand | shinF | 31.3853 | 5.7708 (18.39%) | 5.5667 (17.74%) |
| 건강 첫 stand | footF | 84.7112 | 2.0231 (2.39%) | 1.8613 (2.20%) |
| 손상 낮은 down | thighF | 33.9428 | 7.6187 (22.45%) | 7.6005 (22.39%) |
| 손상 낮은 down | shinF | 31.3779 | 9.5009 (30.28%) | 8.8012 (28.05%) |
| 손상 낮은 down | footF | 215.6009 | 2.3538 (1.09%) | 75.4391 (34.99%) |
| 손상 첫 stand | thighF | 53.0828 | 0.9921 (1.87%) | 0.9230 (1.74%) |
| 손상 첫 stand | shinF | 31.3809 | 3.0381 (9.68%) | 3.0584 (9.75%) |
| 손상 첫 stand | footF | 98.6751 | 70.0723 (71.01%) | 70.0289 (70.97%) |

손상 낮은 down의 footF는 작은 ±0.001에서 중앙 응답 2.3538, ±0.01에서 75.4391로 크게 달라졌다. ±0.001의 zero 대비 방향별 gain은 양방향 -6.6747, 음방향 11.3823으로, 작은 양의 충격 후 상대 각속도 변화가 zero보다 음의 방향이었다. 이는 양·음·크기 응답을 선형 관성 하나로 요약할 수 없다는 관찰이다. ±0.01 음방향 분기에서는 handO의 확인된 support가 사라졌다. 손상 첫 stand의 ±0.01 음방향 footF 분기에서는 back foot의 support가 사라졌다. 접촉 상태 변화가 함께 관찰됐지만 이번 검사만으로 비선형성의 단일 원인을 확정하지 않는다.

건강 첫 stand의 footF 비율은 약 2.4%, 손상 첫 stand는 약 71%였다. 두 상태는 자세·접촉·방향별 관성·상체/upright 모터 설정이 다르고, down→stand 때 발 추가 질량도 총 4kg 증가한다. 따라서 이 차이는 **부상만 바꾼 단일 인과 시험이 아니다**. 기존 질량 후보를 회복 해결책으로 채택하지 않는다.

## 한계와 다음 구현 가설

다리 관절 재생성은 해당 native solver history와 모터 상태를 지운다. 이번 측정은 원래 회복 중 다리 모터를 그대로 둔 응답이 아니며, 현재 프레임의 explicit 지지 힘도 공통 초기화 정책 때문에 제외된다. 한 스텝 응답에는 접촉·마찰·수동 제약·감쇠·상위 native 모터·solver 효과가 결합된다. 따라서 자유 pair 근사와 다른 응답을 발견한 것이며, 엄밀한 유효 관성 추정이나 gain 튜닝 정답을 얻은 것이 아니다. 사람 실측, 모바일 플레이, 몸통→검 전달·제동·충돌의 개선 검증도 이번 자료에는 없다. **채택된 회복 후보는 없다.**

다음 연구 구현 가설은 현재 접촉에서 가동 가능한 방향과 지지 인계를 함께 다루는 것이다.

1. 실제 접촉 point/normal과 지지 하중, hip→ankle 도달 거리를 매 프레임 확인해, 발이 움직일 수 있는 방향과 현재 지지점을 구분한다. 지지 중인 발의 일반 위치 목표가 관절 신전·바닥 제약과 충돌하는 경우, 접촉 normal/tangent 및 관절 가동범위를 고려한 목표 궤적을 만든다. 이번 parent-Z 단축 응답을 전축 Jacobian이나 고정 gain으로 대체하지 않는다.
2. 들어 올릴 발이 실제 하중을 지고 있다면 다른 손·무릎·발의 지지가 확보되도록 COM과 전신 자세를 연속적으로 옮긴 뒤, 확인된 하중 감소에 따라 발 재배치 궤적을 시작한다. 입력 요구는 유지하되 실제 근력·관절 토크·도달 가능한 궤적을 통해 수행한다. 단순 stance 고정이나 관찰 문턱만 추가하는 방식은 해결 가설로 삼지 않는다.
3. getup→stand에서 낮은 자세와 현재 ankle/contact 위치를 시작점으로 사용하고, 목표 quaternion과 목표 속도를 연속적으로 연결한다. 건강·약한 다리 모두 같은 누움과 같은 입력에서 접촉 전환·토크·관절 gap·에너지·재넘어짐을 검증하며, 지지 인계가 완료되면 일반 보행으로 넘긴다.

이는 다음 연구 방향이며 구현·효과는 아직 검증하지 않았다. 게임 속도나 높이를 강제로 제한해 결과를 숨기지 않는다.
