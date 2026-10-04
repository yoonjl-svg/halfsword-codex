# Native 팔꿈치 한도 · 실제 전투 선별 · 2026-10-04

게임 목적은 힘 한도 안에서 무기 무게를 받치고 휘두르게 하되 조작 추종과 의도된 관성을 함께 지키는 것이다. 기존 [50행 선별](native_elbow_followthrough_round2.md)은 반복하지 않고 빠진 실제 전투를 확인했다. 기준 `f2601a89b7e3bc205af1b5b8fd2fba543b3c6ebe`, 실제49.84초(설계/검토 별도). 복원 native 엔진0.19.2·모듈/교정/소스 SHA guard를 재사용했고 npm0.19.3·일반/선택형 게임 소스는 바꾸지 않았다.

## 결과와 범위

사브르/츠바이핸더 대 롱소드, 실제 두AI normal/.7·seed7,10초다. 기존/관찰/nativeCap6행, 동일3초 prefix 뒤 player만 기존 팔꿈치 모터와 중력 보상 FF가 scalar 한도를 공유한다. 기존 관절 handle/앵커/frame/한도는 유지했다. Observer를 설치하지 않은 기준과 관찰의 매 프레임 native/pose/input/controller/contact/event/readback이 exact다. FF 중복0, configure/readback/FF억제 각840회, 전체 유한값·관절 유실·오류0이다.

| 기준 → nativeCap | 사브르 | 츠바이핸더 |
|---|---|---|
| 마지막 substep 모터/기존 명목 한도 최대비 | .574→1.000000059 |1.693→1.000000007|
| 손 목표 최대오차 m |.5265→.6031|.8671→.8743|
| 관절 최대 gap mm |2.356→2.356|2.155→2.739|

후보의 실제 설정 한도 준수는 확인했으나 손 오차 증가가 남았다. 기준 비율의 분모는 기존 j.max 명목 한도이며, 기준 native 모터에 실제 설정된 최대힘과 같다는 뜻이 아니다. Native/접촉은 첫 수정 step3.008333초부터, AI 입력은 다음3.016667초부터 달라졌다. 뒤의 전투 결과/피격을 같은 상태 효능이나 승률로 비교하지 않는다. Getter는 **마지막 solver substep의 모터 한 축 충격량**이며 전체 impulse·native 일·생리학적 총 팔 예산이 아니다. 전체 운동의 자연스러움은 미판정이다.

**부상 미검증을 유지한다.** 모든 player는 실제 wound0/armS1이다. 상대는 츠바이핸더 기준1상처/후보3상처, 사브르는 양쪽0이다. Combat onWound의 severity0 둔격 이벤트를 실제 Fighter 상처로 세지 않는다. 현재 manual B의 사람 입력·중단/반전·모바일 체감과 두 엔진의 현 소스 실제 전투 전체 동등성은 검사하지 않았다.

첫6행은 기준에도 native observer를 넣어 동일경로 반복만 확인했으므로 비간섭 증거에서 제외했다. 도구/원자료를 보존하고 기준에서 installer를 뺀 정정6행으로 계약을 확인했다. 총12실행을 독립 효능12조건으로 부풀리지 않는다.

## 판정·재현·다음

**연구 보존/공개 보류.** 일반 엔진 교체·기본값 승격과 새 버튼 추가는 없다. [수치/원자료/실행 소스 지도](native_elbow_combat_20261004.json)에 모듈·교정·임시 절대import harness·도구/원자료 bytes/SHA와 첫 분기·실제 dispatch가 있다. 파일은 저장소 밖에 보존했다.

```sh
node tools/sim/experiments/native_elbow_combat_probe.mjs --out=/tmp/native-elbow-combat.json
```

기본 경로는 복원된 별도 모듈/교정이며, 다른 환경은 동일SHA 파일을 `--module=`/`--calibration=`으로 지정한다. 현재checkout만으로 연구 엔진 제공을 주장하지 않는다. 다음45–60분은 현재 **한손 manual B의 사브르·청강검 중단/반전 한 입력 구간**에서 요청 힘과 실제 움직임을 분리한다. 명확한 목적 효과가 있을 때만 한도 후보를 확장하고, 관절 교체·실패 지지/절삭·AI seed 전수 탐색을 반복하지 않는다.
