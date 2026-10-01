# 무기 PM → main 병합 목록 (디렉터 9/29 지시 2·4)

브랜치 `claude/pm-weapons-balance` (main `940f665`까지 병합한 상태 기준). 디렉터가 경로마다 `git diff origin/main origin/claude/pm-weapons-balance -- <경로>` 로 떠서 올린다. 브랜치 통째 병합은 하지 않는다.

- 표시: **게임 바뀜 없음** = 게임이 읽지 않거나 기본 꺼짐. **⚠ 게임에 닿음** = 실제 판이 달라진다(따로 결정).
- 검증 명령(공통): 아래 세 개가 올리기 전과 **바이트 동일**이어야 한다(⚠ 항목만 예외 — 권총·라이트세이버 줄).
  - `node tools/sim/fights12.mjs > a.txt` · `node tools/sim/hybrid.mjs fights12.mjs > b.txt` · `node tools/sim/live_battery.mjs > c.txt`
  - `node tools/sim/weapon_smoke.mjs` (모든 줄 OK, nan=false)

## 1. 문서 — 게임 바뀜 없음
| 경로 | 내용 |
|---|---|
| `docs/weapon_types.md` | 무기 분류(몸 틀 5 × 싸움 방식 5), 15종 실측, 자루 판정 |
| `docs/weapon_motions.md` | 무기군별 필요 개수, 자세·기술 값과 근거, 96판·리그전 표, 규칙 6, 지금 게임 제안 |
| `docs/pole_frame_design.md` | 자루 무기(봉·창) 설계와 시제품 측정 |
| `docs/weapon_motion_sources_one_pole.md` | 한손·자루 무기 원전 조사 |
| `docs/handoff/motion_library_integration.md` | 라이브러리를 게임에 잇는 자리·순서, §8 자루 무기 3단계 |
| `docs/handoff/weapon_motion_research_brief.md` | 연구 ASS 지시서 |
| `docs/weapon_layer.md` | 무기 층 인터페이스 초안(온몸 타격이 무기마다 읽을 값) |
| `docs/handoff/weapons_merge_list.md` | 이 문서 |
| `docs/handoff/weapon_pm_state.md` | 무기 PM 상태(맡은 일·열린 요청·재현 명령) |
| `docs/handoff/*.jpg` 6장 | `motion_gallery`(192 KB) · `motion_clips`(158 KB) · `staff_clip` · `staff_clip_lib` · `spear_clip_lib` · `lightsaber_two_hand` (각 41~65 KB) |
| `docs/weapons_balance_status.md` | 무기 PM 상태 파일(긴 기록). main 판과 절이 섞여 있으니 **브랜치 판을 통째로** 올리면 된다 |

## 2. 코드 — 게임 바뀜 없음
| 경로 | 무엇 | 왜 게임이 안 바뀌나 | 검증 |
|---|---|---|---|
| `src/weapon_class.js` (새 파일) | 분류 함수·표 + 무기 층 `WEAPON_LAYER`·`weaponLayer()` (칸만) | `weapons.js` 가 불러 스펙에 `frame`·`style` 칸만 붙인다. 게임 코드에서 두 칸을 읽는 곳 없음(`grep -rn "\.frame\b\|\.style\b" src`) | 공통 |
| `src/weapons.js` 의 **분류 부분만**: `import { classifyWeapon }` 한 줄 + `finalizeSpec` 의 `const spec = {…}; spec.frame/style = …; return spec;` | 이름표 칸 | 위와 같음 | 공통 |
| `src/weapons.js` 모노호시자오 `motionSkip: ['지붕 (Vom Tag)']` | 라이브러리용 칸 | `motion_library.js` 만 읽는다(기본 꺼짐) | 공통 |
| `src/motion_library.js` (새 파일) | 동작 라이브러리 | 기본 꺼짐(`MOTION.lib=false`), 게임 코드에서 import 없음 | 공통 |
| `src/guards.js` 2곳: `GUARD_BASE`·`GUARD_BASE_ONE` export, `guardAt` 의 `const T = out.table ?? (…)` | 라이브러리 자세표 이음 | `out.table` 을 채우는 곳은 라이브러리뿐 → 없으면 예전 식 그대로 | 공통 |

## 3. 도구 — 게임 바뀜 없음 (tools/ 는 게임이 읽지 않는다)
| 경로 | 쓰임 |
|---|---|
| `tools/sim/motion_lab.mjs` | 자세·휘두르기·탭 찌르기·결투·막기 자리 점검 (`EXTRA=pole` 이면 봉·창도) |
| `tools/sim/motion_league.mjs` | 리그전 켬/끔, `ONLY=`·`EXTRA=pole` (weapon_league 의 report 를 씀) |
| `tools/sim/weapon_classes.mjs` | 분류 표 + 가상 무기 판정 |
| `tools/sim/blunt_zones.mjs` | 둔기 부위 효과표 시제품(판정 제안, 게임 미적용) |
| `tools/sim/proto_weapons.mjs` | 한손 도끼·메이스 시제품 |
| `tools/sim/staff_proto.mjs` | 봉 시제품 실험 (env 스위치 다수) |
| `tools/sim/pole_specs.mjs` | 봉·창 시제품 스펙 (motion_league·motion_lab·browser 가 부름) |
| `tools/browser/motion_gallery.mjs` · `motion_clips.mjs` · `staff_clip.mjs` | 자세 모음·기술 장면·봉/창 영상 (vite 서버 필요) |
- 도구 사이 의존: `motion_league` → `weapon_league`(main 에 있음)·`pole_specs`; `staff_proto`·`proto_weapons` → `blunt_zones`; `motion_lab` → `pole_specs`. **도구는 한 묶음으로** 올려야 한다.

## 4. ⚠ 게임에 닿는 것 — 따로 결정
| 경로 | 바뀜 | 잰 값 | 상태 |
|---|---|---|---|
| `src/weapons.js` 라이트세이버 `grip: 'one-hand' → 'two-hand'` (+ 주석 3줄) | 라이트세이버를 두 손으로 쥔다(한손 자세표 대신 두손 표). 겉모습 `docs/handoff/lightsaber_two_hand.jpg` | ability_test 48판 롱소드 상대 63% → 65% (95% 48~75 / 50~77) | 사장님이 "찾아보고 정해"로 맡기신 결정(무기 PM 결정). main 에 올리면 라이트세이버 판만 달라진다 |
| (적용 안 함) 밸런스 수치 3개 + 청강검 선택안 | — | `docs/weapon_motions.md` §6-2 | 사장님 결정 대기 |

- 라이트세이버 한 줄만 빼고 올리려면: `weapons.js` 는 위 2절 두 부분(분류·motionSkip)만 손으로 옮긴다.
- 올린 뒤 검증: 공통 세 개 바이트 동일(라이트세이버를 넣었으면 fights12·live_battery 에 라이트세이버가 나오는 판만 달라지는지 확인), `node tools/sim/weapon_classes.mjs` 로 15종 분류 표가 `docs/weapon_types.md` 표와 같은지.

## 5. 붉은 팀 명령 (R2 시험판이 나온 날)
시험판 워크트리 경로를 `W` 에 넣고 한 줄로(4갈래, 약 30분, 91짝 × 48판, 라이브러리 끔):
```
W=/path/to/r2-worktree; for k in 0 1 2 3; do node $W/tools/sim/motion_league.mjs run 24 $k 4 off > /tmp/rt.$k.jsonl 2>/dev/null & done; wait; node $W/tools/sim/motion_league.mjs report /tmp/rt.*.jsonl
```
- 워크트리에 3절 도구가 있어야 한다. 비교 기준: 이 브랜치(라이트세이버 두 손)에서 같은 명령 → 등급 평균 25 · 48 · 46 · 52 · 71, 0% 짝 1개(고무 닭 대 라이트세이버), 약한 쪽 중앙값 31% (`docs/weapon_motions.md` §5-3).
