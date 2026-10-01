# 힘 전달 1차: 장부, 양손 반작용, 접촉 없는 받침

2026-10-01 23:37 KST 이후 개발. 기반 커밋 `208154e3ac0d3dd924cbb6ed00c40ae8c302634d`, 실행 파일 SHA256은 [계측 요약](force_path_round1_metrics.json)과 [타격 요약](whole_body_strike_metrics.json)에 남겼다. HEAD 이후 후보를 포함한 실행이므로 기반 SHA만으로 재현하지 않는다. 최종 소스·공개 배포 연결은 [릴리스 기록](force_path_release.md)을 따른다.

## 결정과 실제 변경

전신 강타에 앞서 힘이 어디서 들어오고 어디서 상쇄되는지 읽을 수 있게 했다. 이번에 고친 것은 **양손 그립의 서로 다른 작용점 때문에 생기던 순토크**다. `GRIP.reactionModel='paired'`일 때 두 점의 중점에서 상대속도를 구하고 같은 점에 ±F를 가한다. 기존 radial spring, grip 이득, 250N 상한과 손 IK 목표는 유지한다. 한손 무기·잃은 빈손에는 이 힘을 추가하지 않는다.

기존 방식은 ΣF=0이어도 `Στ=(hand−pommel)×F`가 남았다. 공통 작용점 후보는 적용 힘쌍의 ΣF와 Στ를 0으로 하고, 상대운동 감쇠는 유지한다. 강체처럼 함께 회전하는 두 물체를 불필요하게 제동하던 항을 제거한 것이다. 유한 dt의 실제 적분에는 각운동량 잔차가 있으므로 ‘전체 게임 각운동량의 완전 보존’으로 부르지 않는다.

일반 게임의 기본값은 legacy다. [휴대폰 비교판](https://yoonjl-svg.github.io/halfsword-codex/force-lab.html)의 두 버튼은 모두 B(받침 .1, 반사 on, 강도 1), 양쪽 longsword이며 후보 버튼만 `physicsTrial=grip`을 추가한다. 이 설정은 URL 한 접속에만 적용된다. 일반 접속은 받침 .3과 legacy로 돌아간다. 전신 타격·자연스러움·피해 증가를 완성했다는 판정은 하지 않는다.

## 새 계측의 경계

`tools/sim/force_ledger.mjs`는 실제 Rapier 몸 메서드의 명시적 힘·토크·충격량·속도 덮어쓰기·추가 질량 변경을 관찰한다. 게임/물리 단계 전후의 실제 질량, COM, 월드 주관성, 선/각 운동량, 병진/회전 K와 중력 V를 기록한다. 선수 몸+검을 경계로 하고 방어구 collider 질량은 소유 강체에서 한 번만 센다. 내부 경로의 부모/자식 반작용도 함께 묶는다.

명시적 힘의 일은 COM 속도·각속도 사다리꼴 근사, 각충격량은 단계 전 작용점 근사다. native 관절/kinematic upright 반력, 완전한 접촉 일, 엔진 감쇠와 질량 변화의 에너지 유입은 닫히지 않았다. raw 접촉 충격량은 보존하며 인체에 6/7 교정을 자동 적용하지 않는다. **잔차는 미계측 및 이산화까지 포함하며 바로 엔진 오류가 아니다.** 게임 중 `setAngvel`로 제동하는 경로는 물리 적분 뒤 별도로 기록한다.

독립 교정 9개를 통과했다. 실제 게임 240프레임과 통제 타격 8조건에서 계측 on/off의 전체 상태 trace SHA가 정확히 같았다. 계측 자체가 제어를 바꾸지 않는지 확인한 범위다.

## 통제 그립과 실제 내려/올려베기

native 두 강체에 실제 `Fighter.offHand`를 호출한 12 fixture에서 공통 회전, 방사/접선 상대운동, 좌표 회전·이동, cap, dt 감소를 비교했다. IK는 이 시험에서만 생략하고 중력·접촉·다른 구동기는 제거했다. 함께 회전할 때 legacy 순토크 −.320Nm·순간 일률 −1.280W가 paired에서 둘 다 0이 됐다. 접선 상대운동의 감쇠는 남았다. dt 감소에서 적분 잔차가 줄어드는 것도 확인했다.

실제 게임의 long/zwei × 내려/올려베기 × legacy/paired 8조건은 같은 준비 상태·입력에서 비교했다. legacy 빈손 경로의 순토크 RMS **1.466–2.232Nm**가 후보에서 수치 반올림 수준으로 사라졌다. 칼끝 최고속도는 모든 조건에서 증가하지 않았다. 따라서 이 후보를 강타 증폭기로 평가하지 않는다. 상대 그립 감쇠·몸통 명시적 구동 일·입력 종료 후 복귀/유지 차이는 [전체 관찰](whole_body_strike_probe.md)을 본다. 입력 종료는 자유회전이 아니다.

## 네 상태의 바닥 제거 대조

실제 stand/kneel/getup/down을 만든 뒤 바닥만 제거했다. 바닥 유무의 시작 상태 SHA는 각 쌍에서 동일하다. 상태를 고정하지 않고 1초(120단계) 관찰했다. B, seed 7, longsword, 수동 상대를 멀리 둔 조건이다.

| 시작 상태 | 바닥 있을 때 직접 상향력 평균 N | 바닥 없을 때 평균 N | 바닥 없이 상향력 >1N인 단계 |
|---|---:|---:|---:|
| stand |84.33|730.77|120/120|
| kneel |441.46|762.13|120/120|
| getup |463.14|725.11|116/120|
| down |92.03|454.91|120/120|

바닥 제거 조건은 전 구간 실제 바닥 접촉점과 충격량이 0이었다. stand/kneel/down은 해당 상태에 남았고 getup은 바닥 없이도 stand로 전환했다. **직접 골반 받침이 지면에서 전달된 힘과 독립적으로 남는 구조**를 확인했다. 이것은 진단용 바닥 제거 대조이며 정상 플레이에서 같은 수치가 나온다는 뜻은 아니다.

실제 총질량은 상태·발 추가 질량에 따라 변했다(standing 약80.7kg, 무릎/넘어짐 약76.7kg). 제어용 `totalMass=75.1`은 검과 추가 발 질량을 모두 포함한 실측 총질량이 아니다. 발의 수치 안정용 추가 질량을 제어가 제외한다는 이유만으로 버그로 단정하지 않는다.

## 검증과 재현

```sh
node tools/sim/force_ledger.test.mjs /tmp/force-ledger-tests.json
node tools/sim/grip_reaction.test.mjs /tmp/grip-reaction-fixtures.json
node tools/sim/body_support_ledger_probe.mjs /tmp/body-support-ledger.json
node tools/sim/whole_body_strike_probe.mjs --ledger=1 --out=/tmp/whole-body-strike.json
node tools/sim/force_default_trace.mjs "$PWD/tools/sim/harness_m.mjs" /tmp/current-default.json
node tools/sim/grip_integration_probe.mjs /tmp/grip-integration.json
node tools/sim/balance_axes.test.mjs
node tools/sim/catch_response.test.mjs
node tools/sim/support_options.test.mjs
npm run build
```

기본 회귀는 기반 커밋의 `src`, `tools/sim/harness_m.mjs`, `package.json`을 별도 디렉터리에 `git archive`로 추출하고 같은 node_modules와 trace worker를 사용해 비교했다. 기본 AI 결투 8초와 편측 다리 손상 기립 8초의 각 960프레임 trace가 정확히 같았다. 결과 해시는 요약 JSON에 있다.

추가 통합 검사는 일반 받침 .3/on/1, seed17, long 대 zwei에서 두 모델 각각 AI 결투30초와 부상 기립8초, 총4장면으로 했다. 모두 유한 상태·예외0·활성 관절 누락0이며 실제 결투 접촉/상처/그립이 있었다. 최대 해부 관절 앵커 간격은 legacy3.35mm/paired6.38mm였다(관측치이며 인간 수락 문턱이 아니다). 두 모델의 실제 결투 궤적과 사건 수는 달랐다. 단일 시드로 밸런스 우열을 판단하지 않는다. 최종 실행8.425초, 동일 측정의 외부 runner와 저장소 runner의 네 trace도 같았다. 공개 모바일 검사는 릴리스 기록으로 연결한다.

모바일 자동 검사는 세로 화면 버튼 탭→가로 시작→3초 이상 시뮬레이션→실제 터치 드래그/해제→재시작으로 수행한다. 양쪽 설정·검 선택·유한 상태·일반 URL 복귀·콘솔 오류를 확인한다. 입력 검사에서는 AI를 잠시 멈췄고 실제 휴대폰 성능이나 인간의 자연스러움을 판정하지 않았다.

## 다음 구현

1. **체중 지지부터:** 이번 네 상태 장부를 실패 관문으로 삼아 직접 골반 보조의 책임을 다리/실제 지면 반작용으로 단계적으로 옮긴다. 안정된 정적 지지→작은 체중 이동→건강 기립→부상 시 중단 순서다. 실패한 R0처럼 보조를 먼저 없애고 건강 기립까지 막지 않는다. 무접촉 힘만 없애는 것으로 자연스러운 회복을 선언하지 않는다.
2. **몸통과 손 목표:** 현 heading 기반 세계 목표가 몸통 회전의 기여를 상쇄하는지는 아직 가설이다. 실제 연동을 보존하면서 하나의 목표 좌표 후보만 분리해 부모 반작용·일·목표 오차를 비교한다. 강제 각속도를 주어 얻은 성공을 전신 협응으로 부르지 않는다.
3. **충돌 전달:** 실제 접촉 전후 양쪽 운동량과 검 유효질량을 먼저 대조한다. 공격자 전체 K나 피해 배율을 올려 전신 강타를 대신하지 않는다. 큰 변경은 각각 비교 가능한 웹 시험판과 실패 결과를 준비하고 사용자 확인 뒤 일반 적용한다.
