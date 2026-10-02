# 어깨·손목 힘 배분 선택형 비교

기존 제어는 swing 한도를 적용한 뒤 twist를 추가한다. 이번 B(`armTrial=sharedCap`)는 twist까지 합친 **각 어깨/손목의 명시적 최종 토크**를 기존 cap 안으로 제한하고, 그 벡터로 양쪽 반작용을 계산한다. 일반 접속과 알 수 없는 옵션은 legacy다. 같은 설정을 플레이어와 상대에게 라운드 생성부터 적용하며 저장된 설정을 바꾸지 않는다.

이는 [130행 연구](arm_capacity_round1.md)의 finalCap-only를 실제 게임에 연결한 것이다. portHill과 팔꿈치 교체는 포함하지 않았다. 새로운 힘·gain·속도 상한이나 물리 속도 덮어쓰기도 없다. 기존 cap 자체는 검증된 인체 총 근력값이 아니며 native 팔꿈치·빈팔·척추 모터와 그립 spring은 여전히 별도다. 일반판 승격이나 전신 물리 해결로 판정하지 않는다.

## 플레이 계약

`/feature-lab.html#arm-comparison`에서 한손 세이버와 큰 양손검을 각각 A/B로 연다. 같은 무기 쌍에서 링크는 armTrial만 다르다. 상대는 longsword, 받침 .3/반사 on/scale1, paired 그립, legacy 지지·절삭이다. 아래에서 들어 올리기, 내려베기, 베고 멈추기를 비교한다. 입력 종료 후에도 원래 제어기가 작동하므로 손을 놓는 것을 자유 비행이라고 설명하지 않는다.

현재 연구에서 손 목표 최대 오차는 건강 finalCap 0.0005~0.0133m, armS=.15 조건 0.0013~0.0263m 증가했다. 속도와 종료 후 이동량은 방향에 따라 달랐다. 이 차이가 무게감 개선인지 조작 불편인지는 사용자 플레이로 판단해야 한다.

## 실제 코드와 연구 후보의 일치

- 동일 실제 준비/입력에서 건강·armS=.15 × 두 무기 × 세 방향 × 두 종료 조건 × baseline/clone/runtimeFinalCap = 72행을 실행했다.
- 이전 독립 source transform의 finalCap과 새 runtimeFinalCap 24행의 전체 물리 trace, 입력, 설정 직후 native/control hash가 정확히 일치했다. 일반 baseline/관찰 clone 48행도 이전 기록과 정확히 일치했다.
- runtimeFinalCap에서는 clone의 관찰 hook만 사용하며 실제 수정은 Fighter의 URL 선택 분기다. 진단 최종 토크와 실제 addTorque, 수신자별 순간 power를 대조했다. 최종 cap 관문과 callback 오류 0, sourceStable을 통과했다.
- 수정된 Fighter를 대상으로 4개 fixture 그룹을 다시 실행해 source guard/복제/실제 native 누산/오류 보고 관문을 통과했다.

원자료는 `arm-capacity-runtime-round1.json`, `.summary.json`, `arm-capacity-runtime-parity.json`, `arm-capacity-runtime-tests.json`이다. 이 일치는 비충돌 타격 범위이며 실제 부상이나 자연스러움의 입증은 아니다.

## 전투·모바일·배포

실제 두 AI의 30초 결투 24행을 통과했다. sabre/zweihander 대 longsword × seed7/19 × original/clone/finalCap/combined/runtimeFinalCap/runtimeFresh다. 4조합에서 original↔clone과 연구 finalCap↔실제 runtimeFinalCap의 전체 물리 및 실제 입력 제어 trace가 exact였다. runtimeFresh 4행은 생성부터 후보를 켜 준비 단계까지 실행했으며 동일 준비 상태 비교에서 제외한다. 관찰 도구가 같은 물리 상태를 유지하는 것과 AI가 서로 다른 물리 결과에 반응해 입력을 바꾸는 것을 구별했다.

24행 모두 finite/실제 dispatch/상태 보존/진단을 통과했고 baseline 대비 새 속도·골반 높이·관절 gap 검토 문턱에 걸린 행은 0이었다. 이 문턱은 시험의 이상 탐지용이며 게임의 속도/높이를 덮어쓰지 않는다. 최대 골반 높이/관절 gap은 original 1.06392m/7.362mm, finalCap·runtimeFinalCap 1.07256m/3.478mm, runtimeFresh 1.09210m/4.141mm다. 연구 finalCap 46,798개 진단과 combined 50,972개 진단에서 실제 토크/순간 power 차이는 0, cap 초과는 0이었다. 실제 runtime은 후보 함수로 바꾸지 않고 imported Fighter 메서드를 실행했다. runtime 어깨의 별도 cap readout은 없으므로 직접 측정한 것처럼 쓰지 않으며 finalCap 전체 trace exact를 함께 근거로 삼는다.

피격·부상·사망 결과는 후보에 따라 달라졌다. 이를 승률 개선이나 인간다운 동작의 증거로 삼지 않는다. 최초 duel 도구의 RNG 관찰 closure 오류는 0행에서 중단했고 실패 JSON/log를 보존했다. 수정 후 전체 실행이 sourceStable을 통과했다. [통합 수치·72개 exact 대조·원자료 해시](arm_capacity_trial_metrics.json)에 근거를 보존했다. [공개 배포·모바일 검사 영수증](arm_capacity_trial_release.json)에 배포 commit·Actions run·공개 바이트와 브라우저 원자료 해시를 보존했다.

로컬 모바일 8조건은 링크 진입·메뉴·터치 이동/놓기/재입력·새 양쪽 Fighter로 재시작·일반/오타 옵션 복귀·유한값·화면 넘침을 통과했다. 오류 0건이다. AI만 입력 분리 구간에서 중지했으며 렌더링 RAF가 실제 물리 시간을 진행했다. 기기 성능이나 자연스러움 검사가 아니다. 최초 로컬 빌드 뒤 버튼 문구를 `B · 새 방식`으로 단축했고 게임 JavaScript는 바꾸지 않았다. 공개 모바일 검사도 최종 문구 `B · 새 방식`과 같은 8조건을 통과했다. source `9dc396eb4b656dc6aad08be04efa4063769b10d8` → main `ca1a590ce33be77e547b046fc814bc5b64b69bfb`, transfer [36974632175](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/36974632175)와 Pages [36974803663](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/36974803663)를 확인한 기존 기록에 근거한다. 공개 index·feature-lab·main JS 바이트는 최종 빌드와 exact였고, portrait/landscape × 세이버/큰 양손검 × A/B 8행 모두 PASS, JavaScript·HTTP·request 오류는 각각 0건이다. [공개 비교 링크](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#arm-comparison)와 원자료 `arm-trial-browser-arm-public-r1.json`의 SHA256은 [release receipt](arm_capacity_trial_release.json)에 보존했다. 브라우저 입력 검사는 물리 trace 재생·토크 한도 검증·기기 성능·인간 자연스러움의 입증이 아니다.

```sh
node tools/sim/experiments/arm_capacity_probe.mjs --conditions=healthy,armWeak --variants=baseline,clone,runtimeFinalCap --out=/tmp/arm-runtime-rerun.json
node tools/sim/experiments/arm_capacity_candidate.test.mjs /tmp/arm-tests-rerun.json
node tools/sim/experiments/arm_capacity_duel_probe.mjs --out=/tmp/arm-duel-rerun.json
PLAYWRIGHT_MODULE=/workspace/halfsword-review-tools/node_modules/playwright/index.mjs HALFSWORD_EVIDENCE_TAG=rerun node tools/browser/arm_trial.mjs http://127.0.0.1:4193/
```

## 이어갈 과제

[기립 인계 5차](recovery_handoff_round5.md)에서 목표 연속성과 지지 기하의 차이를 확인했다. 자세 보간과 upright 단순 제거는 채택하지 않는다. [native 모터 API 1차](native_motor_api_round1.md)는 새 raw API 34검사와 실제 게임 32조건의 결과를 별도로 기록한다. 이 연구 엔진은 공개 비교판에 연결하지 않았으며 전신 힘 전달과 누움→기립은 여전히 미완료다. 다음 근력 연구는 확인된 native 결합 solver API로 모터 한도·반작용을 실제로 제한·관찰하는 범위를 이어 검증한다. 자유 두 강체 implicit PD로 native 모터를 대체한 팔꿈치의 실패를 반복하지 않는다. 그 뒤 native 팔꿈치/다리·중력 보상·몸통에서 검으로의 전달을 같은 예산 안에서 검증한다.
