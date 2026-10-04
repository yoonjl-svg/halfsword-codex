# 피격 뒤 한손 조작 · 현재 재현 장면 선별

2026-10-05 KST. 기준 `208361b491fa86579af088f95b75a0bd2aa0f740`. **현재 다친 팔의 입력 중단·반전 검사를 준비하는 회차이며 게임 변경/새 공개 후보는 없다.** 과거 자료2개의 실제 bytes/SHA를 확인하고 현재 두 고정 조건만 실행했다. [수치·명령·해시](recovery_selection_20261005.json).

옛 청강검 manual의15.575초 주팔 절상은 현재 seed7에서 재현되지 않았다. 현재는6.317→8.375초 건강한 getup 복귀 뒤9.325초 목 피격으로 사망, 주팔 손상0이다. 옛 getup을 팔 부상 뒤 복귀로 쓰지 않는다. 팔쉬온 manual/seed19는10.625초 기능1→.997188의 경미한 절상만 있으며 player getup이 없다. 이것도 심한 부상 회복 수락이 아니다. legacy/manual의 다른 접촉·상처 이력을 승률·효율 비교로 사용하지 않는다.

**다음 재현 경계:** 현재 청강검 **legacy/box**, seed7·skill.7·상대 보통/longsword·시작 간격5.6m·walls:false·원래 두 AI에서 주팔 절상이 발생한다. 사건12.791667초 뒤 post-Combat tick1535/12.800초에 기능1→.366571, 살아 있고 검을 들고 서 있다. 이후 두 번째 절상까지 기능.275218로 내려가며 관측 손 목표 오차 peak .0986→.1046→.1907m다. 이는 다른 시간/명령 창의 관측이며 같은 입력에서의 효능 비교가 아니다.

기존 원자료에는 실제 손/최종 목표·활성·속도/힘이 없어 read-only 관찰만 추가했다. 생성 native hash와 기존 기록4800프레임·상처 사건은 관찰off/on exact다. 전체 step별 native world hash까지 exact라고 주장하지 않는다. 목표/근육/손목 cap은 마지막 drive의 pre-native 요청이고 몸/건강은 post-Combat이므로 첫 절상 step의 토크가 이미 새 건강값으로 계산됐다고 해석하지 않는다. vigor/jolt는 post-Combat 현재 값이며 이전 drive의 근육/요청 cap과 구분한다. 누산 힘은 관절/지면을 모두 포함한 실제 해결 힘 장부가 아니다.

현재4기준 행+2관찰 동등성 반복은2개의 무기/seed 고정 문맥이다. gain/seed 전수 탐색·강제 상처/상태/속도/접촉은 없었다. held/inputActive가 기록돼 있으나 AI 경로에서는 false이며 **사람의 hold/release/재입력 수락은 아니다.** getup 한정 팔 활성 후보는 선택한 stand 절상의 효능 검사가 될 수 없다. 근력 증폭·한손 회복 후보 공개/일반 승격은 보류를 유지한다.

```sh
node tools/sim/experiments/onehand_live_recovery_probe.mjs /tmp/NEW-current-qinggang.json --weapons=qinggang --seed=7 --seconds=20
node tools/sim/experiments/onehand_live_recovery_probe.mjs /tmp/NEW-current-falchion.json --weapons=falchion --seed=19 --seconds=20
```

외부 관찰 도구의 정확한 SHA/절대 import 경로는 JSON과 저장소 밖 archive를 따른다. 다른 환경에서는 경로를 명시적으로 이식하고 새 도구SHA를 기록한다. checkout만으로 외부 도구/raw를 제공한다고 주장하지 않는다.

**다음30–45분:** 생성부터 실제 전투를 같은 prefix로 재현해 tick1535 경계 뒤 AI 생성 명령을 고정된 손 입력 중단·반전·재입력으로 전환한다. 같은 다친 상태에서 첫 명령 차이와 실제 손/목표·다음 베기를 검사한다. 이는 준비된 AI-prefix 입력 시나리오이며 사람의 실전과 동등하다고 부르지 않는다. 초기 손상·근력 cap을 유지하고 강제 상처/회복은 하지 않는다. 현재 manual B는 별도 검증하며 실패 후보를 되살리지 않는다.
