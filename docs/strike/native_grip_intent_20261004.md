# 손목 요청의 그립 이전 · 공개 기각 / 반작용 경로 분리

2026-10-04. 목적은 **큰 베기·날 정렬을 보존하면서 첫 충돌의 검날 뒤집힘을 줄이는 것**이다. native 엔진 채택 자체는 목표가 아니다. 기준 `5060a1abdd2b80842a6d1a68aa9b726ef62bb284`; 게임·손·공개 엔진 변경0. dirty 도구/외부 원자료·소스·실패·명령은 [JSON](native_grip_intent_20261004.json)에 기록했다.

기존 `driveSword`의 **날 비틀기까지 포함한 마지막 실제 토크3호출**을 가로채, 힘 한도가 있는 기존 그립 모터로 전달했다. 목표는 순간 상대 속도에 `2T/d`를 더한 값이다. 독립 고정 축의 nominal 힘과는 맞지만 다른 관절·힘·관성 결합이 있는 게임에서 기존 토크 그대로의 이전을 보장하지 않는다. 아래팔 축 반작용이 가슴 대신 아래팔로 간다는 변경도 명시했다.

| 같은 무접촉 큰 베기516스텝 | 기존 → 후보 |
|---|---|
| 내려베기 칼끝 속도 최대 | 12.347→12.342m/s |
| 같은 구간 검 길이축 속도 최대 | 5.292→13.903rad/s |
| 내려베기 / 후속 베기 날 평면 차이 | 10.30° / 11.42° |

기준 native·입력·제어·사건은 저장 원자료와 exact, 후보 실제 입력도 전부 같다. 그립 모터 마지막 substep1548성분 중7개는 요청과 반대 방향이었다. 전체 스텝 충격량 역전이나 단독 원인으로 확대하지 않는다. 관절 벌어짐/칼끝 속도/낮은 겨눔 오차만으로 자연스러움을 수락하지 않으며 **첫 베기 실패에서 공개 기각**, 전체 전투/다른 무기/모바일 확대는 하지 않았다.

모터 없이 요청 토크와 아래팔 반작용만 명시적으로 전달한 별도 진단에서는 내려베기 축속도5.292→3.963, 날 평면 차이4.31°였다. 최종 cap 축소26/516·최소.99999313도 있어 순수 경로 변화 하나로 단정하지 않는다. 추출기가 이 축소를 처음 누락한 `run05`를 보존하고 **물리 재실행 없이** `run07/08`에서 정정했다.

그러나 같은965스텝 공통 prefix·실제 입력·충돌 직전 몸 상태의 한 스텝 반작용 진단은 축속도−42.61→−42.81rad/s, 첫 날 평면 회전23.209°→23.217°로 개선이 없었다. **진단 자료 유지이며 공개 후보가 아니다.** 이전의 엄격 paired 실패와 속도 유지판 기각은 유지한다.

물리3명령/6궤적/3998스텝은 free 기준 반복1회와 contact965스텝 prefix를 포함한다. 독립 효능6표본이 아니다. 실행 벽시간과 기준/도구/엔진 SHA, 당시 argv는 JSON을 따른다. 외부 자료가 필요하므로 checkout만으로 완전 재현 가능하다고 주장하지 않는다.

```sh
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/no-tap-run03.json --module=/workspace/halfsword-research-import-20261003/engine/rapier.mjs --out=/tmp/NEW-intent-free.json --modes=observe,intentContinuous --tick=0 --after=515
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/no-tap-run03.json --module=/workspace/halfsword-research-import-20261003/engine/rapier.mjs --out=/tmp/NEW-route-free.json --modes=observe,pairDiagnostic --tick=0 --after=515
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/contact-tap-run06.json --module=/workspace/halfsword-research-import-20261003/engine/rapier.mjs --out=/tmp/NEW-route-contact.json --modes=observe,pairPulse --tick=965 --after=1
node tools/sim/experiments/native_grip_intent_metrics.mjs --free=/tmp/NEW-intent-free.json --route=/tmp/NEW-route-free.json --contact=/tmp/NEW-route-contact.json --out=/tmp/NEW-intent-summary.json
```

기록된 도구SHA·보존본을 준비하고 기존 raw를 덮어쓰지 않는다. 현재 도구는 이후 경고/정정/진단 추가가 있어 당시 byte와 구별한다.

다음30–45분은 **기존 첫 충돌의 접촉점·손잡이 레버암·축 관성**을 저장 trace와 현재 collider 코드에서 대조한다. 이미 검증한 기준은 재실행하지 않고, 순간 뒤집힘의 수정 가능한 경로가 확인되면 그 부분만 작게 구현한다. 손목 제어 전체의 모터 이전/gain·seed 탐색은 중단한다. 전체2단계 P-03/P-04 진행 중, 새 사용자 테스트/메이저 일반 승격 없음.
