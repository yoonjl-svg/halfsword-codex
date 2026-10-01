# 무기 PM 상태 (늘 최신 — 디렉터 9/29 규칙 ④)

- 세션: `session_013j34LYEUYoaeS5xUme2DTq` · 브랜치 `claude/pm-weapons-balance` · 디렉터 `session_014nJCzE4hyxiYc9innhSUng`
- 보고: 하루 한 번 18:00 KST, 10줄 안, 끝남/진행 중/안 함 + 커밋 해시. 막혔을 때만 그 전에. 일이 없으면 "대기" 한 줄.
- 역할(main `docs/pm_roles_charter.md` 부록 B): 무기가 "무엇을 하나"(무기 값·자세표·기술 길·판정 제안). 몸 동작은 동작 PM, `schools.js`·`ai.js` 는 캐릭터 PM·디렉터(무기 PM은 값만 제안). 제한·상한·조건은 제안만.

## 맡은 일
- 무기 밸런스·겉모습, 리볼버 점검 도구(`gun_recoil.mjs`)
- 무기 분류 `src/weapon_class.js` · `docs/weapon_types.md`
- 동작 라이브러리 `src/motion_library.js`(기본 꺼짐) · `docs/weapon_motions.md` → 온몸 타격의 '무기 층'으로 합침(역할 분담안 4번)
- 자루 무기(봉·창) 시제품 `tools/sim/pole_specs.mjs` · `docs/pole_frame_design.md`
- (9/29 폐지) 무기-검술 연구 ASS — 사장님 지시로 보관, 요청 목록 닫음. 조사가 필요하면 디렉터에게 요청(일회성 조사 에이전트). 자루 무기 조사는 하지 않음(로스터 밖).

## 열린 요청
| 일 | 기한 | 상태 |
|---|---|---|
| `docs/handoff/weapons_merge_list.md` (main 병합 최소 묶음 + 붉은 팀 명령) | 9/29 18:00 KST | 끝남 |
| 이 상태 파일 | 늘 | 끝남(갱신 중) |
| 무기 층 인터페이스 초안 `docs/weapon_layer.md` + `weapon_class.js` 칸 | 9/30 18:00 KST | 끝남 (초안, 연구 ASS R6 조사 오면 3절 값 교체) |
| 밸런스 수치 3개 + 청강검 선택안 | 사장님: **R3(온몸 위력) 뒤** 빌드 커밋 적고 다시 재서 제안 | 대기(R3) |
| Q13 판금·투구 → 센 베기는 둔기 충격 + 갑옷 닳음(디렉터가 R3 에서 combat.js 구현) | 둔기 부위 효과값·갑옷 손상 배율·부서진 뒤 규칙 제안 `docs/strike/q13_values_proposal.md` | 끝남 (25b1bca, 디렉터 9/29 지시로 R0 전에 시작) — 사장님 질문 3건(틈 찌르기·맨몸에도 켜기·부순 한 방 남는 에너지) |
| Q14 칼 파손 물리대로 · Q26 한손 무기 물리에 맡김(배율 목표 칸 없음) | — | 반영함 |
| 온몸 타격(R2 이후) 뒤 도끼·메이스 시제품 다시 재기 | R2 뒤 | 대기 |
| 둔기(메이스·모닝스타·망치) 제안 + 밀치기 물리 의견 `docs/strike/blunt_weapons_proposal.md` (디렉터 9/30, 문서만) | — | 끝남 |
| 엑스칼리버 진품 기운 절반(사장님 9/29 직접) | — | 끝남 `030bfc9` (aura.js, main 병합 요청) |
| 리볼버 사실감(사장님 9/29 직접): 6연발·사격 사이 0.7초·다 쏘면 장전 9초·장전 자세와 한 발마다 딸깍·겨눔 가운데 가슴~머리 사이 무작위 흔들림 | — | 끝남 `eea5b34` (gun.js 는 디렉터 영역 → main 병합 요청). 권총 대 롱소드 83% → 96% — 세기 조정은 사장님 결정 |

## 하지 말 것 (디렉터 9/29)
motion_library 몸 동작 기능 확장, 밸런스 값 적용, 새 시제품. main 에 없는 작업을 더 키우지 않는다. 새 원격 브랜치 금지.

## 재현 명령
- 분류 표: `node tools/sim/weapon_classes.mjs`
- 라이브러리 켬/끔 롱소드 상대: `node tools/sim/hybrid.mjs motion_lab.mjs duel <무기id> 48 off|on`
- 리그전: `for k in 0 1 2 3; do node tools/sim/motion_league.mjs run 24 $k 4 off > l.$k.jsonl & done; wait; node tools/sim/motion_league.mjs report l.*.jsonl` (켬은 `on`)
- 밸런스 제안 묶음: `node tools/sim/with_spec.mjs 'rubber_chicken.mBlunt=3.8' 'monohoshizao.controlOverrides={"maxAimTorque":22,"aimStiffness":70,"wristVmax":34,"twistScale":0.25}' 'monohoshizao.mCut=1.4' 'zweihander.mCut=1.35' motion_league.mjs run 24 0 1 off`
- 봉: `STAFF_N=48 STAFF_THRUST=rapier STAFF_MBLUNT=3.5 LIB=1 node tools/sim/hybrid.mjs staff_proto.mjs` · 봉·창 리그: `EXTRA=pole ONLY=proto_staff node tools/sim/motion_league.mjs run 12 0 1 off`
- 부위 효과표: `node tools/sim/hybrid.mjs blunt_zones.mjs <무기id> 24 on|off`
- 리볼버: `node tools/sim/gun_check.mjs` · `node tools/sim/hybrid.mjs ability_test.mjs pistol 24` · `node tools/sim/gun_dummy.mjs`
- 게임 불변 확인: `fights12.mjs`, `hybrid.mjs fights12.mjs`, `live_battery.mjs` 바이트 비교 + `weapon_smoke.mjs`

## 다음 할 일
1. (끝남) R6 조사 반영. 병합 목록 1~3절과 라이트세이버 두 손은 디렉터가 main 에 올리는 중 — 올라오면 main 을 병합한다.
2. (끝남) Q13 값 제안. R3 구현 뒤: 제안서 5절 확인 명령. R3 뒤: 밸런스 수치 다시 재서 제안(빌드 커밋 적기).
3. R2 시험판이 나오면 붉은 팀 명령(병합 목록 5절).
