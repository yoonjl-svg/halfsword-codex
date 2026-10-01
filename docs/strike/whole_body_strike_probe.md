# 전신 타격 프로브: 최종 관찰 보고서

2026-10-01. 기준 HEAD `208154e3ac0d3dd924cbb6ed00c40ae8c302634d`의 실제 `harness_m.newRound/G.step`을 사용한다. 관찰 도구와 이 결과 보고서를 추가하며 게임의 기본 제어·물리 수치를 수정하지 않는다. 결과 통합과 시험 후보 수락은 루트 담당이다.

## 코드에서 확인한 후보와 반례

1. **몸통 회전을 손/검 목표가 되돌리는 가능성.** `fighter.js:1858/1882`는 손 목표와 검 방향을 실제 가슴 회전 대신 heading yaw로 세계에 놓는다. `armIK`는 이를 가슴 역회전으로 바꾼다. 몸통을 먼저 돌리는 기존 연동은 있지만, 세계 목표를 유지하는 팔이 몸통의 기여를 상쇄할 수 있다. 이것은 코드상 가설이며 현재 프로브로 원인 확정하지 않는다.
2. **손목은 계속 목표 추종·중력 보상·제동을 수행한다.** `driveSword:1927~1965`는 실제 손 기준 관성으로 멈출 각도를 추정하고 자동 damping을 바꾸며 Hill/cap을 적용한다. 이후 twist가 추가되어 `debug.wristTorque`만으로 전체 손목 토크를 알 수 없다. 입력 종료를 검의 자유낙하/자유회전으로 부르지 않는다.
3. **어깨 feedback도 존재한다.** `manualMuscle:1781~1821`의 목표 오차, 부모/자식 상대 각속도와 target 변화율, 중력 feedforward를 함께 읽어야 한다. 단순히 목표 속도에 부모 각속도가 없다고 제어 전체에서 부모 반응이 누락됐다고 결론내릴 수 없다. 실제 양쪽 최종 토크의 일과 반작용을 계측한다.
4. **빈손은 실제 자루 외에도 예상 자루를 향한다.** `offHand:2045`는 목표 칼 방향의 예상 pommel로 IK를 만들고 실제 hand/pommel 오차와 점속도 차로 스프링/댐퍼를 적용한다. 양쪽 힘이 같고 반대여도 작용점이 다르면 합 토크가 남을 수 있다. 루트의 opt-in paired 중점 반작용 후보는 이 문제를 분리하는 공학 대조다. gap 기반 `.5*k*gap²`를 자동으로 보존되는 수동 스프링 에너지로 해석하지 않는다.

## 도구 계약

`tools/sim/whole_body_strike_probe.mjs`는 high `[.02,.52]`↔low `[.02,-.45]`의 같은 손 입력을 사용한다. 항상 legacy로 3초 준비하고 전체 몸/검 자세·속도와 주요 제어 상태 SHA를 만든 뒤 reaction 모델만 바꾼다. 요청 stroke 입력 SHA도 검증한다. 두 무기/두 방향은 서로 다른 준비 자세이므로 그 사이 SHA 동일성은 요구하지 않는다.

첫 최소 비교는 longsword/zweihander × down/up × legacy/paired **8장면**, 종료는 release다. `--endings=target_hold`로 끝점 유지 대조를 좁혀 추가할 수 있다. release는 handHeld=false, target_hold는 true이며 종료 뒤 외부 drag는 둘 다 없다. 둘 모두 기존 제어가 남는다. release의 자동 자세 복귀가 실제 handOffset을 변경하면 그대로 기록하므로 목표 유지/복귀의 차이이며 순수 감쇠 계수만의 비교는 아니다.

강제 각속도, 무한 고정, 모형 힘 재구현은 사용하지 않는다. 실제 tip 점속도, 검의 COM 병진/주관성 회전 K, 골반/가슴 상태·속도·몸 에너지, 손 목표 오차, 실제 빈손–자루 간격, gripping/brake를 기록한다. 모든 K는 관찰값이며 타격 피해로 변환하지 않는다. 기존 발 추가 질량 변경도 에너지 장부의 한계다.

`--ledger=1`은 물리 PM의 `installForceLedger(G,{fighters:[G.player]})`를 사용한다. 최종 addForce/addTorque/impulse의 힘 경로·작용점·부모 반작용과 실제 일을 수집하되 native motor/접촉의 미계측 잔차를 구분한다. 기본 on/off 관찰 자체의 물리·제어 상태 trace 동일성을 8조건 모두 확인했다. ledger가 없는 실행은 `available:false`이며 몸통 구동 일이나 순 offHand wrench를 측정했다고 부르지 않는다.

## 최초 작은 실행

```sh
node tools/sim/whole_body_strike_probe.mjs --weapons=longsword --directions=down --reactions=legacy --endings=release --ledger=0 --out=/workspace/halfsword-hybrid-evidence/whole-body-first.json
```

종료코드0, wall0.605초, 준비3초+stroke.55초+종료후1.2초. tip 최대17.8295m/s, 그 시점 검 K42.0647J, 빈손 grip100%, wristBrake 표본2.38%, 최대 빈손–자루 간격.09715m. 실행 전후 소스 SHA 동일. 이 수치는 최초 legacy 동작 확인이며 paired 개선·전신 협응·자연스러움 수락 근거가 아니다. 이는 최초 기본 실행만의 관찰이다. 아래 계측 비교와 구분한다.

다음 공학 후보는 단순 최대힘 증량 대신 손/검의 heading 목표와 몸통 기여의 좌표 계약, 빈손 목표와 실제 그립의 관계, 힘 경로·제동의 통합 계측이다. 현재 원래 연동을 없다고 부르거나 새 목표계를 일반 게임에 바로 반영하지 않는다.


## 8조건 본측정과 관찰자 검증

실행은 모두 종료코드0, NaN/비유한 값 없음, 각 실행 전후 소스 SHA 동일이었다. 모든 내려/올려베기 후보의 준비 상태와 요청 손 입력 SHA가 대응 legacy/paired 사이에 같다. `whole-body-core-eight.json`(ledger0)과 `whole-body-ledger-eight-final.json`(최종 ledger1)의 **8행 물리·제어 trace SHA가 모두 정확히 같다.** 두 실행 사이 자체 도구에 관찰 집계만 추가했고 초기 계측 대조 당시 게임·harness 파일 SHA는 모두 동일했다. 최종 재측정 전 fighter의 paired 설명 주석만 수정됐다. 최종 ledger 변경도 API/단위/경계 해석 주석과 설명 문자열뿐임을 모듈 담당자가 확인했다. 최종 8조건의 물리·제어 trace와 명시 힘/일 집계는 이전 계측 8조건과 모두 정확히 같다. 변경 전후 도구 해시도 원자료에 보존한다.

```sh
node tools/sim/whole_body_strike_probe.mjs --ledger=0 --out=/workspace/halfsword-hybrid-evidence/whole-body-core-eight.json
node tools/sim/whole_body_strike_probe.mjs --ledger=1 --out=/workspace/halfsword-hybrid-evidence/whole-body-ledger-eight-final.json
node tools/sim/whole_body_strike_probe.mjs --weapons=longsword --directions=down --endings=target_hold --ledger=1 --out=/workspace/halfsword-hybrid-evidence/whole-body-target-hold.json
```

wall 시간은 각각3.249/5.290/1.526초다. 이전 ledger 8조건은9.032초였으며 최종 고정 모듈로 다시 확인했다. 준비를 포함한 누적 simulated time은 각각38/38/9.5초, 힘 장부 관측 구간은 한 장면당0.55초 stroke+1.2초 후속 제어, 210physics steps다. 표의 K는 **칼끝 최고속도 시점의 검 COM 병진+주관성 회전 K**이며 K 자체의 최고값은 아니다. 일은 stroke만이 아니라 후속 구간까지 포함한다.

| 무기·방향 | tip 최고 m/s legacy→paired | 해당 시점 검 K J legacy→paired | offHand 순토크 RMS Nm legacy→paired | offHand signed work J legacy→paired |
|---|---:|---:|---:|---:|
| longsword 내려 |17.8295→17.5418|42.0647→42.2942|2.2324→1.79e-14|−43.8999→−43.6370|
| longsword 올려 |13.8191→13.8991|26.9821→21.5613|1.4662→1.99e-14|−58.1846→−52.1416|
| zweihander 내려 |16.9305→16.9323|66.7184→66.9417|2.2007→2.07e-14|−45.3391→−42.7749|
| zweihander 올려 |13.1279→12.1681|48.5553→42.0507|1.9042→2.50e-14|−70.7974→−73.0433|

offHand 순힘은 모든 조건에서0N이었다. legacy 순토크 최대는6.5834~11.7196Nm, paired 최대는1.23e-13Nm 이하다. 공통 작용점 후보가 이 경로에 적용한 힘쌍의 순 couple을 제거한다는 제한된 공학 결론은 재현됐다. signed work는 계속 음수이며 상대 감쇠가 없어졌다고 부를 수 없다. 방향에 따라 속도/K 변화가 달라 전신 힘 전달 증가, 사람의 자연스러움 또는 피해 개선을 입증하지 않는다.

골반·복부·가슴에 **명시적으로 전달된** 모든 힘/토크의 signed work는 legacy→paired 순서로 longsword 내려21.0701→20.0382J, 올려−25.2604→−26.2715J; zweihander 내려22.7583→23.2195J, 올려−11.6838→−15.6372J였다. 그중 팔 반작용(`driveSword/manualMuscle`)과 `driveBalance`의 일도 별도 보존한다. 몸통 native motor/관절/접촉 일 전체가 계측된 값이 아니므로 이 숫자로 몸통의 총 기여나 폐합 에너지 장부를 단정하지 않는다.

## 좁힌 입력 종료 대조

longsword 내려베기 target_hold legacy/paired 두 장면을 추가했다. release 본측정과 준비/요청 stroke SHA가 각각 동일하고 최고 tip속도와 해당 시점 K도 같았다. 종료 후1.2초 동안 칼 축의 **누적 각 이동량**은 release legacy1.3454rad·paired1.3440rad, target_hold legacy0.3714rad·paired0.3724rad다. 현재 복귀/유지 제어가 관성 이후 궤적을 크게 바꾸는 정황이다. 양끝 각도나 순 회전각과 구분하며, 입력 종료를 자유회전으로 취급하면 안 된다. 두 모드에서 회복·목표 조건까지 달라지므로 순수 브레이크 계수의 인과 대조로 사용하지 않는다.

## 원자료와 다음 최소 질문

- [최종 수치·SHA 요약](whole_body_strike_metrics.json)
- [8조건 계측 원자료](/workspace/halfsword-hybrid-evidence/whole-body-ledger-eight-final.json), [압축본](/workspace/halfsword-hybrid-evidence/whole-body-ledger-eight-final.json.gz)
- [종료 제어 2조건](/workspace/halfsword-hybrid-evidence/whole-body-target-hold.json)
- [계측 없는 대조](/workspace/halfsword-hybrid-evidence/whole-body-core-eight.json)

저장소 안 결과는 위 상대 링크의 JSON이며, 외부 raw 경로는 로컬 재현용 보관 위치다. 공개 배포 링크나 별도 source/deploy SHA를 대신하지 않는다. 원자료의 `sourceSha256`가 기록한 실행 소스 파일의 식별자다. HEAD만으로 미커밋 paired 후보를 식별하지 않는다. 최종8조건 ledger SHA는 `60523a73ea4cd8ae084243f542663dc8ed8c0bb6322eed90c7cd6729b13cd24d`다. target_hold2조건은 이전 `586f85693efb2e6717821d06e21056e4889afcb7412fef56453767e521607261`로 측정했으며 별도 manifest를 최종 지표에 보존했다. 자료에는 실제 실행 비용만 기록하며 사람 검증 비용은 미측정이다.

다음에는 현재 연동을 보존한 채, 동일 준비 자세·입력에서 세계 heading 손/검 목표와 몸통 기여를 함께 정의하는 **하나의 opt-in 목표 좌표 후보**를 비교해야 한다. 먼저 몸통 선행/회전 기여를 실제 팔 반작용과 목표 오차로 관찰하고, 별도의 정지/허용 제어는 유한한 실제 제어로 명명해야 한다. 강제 각속도나 무한 고정 결과를 자연 동작으로 제시하지 않는다. 본 프로브는 몸통 고정 대조·충돌 타격·부상·인간 수락을 수행하지 않았다. 기본 적용은 하지 않으며 코드 후보의 수락·배포는 루트/사용자 판단이다.
