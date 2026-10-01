# 외부 검수 안내문 — 적막(Stillness) (2026-10-01)

이 문서는 저장소 밖의 검수자(사람·도구 어느 쪽이든)를 위한 한 장짜리 안내입니다. 저장소는 공개이며 포크·클론이 자유롭습니다.

## 1. 무엇인가
- 모바일 웹 물리 롱소드 결투 게임. Three.js 렌더 + Rapier 능동 인형(16토막, 약 75 kg) + Vite.
- 조작: 이동 스틱, 손가락으로 칼 손을 끌어 베기, 탭으로 찌르기. 상대 AI는 플레이어와 같은 파이터 코드를 씁니다.
- 지향: 화려함이 아니라 정직하고 적막한 일촉즉발의 결투. 힘은 물리에서 나와야 하고(중력·질량·힘 전달), 결과는 물리가 정합니다. 숨은 상한·쿨다운·스크립트된 연출을 피합니다.
- 플레이: https://yoonjl-svg.github.io/halfsword/ (본판). 탐색판: `/corr/`(검술 보정 v2, `?corr=v2`), `/wb/`(보류된 온몸 타격 R2 — 실패 판정, 참고용).

## 2. 어디에 무엇이 있나
| 무엇 | 어디 |
|---|---|
| 게임 코드 | `src/` (물리 인형 `fighter.js`, 조작·검술 `skill.js`, 전투 판정 `combat.js`, AI `ai.js`, 걸음·균형 `gait.js`, 설정값 `config.js`) |
| 결정 기록(사장님 결정·디렉터 판단, 시간순) | `docs/decisions.md` |
| 사장님 미승인 기본값 표(84행) | `docs/strike/owner_defaults_table.md` |
| 구조 지도·확장 방향 | `docs/design/structure_map.md`, `direction_*.md` |
| 온몸 타격 R2 진단(실패 원인·잣대·관문 요구) | `docs/strike/r2_live_diagnosis_2026-09-30.md` |
| 검술 보정 v2 설계·측정 | `docs/strike/correction_v2_design_2026-10-01.md`, `corr_v2_measure.md`(feat-corr 가지) |
| 근접 밀치기 설계·구현 기록 | `docs/strike/shove_design_2026-09-30.md`, `shove_impl_record_2026-09-30.md` |
| 사람 움직임 봉투(관절 범위·각속도) | `docs/motion/human_envelope_2026-09-30.md`, `tools/motion/human_envelope.json` |
| 시뮬·관문 도구와 기준 sha | `tools/sim/README.md` |
| 브라우저 도구(스모크·스크린샷) | `tools/browser/` |
| 디렉터 인수인계(현재 상태) | `docs/handoff/director_state.md` |

## 3. 가지(branch)
- `main`: 본판. 배포는 main 푸시 때 자동(GitHub Pages).
- `claude/first-game-development-2q36ha`: 디렉터 개발 가지(= main + 문서).
- `claude/pm-*`: PM(동작 연구·무기·캐릭터·외형·사운드·기획) 가지. 본판에는 병합된 것만.
- `claude/wbs-impl`, `wbs-diag`: 온몸 타격 R2(보류)와 그 진단 도구. 검수 대상이 아니라 참고.
- `feat-corr`, `feat-support`: 진행 중인 탐색(검술 보정 v2, 보이지 않는 받침 줄이기). 바뀌는 중.

## 4. 돌려 보기
```
npm ci
npm run dev            # http://localhost:5173
node tools/sim/fights12.mjs      # AI 12판, 바이트 동일 관문 (기준 sha: tools/sim/README.md)
node tools/sim/live_battery.mjs  # 칼 조작 수락 시험
node tools/browser/smoke.mjs     # 개발 서버 필요, 콘솔 오류 0
```
- 시뮬은 결정적입니다. 코드가 바뀌면 stdout 의 sha256(앞 8자리)로 "바뀌었나"를 먼저 보고, 바뀌었으면 왜인지 설명합니다. 12판은 소음이 커서 좋다/나쁘다 판단에는 36판 이상을 씁니다.

## 5. 검수에서 보고 싶은 것
1. **물리 정직성**: 보이지 않는 힘·운동학 강제·연출용 보정이 숨어 있는 곳. 알려진 것: `GAIT.assist 0.3`(몸무게 30 %를 보이지 않는 힘이 받침)과 catch 반사 — 줄이는 작업 진행 중.
2. **숨은 상한·쿨다운·바닥값**: 사장님 승인 없이 들어간 것(표에 없는 것이 있으면 특히).
3. **구조·복잡도**: 파이터 코드의 제어기 중첩(균형·걸음·검술 보정·마무리·밀치기)이 서로 싸우는 곳, 죽은 경로, 중복 상수.
4. **결정 기록과 코드의 불일치**: `docs/decisions.md`에 적힌 결정이 코드에 그대로인가.
5. **모바일 성능**: 60 fps 묶음, 셰이더 예열, 할당.

## 6. 규칙(기여할 때)
- 핵심 기능에 상한·한도·바닥값·쿨다운을 새로 넣지 않습니다. 필요하면 "왜 물리로 안 되는가"를 적고 질문으로 남깁니다.
- 바꾸면 반드시: `node --check`, fights12·live_battery sha 전후, 스모크 콘솔 오류 0. 결과가 바뀌는 변경은 그 이유를 커밋 메시지에.
- 문서에 AI 모델 이름을 쓰지 않습니다(등급으로만).
- 제안은 포크 → 풀 리퀘스트. 디렉터가 관문을 돌려 본판에 넣습니다.

## 7. 지금 열려 있는 질문(참고)
- 판금 상대 찍기 즉사 규칙(A/B/C), 보이지 않는 받침의 적정값, 긋기(B) 입력의 거취, R2′(물리 기반 몸 참여) 설계 순서(발 받침 → 골반 먼저 → 팔). 자세한 것은 `docs/decisions.md` 끝부분.
