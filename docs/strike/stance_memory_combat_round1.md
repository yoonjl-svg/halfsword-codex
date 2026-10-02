# 서기 진입 마찰 기억 초기화 · 실제 전투 회귀 1차

2026-10-02. 소스 `e5d2f081de320e42634526e27a68804baf754993`. [metrics](stance_memory_combat_round1_metrics.json)에 완료 artifact/입력/소스/엔진/후처리 해시와 실제 사건을 남겼다. **실행·동일 준비·관찰·소스 동결 PASS**. 일반판 승격은 아니다.

## 범위와 실제 개입

Q05와 같은 양쪽 실제 AI·일반 상처/사망/native 충돌의30초 결투, cloth/plate × seed7/17 × baseline/reset = **8행**이다. 준비1초를 포함해 양쪽 모든 Gait.enter에 관찰 wrapper를 설치하고 reset에서 기존 helper를 original enter 전에 실행했다. arm/cut은 모두 legacy, paired grip/legacy support/assist.3/catch on/1이다. helper는 Nf만0으로 만들며 N/Nsum·mass·plant·targets·gains·native 설정을 바꾸지 않는다. 직접 속도/위치 덮어쓰기나 상처 억제는 없다.

라운드 시작의 undefined Nf→0은 회복 효과로 세지 않았다. seed7 두 장면은 이후 enter가0이고, seed17 두 장면에서 실제 getup→stand 재진입과 양의 기존 Nf가 관찰됐다. 총 recovery entry 5회는 분기 양쪽의 합이며 독립 표본수가 아니다. 실제 reset 유효 장면은 cloth/17, plate/17이다. **synthetic knockdown 행 0개**로, 실제 전투 회복이 있어 예약한 fallback을 실행하지 않았다. down만 세면 놓치는 직접 stand→getup 경로도 실제 setState 호출로 기록했다.

| 장면/seed | 설정 | 시작 이후 enter P/E | 양의 Nf 회복 clear P/E | wound hook | death P/E | 최고 전체 K J | 최고 회전 K J | 최대 몸체 ω rad/s | 최대 유효 joint gap mm |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| cloth/7 | baseline | 0/0 | 0/0 | 35 | 0/0 | 222.790 | 69.8720 | 89.4340 | 4.32002 |
| cloth/7 | reset | 0/0 | 0/0 | 35 | 0/0 | 222.790 | 69.8720 | 89.4340 | 4.32002 |
| cloth/17 | baseline | 1/0 | 0/0 | 39 | 0/1 | 397.189 | 83.7625 | 81.1786 | 6.37815 |
| cloth/17 | reset | 1/0 | 1/0 | 24 | 0/1 | 297.611 | 83.7625 | 116.629 | 3.09086 |
| plate/7 | baseline | 0/0 | 0/0 | 53 | 0/0 | 207.045 | 71.4468 | 70.0135 | 4.34997 |
| plate/7 | reset | 0/0 | 0/0 | 53 | 0/0 | 207.045 | 71.4468 | 70.0135 | 4.34997 |
| plate/17 | baseline | 1/0 | 0/0 | 29 | 0/1 | 316.256 | 108.105 | 51.4438 | 3.34567 |
| plate/17 | reset | 2/0 | 2/0 | 41 | 0/0 | 276.972 | 108.105 | 81.8788 | 3.21448 |

| reset 진입 | fighter | frame/time s | 진입 전 Nf F/B N | 진입 전 현재 N F/B N | helper가 Nf만 변경 |
|---|---:|---|---|---|---|
| cloth/17 | 0 | 1165/10.7083 | 0.00000/321.227 | 0.00000/214.430 | true |
| plate/17 | 0 | 1495/13.4583 | 0.00000/696.459 | 0.00000/696.459 | true |
| plate/17 | 0 | 2652/23.1000 | 471.141/0.00000 | 471.141/0.00000 | true |

## 준비·관찰·입력 관문

같은 시작의 native snapshot/canonical controller/actual input이 exact다. 시작 helper는 Nf 필드를 먼저 정의하므로 JS 객체의 key 삽입 순서가 달라진다. 기존 unsorted JSON hash 차이를 물리 개입으로 판정하지 않았다. raw hash를 보존하고, 키만 재귀 정렬한 semantic controller hash와 별도의 물리 body hash를 추가했다. 배열·모든 값은 유지한다. 실제 첫 회복 clear 직전 native/controller/input/targets와 F/B Nf/N은 exact다.

4 baseline은 frozen Q05 source/설정과 전체 unsorted trace/입력이 exact여서 새 관찰 wrapper가 게임을 바꾸지 않았음을 확인했다. seed7 no-entry의 물리·semantic controller·입력·targets도 exact이며 회복 효능을 보여주는 행으로 쓰지 않는다.

| 장면/seed | 준비 exact | Q05 baseline trace/input exact | 첫 semantic/물리 차이 frame | 첫 AI입력/target 차이 frame | 첫 실제 recovery 사전 상태 exact |
|---|---|---|---|---|---|
| cloth/7 | true | true/true | -1/-1 | -1/-1 | 미개입 |
| cloth/17 | true | true/true | 1165/1165 | 1166/1166 | true |
| plate/7 | true | true/true | -1/-1 | -1/-1 | 미개입 |
| plate/17 | true | true/true | 1495/1496 | 1520/1496 | true |

후보의 첫 실제 clear 이후 native 결과를 보고 AI 입력과 목표도 달라진다. 이후 wound/death/getup 숫자는 같은 입력의 피해·회복 효능 비교가 아니다. raw -1 차이 frame은 끝까지 같음을 뜻한다.

## plate17의 추가 getup 판정

기준 player의 회복 재진입1회→후보2회다. 후보 두 번째 stand→getup은 frame2409, t=21.0750s이고 **같은 frame의 실제 상대→player 머리 blunt 120.238J**, 의식 0.320942와 함께 기록됐다. 기준 상대는 t=18.6167s에 목 사망했고 후보 상대는 살아 전투를 계속했다. 무자극 지지 재넘어짐으로 분류할 근거가 없다.

후보 전체 K 최고 276.972J vs 기준 316.256J, 유효 joint gap 최고 3.21448mm vs 3.34567mm다. 한편 sword angular peak는 81.8788 vs 51.4438rad/s로 증가했다. 각각 frame/부품/질량/파지/생존/상처 맥락을 raw와 metrics에 남겼다. 회전·입력 추종의 혼합 결과를 자연스러움 개선으로 포장하지 않는다.

plate17 player의 파지/생존 중 최고 손 목표 오차도 0.633073→0.784677m로 커졌다. cloth17 역시 최고 몸체 회전 속도가 증가했다. 실제 접촉·방어·AI 목표가 달라진 이후의 궤적 지표이며, 이 불리한 변화도 선택형 비교의 검토 항목으로 남긴다. 현재 증거로 같은 입력의 추종 성능이나 회복 효능을 판정하지 않는다.

baseline-relative 속도×3+10m/s 또는 joint gap+.1m의 거친 새 이상 문턱은 0행에 걸렸다. 이 문턱은 인체/게임 상한이 아니다. getup이 더 많다는 이유만으로 지지 실패라 단정하거나, 더 적은 K를 효능이라 판정하지 않는다.

## 결론과 한계

기존 legacy 지지 안에서 격리된 선택형 비교의 다음 검증으로 진행할 근거가 있다. 후속 [선택형 통합](stance_memory_trial.md)에서 건강/부상 무외란 두 조건×3분기인 실제 runtime6행이 연구 trace와 exact이며 로컬 모바일4조건도 통과했다. 앞선 legacy6조건 선별과 runtime6행의 분모는 다르다. **기본 승격 없음**. projected 지지 연구판의 철회를 뒤집지 않는다. 현재 접촉 N을 읽는 경로를 유지한 수명 필드 초기화이지, 지지를 지면 반작용으로 완성한 해법은 아니다.

native 총 motor/contact/constraint 일과 사용자 체감은 측정하지 않았다. 손 목표 오차는 실제 파지/블록·AI 입력 상황을 포함한다. maxFootDesDistance는 초기/stance/비활성 des까지 포함한 raw 기술자로 성능 판정에서 제외한다. 제대로 된 목표 변화는 관절/handTarget/foot des/desV hash와 실제 입력의 전후로 비교했다.

## 재현·관찰 수정 이력

최종8행의 실제 전투 시간240초, 실행 wall 236.371초다. 첫 r1의 raw 객체순서 guard 실패와 r2의 준비 hash 정렬 누락을 보존했다. 관찰 계약 수리를 위해 재실행했으며 새로운 gain/게임/helper/AI/engine 변경은 없다. 이전 완료행과 최종행의 raw trace/input/targets 반복 일치를 metrics에 남겼다. 반복을 독립 표본으로 추가하지 않았다.

```sh
node tools/sim/experiments/stance_memory_combat_probe.mjs --seconds=30 --seeds=7,17 --scenes=cloth,plate --scripted=1 --out=/workspace/halfsword-hybrid-evidence/stance-memory-combat-r3.json
node tools/sim/experiments/stance_memory_combat_report.mjs /workspace/halfsword-hybrid-evidence/stance-memory-combat-r3.json
```

새 --out 경로로 재실행하며 기존 checkpoint/start를 덮어쓰지 않는다. Q05 historical exact는 기록한 기준 source/설정이 동일할 때만 판정한다. 일반 코드 변경 뒤 이 검사를 숨기지 않고 새 분기 parity로 별도 검증한다. 원본/상대 자료·네트워크 조회, core/shared tool 수정, commit/push는 이 PM 작업에 없다.
