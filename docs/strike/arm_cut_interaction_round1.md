# 절삭·명시적 팔 최종 한도 상호작용 1차 (Q05)

2026-10-02. 기준 소스 `86a9fa06e64bd216f8952b4f3f2ef6754f18a6f1`. [metrics](arm_cut_interaction_round1_metrics.json)에 실제 명령·소스/엔진 해시·접촉점 속도·순간 운동량·충격량·상처·원자료 해시를 보존했다. 실행/관찰/동일 준비/동결 관문 **PASS**. 결합은 이 표본의 순간 절삭 예산과 측정한 손목 cap을 함께 지켰다. 일반판 채택·전신 물리·자연스러움의 판정은 아니다.

## 실행과 분모

실제 `harness_m.newRound`와 양쪽 원래 AI/상처/native 충돌/되튐/회복을 실행했다. 누비옷 기본 상대(롱소드→츠바이핸더), 실제 Heinrich v2 판금 상대(츠바이핸더→롱소드)의 2장면 × seed7/17 × 기본/절삭 단독/팔 단독/결합 = **16 설정 비교 행**과 관찰 없는 기본 4행, 각 준비1초 뒤30초, **20 실행 행**이다. 몸 고정·속도 덮어쓰기·상처 억제·합성 glancing/plate 주입은 없다.

같은 장면/seed의 모든 분기는 준비 native/control/input이 exact이고, 기본 관찰↔무관찰의 전체 trace와 실제 입력도 exact다. 두 seed의 실제 입력 궤적은 cloth 2개, plate 2개로 구별했다. 준비 native/input 해시도 metrics에 남겼다. 독립 분모는 장면/seed별 시작 4개이며 분기·관찰 대조·재실행을 새 독립 표본으로 세지 않는다. 옵션은 같은 준비 뒤 실제 `combat.cutReactionModel`과 양쪽 `fighter.armTorqueModel`에 설정했다. 공개 메뉴 생성부터 켜는 동작은 별도 모바일 검사 대상이다.

후보 개입 뒤 AI는 달라진 물리를 보고 입력을 바꾼다. 상처·맞음·막힘 횟수 비교는 같은 입력/같은 접촉의 피해효율 실험이 아니다. 첫 trace/input 차이 프레임을 각 분기별로 기록했다.

누비옷/판금 장면은 무기 순서와 실제 외형도 다르므로 두 장면 간 차이를 판금 또는 질량만의 효과로 판정하지 않는다. 기본/단독/결합 대조는 각 장면 안에서 한다.

## 실제 사건

‘상처 hook / 종료 상처 기록’은 서로 다른 분모다. 후자는 실제 `fighter.wounds`에 종료 시 남은 기록이며 applyWound 호출 총수가 아니다. ‘받아내기’는 실제 `onClash` fresh 사건으로 관찰하며 방어 의도 성공으로 해석하지 않는다.

빗맞음 후보는 실제 manifold 법선과 실제 접촉점의 **스텝 전 cached 상대속도**에서 접근 법선속도>0, 속도≥0.5m/s, 법선속도/전체속도≤.25로 분류했다. 이 .25는 관찰용 운동학 분류이며 제어·피해 문턱에 넣지 않았다. hook이 실제 나온 사례와 cooldown/null dispatch를 분리했다. 판금 막힘은 실제 결과의 plate=true, pass=false, severity=0, eff≤thr이며 실제 hook 유무도 분리했다.

| 설정 (절삭/팔) | 상처 hook / 종료 기록 | fresh 칼 접촉 | 빗맞음 hook / 분류 dispatch | 판금 막힘 hook / 결과 dispatch | 절삭 pair / K증가 pair |
|---|---:|---:|---:|---:|---:|
| 기본 (legacy/legacy) | 156 / 28 | 113 | 19 / 500 | 33 / 33 | 1416 / 207 |
| 절삭 단독 (budgeted/legacy) | 155 / 33 | 109 | 20 / 358 | 31 / 31 | 1167 / 0 |
| 팔 단독 (legacy/sharedCap) | 70 / 19 | 60 | 14 / 110 | 10 / 11 | 543 / 149 |
| 결합 (budgeted/sharedCap) | 108 / 20 | 85 | 15 / 225 | 35 / 35 | 1228 / 0 |

metrics의 각 설정별 wounded strike/칼 접촉/빗맞음/판금 막힘 예는 실제 frame·point·cached/live 상대속도·법선/접선속도·판정 energy/ephys/severity·raw native normal impulse를 포함한다. native 스텝 전후 관련 강체 P/L/K와 전체 스텝 잔차도 남겼다. 관찰 못한 예는 `observed:false`로 표시하며 다른 장면에서 만든 것으로 대체하지 않는다.

## 순간 절삭 장부와 팔 한도

각 실제 수동 impulse 호출의 직전/직후 속도와 관성을 읽었다. 선운동량 P는 kg·m/s, 각운동량 L은 **고정 world origin(0,0,0)** 기준 kg·m²/s다. legacy의 서로 다른 작용점과 0.8배 반작용을 그대로 기록하고, budgeted의 같은 점 ±J·Float32 순간 pair 감소·잔여 Eleft를 대조했다.

| 설정 | 최대 ΔP 크기 N·s | 최대 ΔL 크기 N·m·s | 최종 손목 토크/cap 최대 | 손목 cap 초과 호출 |
|---|---:|---:|---:|---:|
| 기본 (legacy/legacy) | 0.833333 | 1.39444 | 3.33953 | 13297 |
| 절삭 단독 (budgeted/legacy) | 0.00000115600 | 0.00000723371 | 1.91895 | 13584 |
| 팔 단독 (legacy/sharedCap) | 0.833336 | 1.17087 | 1.00000 | 0 |
| 결합 (budgeted/sharedCap) | 9.56794e-7 | 0.00000365015 | 1.00000 | 0 |

- 절삭 단독 (budgeted/legacy): drag 실제 pair ΔK=-504.286J, 예산 차감=504.286J; stuck ΔK=-307.691J. 예측 오차 최대 0.0000356872J, drag 예산 오차 최대 0.0000356872J.
- 결합 (budgeted/sharedCap): drag 실제 pair ΔK=-502.718J, 예산 차감=502.719J; stuck ΔK=-289.134J. 예측 오차 최대 0.0000112921J, drag 예산 오차 최대 0.0000112921J.

legacy의 양의 pair ΔK는 실제 수동 절삭 경로에서 관찰됐다. 팔 finalCap 단독으로 이 경로의 운동량/에너지 예산을 수리하지 않는다. budgeted는 팔 방식 두 조건 모두 순간 pair 수동성·P/L·실제 예산 차감을 통과했다. stuck 손실은 drag 예산 차감과 별도다. baseline/arm의 JSON `cutBoundedChecksPass` 값은 해당 없는 관문의 기본값이므로 legacy 보존/수동성 통과의 증거로 쓰지 않는다.

실제 어깨/손목 addTorque 반작용 합 최대는 3.55271e-15N·m이다. 손목은 `debug.wristCap`과 최종 실제 torque를 직접 대조했다. 어깨 cap의 독립 readout은 이 실행에 없으며 기존 runtime↔finalCap source parity와 관련 파일 해시를 재사용했다. cap이 native 팔꿈치/빈팔/척추/그립 spring까지 포함하지 않는다. 순간 명시적 torque power×dt는 native/총 근육 일이 아니다.

## 궤적과 한계

| 장면/seed | 설정 | hook | 판금 결과 | 절삭 pair | 최고 전체 K J | 최대 몸체 각속도 rad/s | 최대 유효 관절 gap mm |
|---|---|---:|---:|---:|---:|---:|---:|
| cloth/7 | baseline | 35 | 0 | 140 | 222.790 | 89.4340 | 4.32002 |
| cloth/7 | cut | 23 | 0 | 224 | 193.240 | 57.9588 | 4.32002 |
| cloth/7 | arm | 5 | 0 | 4 | 379.761 | 172.323 | 5.13142 |
| cloth/7 | combined | 3 | 0 | 5 | 398.049 | 58.3542 | 5.54399 |
| cloth/17 | baseline | 39 | 0 | 506 | 397.189 | 81.1786 | 6.37815 |
| cloth/17 | cut | 37 | 0 | 197 | 246.778 | 69.8343 | 4.39068 |
| cloth/17 | arm | 26 | 0 | 327 | 215.418 | 103.184 | 2.94659 |
| cloth/17 | combined | 26 | 0 | 579 | 336.446 | 83.5245 | 3.38471 |
| plate/7 | baseline | 53 | 20 | 619 | 207.045 | 70.0135 | 4.34997 |
| plate/7 | cut | 61 | 11 | 427 | 225.885 | 57.0526 | 3.68586 |
| plate/7 | arm | 18 | 5 | 46 | 267.052 | 124.248 | 4.66172 |
| plate/7 | combined | 45 | 20 | 221 | 220.744 | 69.2515 | 2.97056 |
| plate/17 | baseline | 29 | 13 | 151 | 316.256 | 51.4438 | 3.34567 |
| plate/17 | cut | 34 | 20 | 319 | 193.631 | 56.8086 | 2.81756 |
| plate/17 | arm | 21 | 6 | 166 | 346.343 | 53.6804 | 3.82426 |
| plate/17 | combined | 34 | 15 | 423 | 290.084 | 42.0455 | 4.11900 |

기존 팔 결투의 baseline-relative 속도×3+10m/s, 골반높이+.75m, 유효 joint gap+.1m 관찰 문턱에 걸린 후보는 0행이다. 이는 자연스러움 기준이나 게임의 숨은 상한이 아니다. 전체 K/상처/접촉이 바뀐 것을 전달 효율 개선으로 부르지 않는다.

최대 각속도도 표에 따로 남겼다. 순간 pair budget 관문이나 위 속도/높이/gap 문턱이 전체 몸체 회전의 자연스러움 또는 부상 뒤 제동을 입증하지 않는다. 회전 peak의 부품/파지/사망 원인별 전수 장부는 이번 실행 범위 밖이다.

native normal/tangent impulse와 solver point는 서로 다른 배열이고 대응하지 않는다. native 반작용·motor/contact/friction 일, native damping/constraint/elastic 저장량은 미측정이다. 전체 스텝의 P/L/K 변화는 발바닥·지지·관절·다른 충돌을 함께 포함하므로 절삭 예산과 같은 장부로 닫지 않는다. 판정용 wound energy는 게임 배율·팔 assist가 들어가며 실제 pair 소모 에너지와 다르다.

결론: **선택형 비교 유지**. 이 실행은 기존 URL의 4way 옵션 dispatch·터치/놓기/재입력·재시작·일반 복귀를 로컬 모바일에서 확인할 근거가 된다. 해당 입력 검사는 효능·인간 체감 수락을 대체하지 않는다. 일반판 승격·배포는 하지 않았다.

## 원자료·재현·실행 비용

`q05-screen-r1.log`: 12초10행을 완료한 뒤 마지막 git subprocess가 EPERM으로 보고서 저장에 실패했다. 로그는 실제 사건 발견용이며 통과 보고서가 아니다. git HEAD를 직접 읽도록 고쳤다.

`q05-arm-cut-r2.json.runs.jsonl`: 10개 완료 checkpoint를 남기고 중단했다. 8행에서129MB를 넘긴 반복 force-path byPath 출력만 줄였다. 완성 r3와 비교한 준비·물리 trace·입력의 반복 10행은 모두 exact이며 새 독립 표본이 아니다. r3는 시작 manifest를 먼저 저장하고 모든 행을 JSONL로 보존했다. 상세 native frame은 raw JSONL 전체에 있고 bounded JSON에는 첫64개와 예시 사건 frame을 넣었다.

r3의20행을 모두 완료한 뒤 선택형 전체 pretty JSON 저장이 V8 문자열 한도로 실패했다. 시작 manifest와 전체 완료 JSONL에서 source-after 및 원래 비교 관문을 실행해 bounded 결과를 만들었으며 게임은 재실행하지 않았다. 실제 로드한 probe 원문은 `q05-arm-cut-r3-executed-probe.mjs`에 보존했고 시작 해시와 일치한다. 이후 마지막 저장을 행별 stream으로 바꾸고 이미 있는 checkpoint/start 경로도 재사용하지 못하게 막았다. 수정 전후 게임/관찰 prefix(ownState 시작→report.pass 계산)는 byte-identical이다.

최종20행의 실제 게임 시간 합600초, 실행 wall 합 490.901초(설정/직렬화 포함, 모델 작성 시간 제외). raw와 로컬 소스만 사용했으며 네트워크·원본/상대 조회·core/엔진 수정·커밋/전송은 없다. 기존 fixture suite는 재실행하지 않았다. 해당 source parity와 Q05 실제 관찰/동결 관문을 사용했다.

```sh
node tools/sim/experiments/arm_cut_interaction_probe.mjs --seconds=30 --prepare=1 --seeds=7,17 --scenes=cloth,plate --out=/workspace/halfsword-hybrid-evidence/q05-arm-cut-r3.json
node tools/sim/experiments/arm_cut_interaction_finalize.mjs /workspace/halfsword-hybrid-evidence/q05-arm-cut-r3.json
node tools/sim/experiments/arm_cut_interaction_report.mjs /workspace/halfsword-hybrid-evidence/q05-arm-cut-r3.bounded.json
```

재실행은 새로운 --out 경로를 사용한다. 기존 원자료를 덮어쓰지 않는다. 소유 파일은 새 `arm_cut_interaction_*` 도구와 이 보고서/metrics뿐이며 root가 Q05 대장·다음 작업을 갱신한다.
