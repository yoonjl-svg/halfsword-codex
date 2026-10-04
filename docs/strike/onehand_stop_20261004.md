# 한손 B 멈춤·반전 · 2026-10-04

게임 목적은 무게 때문에 이어지는 움직임을 살리면서 입력 밖의 불필요한 힘 요청을 구별하는 것이다. 기준 `e8d3e0aab60cee0c9f7b32a7405abf14cac24fa9`, 시작04:55:15 UTC·예상45–60분. 사브르/청강검, 실제 manual B 생성·보정0/자동가드false·seed7·원래 normal 상대/거리/벽, 같은 올리기→베기→멈춤→반전 입력을 사용했다. 손 목표 델타만 더하고 몸/속도/상처를 주입하지 않았다.

## 입력 연결 후보: 연구 보존·공개 보류

기존 `guardDir`은 필터된 입력 높이.1에서 기울기가1.1→3.3으로 바뀐다. [과거 C1/84실행](edge_transition_round2.md)에도 기록된 경계다. 이번 실제 B에서는 접촉/부상0·준비 보정weight0인 경계에서 목표 속도가 한 스텝에 약6.2–6.4rad/s 바뀌었다. 이는 검의 물리적 관성과 구별되는 명령 특성이다.

새 C2는 **수평점0 보존**, 반폭.08m·양끝 기울기/곡률 연결이며 기존 날 제어를 유지했다. 최대 방향 변경.532°, 기울기.825–3.575의 재분배가 있다. 기존 C1의 단독 매핑 대조도 후퇴했으므로 새로운 발견이나 전체 개선으로 쓰지 않는다.

| 기존 → C2 | 사브르 | 청강검 |
|---|---:|---:|
| 내려베기 목표 속도 최대 step 변화 rad/s |6.191→5.109|6.195→5.112|
| 반전 제동항 요청 최고 Nm·cap 전 |66.62→70.20|59.88→62.00|
| 반전 끝 방향 오차 rad |.1330→.1534|.0855→.1059|

연결은 연속이지만 반전 요청/지연이 늘고, 손 궤적 차이는 약4–6mm·검 방향 차이는 약1–2°로 작다. **뚜렷한 조작 이득을 입증하지 못해 새 폰 버튼을 만들지 않는다.** 원래 멈춤 끝의 swing각속도는0.467/0.342rad/s였다. 이 장면의 감속을 통제 불능으로 분류하지 않으며 사람의 자연스러움 전체를 인증하지도 않는다.

## 실제 팔꿈치 축: 측정한 마지막 substep은 한도 아래

검증된 별도 native0.19.2 모듈/교정으로 기존 관절을 유지한6행을 실행했다. 현재 npm0.19.3 기록의 선택 player 몸6개+검의 postPhysics/postCombat pose·입력·controller·검접촉·사건은396step×2무기 exact다. 엔진 전체/바이너리 동등성이 아니다. 기준↔관찰 full native/pose/control/input/contact/event·raw readback도 exact다.

| 기존 → 내부 cap+FF | 사브르 | 청강검 |
|---|---:|---:|
| last substep 충격량 / 기존 명목80Nm 예산 최고 |.4173→.3979|.3904→.3591|
| 마지막 substep의 명목 cap 도달 관측 수 |0→0|0→0|
| 멈춤 끝 검 운동에너지 J |.742303→.742284|.180116→.180251|

후보 실제cap80Nm/readback/외부 FF 억제는 각396회다. 기준 native 최대힘은 무제한에 가까운 값이며 표 분모80은 **명목 예산**이다. 측정은 마지막 solver substep 모터 한 축의 충격량으로, 전체 impulse·일·생리학적 팔 예산이 아니다. FF를 외부에서 implicit 모터 안으로 옮겨 첫 스텝부터 pose가 달라졌다. 측정된 마지막 substep의 readback은 cap에 도달하지 않았지만 앞선 solver substep의 구속 여부는 확인하지 못한다. FF 이동도 해를 바꾸므로 작은 pose 변화를 힘 제한 효능으로 분리할 수 없다. 힘 제한 효능이나 플레이 개선으로 쓰지 않고 일반 엔진/힘 한도를 유지한다.

## 보존·경계·다음

입력 연구24실행/고유12조건과 native6행이다. 관찰/원본 재생/연구 소스 격리 검사는 효능 표본이 아니다. 현재 tool의 임시 실제 Fighter 복사본은 원래 후보4행의 native/control/events·적용/필터 입력과 exact다. **게임 src·package/lock은 원래와 byte exact**이며 URL/기본값 후보는 없다. 수치·명령·실행도구/raw의 크기/SHA·교정 의존성은 [재현 지도](onehand_stop_20261004.json)에 있다. 실행 wall 약86.75초는 설계/검토/전달 시간과 다르다.

Tap4행은 실제 찌르기1회씩 수락했고 접촉/상처0이나 축회전29–30rad/s가 양쪽에 남았다. Live4행은 실제 상대의 몸 피격/상처·getup이 갈려 같은 상태 효능으로 비교하지 않는다. player 검접촉0은 상대 검의 몸 타격0을 뜻하지 않는다. 실제 팔 부상·사용자 체감은 미검증이다.

```sh
node tools/sim/experiments/onehand_stop_reverse_probe.mjs --out=/tmp/NEW-npm.json --modes=original
node tools/sim/experiments/onehand_stop_reverse_probe.mjs --out=/tmp/NEW-c2.json --modes=original,continuous
node tools/sim/experiments/native_onehand_stop_probe.mjs --out=/tmp/NEW-native.json --npm-reference=/tmp/NEW-npm.json
```

Native 마지막 명령은 별도 모듈/교정의 검증된 기본 경로가 필요하며 다른 환경의 `--module`/`--calibration` 예는 JSON에 있다. 연구 엔진은 checkout에 포함됐다고 주장하지 않는다.

**다음30–45분:** 이미 저장한 찌르기2.225/2.242초 checkpoint를 재사용한다. 현재 컴파일 B의 실제 입력/화면에서 손목 상대 회전부터 확인한 뒤 명령·native 그립·길이축 토크를 분리한다. 축 각속도만으로 과도한 에너지/비인간 동작을 선언하지 않는다. C2 폭/gain 탐색·기각 날 평면·실패 지지/절삭 후보를 다시 적용하지 않는다.
