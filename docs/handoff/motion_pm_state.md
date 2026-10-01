# 인체 동작 연구 PM — 상태 (늘 최신으로 둔다)

- 갱신: 2026-09-30 18:00 (KST). 9/30 정기 보고 보냄(trig_01W494HgL6ALUudV5ssAweB3) — 지금 대기. 새 세션은 이 파일만 읽고 이어받는다.
- 세션: `session_013YFFvQRnDedG7CTF1eVknA` · 브랜치 `claude/pm-motion-research`. **`docs/motion`·`tools/motion` 만 건드리면 디렉터가 검토 없이 main 에 병합한다.** 새 일을 시작하기 전에 main 을 한 번 병합해 둔다.
- 디렉터: `session_014nJCzE4hyxiYc9innhSUng` ("Stillness game director handoff", 사장님 확정). `01NDJ…`(보관됨)·`01Kc…`(은퇴)에는 보내지 않는다.
- 역할: main `docs/pm_roles_charter.md` 부록 A (9/29부터 기본값 시행).

## 일하는 규칙 (디렉터 9/29)

- 보고: 하루 한 번 **18:00 KST**, 10줄 안, "끝남 / 진행 중 / 안 함" + 커밋 해시. 막혔을 때만 그 전에. 확인용 답장은 보내지 않는다.
  보내는 법: `create_trigger`(persistent_session_id = 디렉터, 일정 없음) → `fire_trigger`. 늘 새 트리거.
- 일이 끝나고 다음 지시가 없으면 "대기" 한 줄만 보내고 멈춘다. 폴링·자체 알림 반복 금지. 이미 검증한 것은 다시 검증하지 않는다.
- `src/` 는 건드리지 않는다. 코드·문서·커밋에 AI 모델 이름을 쓰지 않는다. 문서·보고는 한국어 쉬운 말.
- 사람 값은 참고이지 한도가 아니다. 제한·상한·조건은 제안만 하고 넣지 않는다(사장님 몫). 난이도 테스트 금지.
- 비용·저자 연락은 사장님 허락 뒤에만.

## 지금까지 만든 것

| 무엇 | 어디 |
|---|---|
| 롱소드 기준 클립 `stillness-motion-clip/2` 48개 (8 베기 × 좌우 × 작게·보통·크게) + 8자 흐름 2 + 런지 찌르기 2, 크기별 파일 + `index.json` (디렉터: 한 파일에 합치지 말 것) | `docs/motion/clips` |
| 츠바이핸더 크게 벌 v0 8개 (Zornhau·Oberhau·Mittelhau·Unterhau × 좌우) + 따로 `index.json`. 배율은 제안(`build_zweihander.mjs` PROPOSAL, `zweihander_table.md`) | `docs/motion/clips/zweihander` |
| 채점 함수 `score.mjs` (`stillness-motion-score/1`, 정의 `score.md`): 손 오차·위상 오차·최고 순서·칼 방향·동작 범위 → 0~1. compare.mjs 가 같은 함수로 `compare_game.md` 채점 표를 만든다 | `tools/motion` |
| 세이버 moulinet 크게 벌 v0 8개 + 레이피어 런지 2개 (한손: 빈손 채널, 게임 한손 자세표). `build_onehand.mjs` PROPOSAL, `onehand_table.md` | `docs/motion/clips/sabre`, `docs/motion/clips/rapier` |
| 클립 검사기 `validate_clip.mjs` (규칙 = `clip_format.md` §6, 코드 = `lib/clip_rules.mjs` 브라우저에서도 돎). 빌드 도구 넷이 끝에서 스스로 돌린다. 70벌 모두 통과 | `tools/motion` |
| 게임 기록 `stillness-motion-record/1`: 지금 게임 팔 베기 5 (hybrid 걸음, 2 s 서 있기), 시험판 팔·결심 베기 8 (claude/wbs-impl d781ab9) | `docs/motion/records` |
| 문서: README(처음 볼 곳) · longsword_cuts · spec_table(자동, §7 복귀·시작·끝 자세) · evaluation · targets(초안) · clip_format(clip/2, 재설계 atlas 채널 대조 §3-6) · compare_game(자동) · review_wbs_trial · lunge_flow · flow_table/lunge_table(자동) · weapon_body · sources | `docs/motion` |
| 비교 화면 (막대 인형 + 게임 기록 겹치기 + 다섯 기준) | `tools/motion/viewer.html` (vite), 공개 페이지 https://claude.ai/artifact/9WQuMAwtePPqLZjM5o49cC (9/29 v19: 롱소드·츠바이핸더·세이버·레이피어, 원문 대조 반영) — 게시본은 viewer.html 의 `BEGIN-ARTIFACT`…`END-BODY` 사이를 떼어 `MOTION_DATA_BASE = './'` 로 바꾸고 clips·records 를 옆에 둔 것 |

## 열린 요청

- 디렉터 9/29 과제: (a) 채널 대조·빠진 채널 채우기 — **끝남** (a489576, clip/2). (b) 복귀 구간 표본·끝 자세와 가장 가까운 게임 자세 — **끝남** (a489576, spec_table §7: 52벌 모두 시작·끝 자세 = 목표 자세, 손 오차 0 cm). (c) 보통 벌 사이 자세·감기 직후 손목 넘침 — **R2 시험판 뒤에**.
- 디렉터 9/29 14:05: R2 명세(main docs/strike/r2_impl_spec.md 11장) 확인 6건 — 답을 `clip_format.md` §3-7 에 적음. 9/30 18:00 보고에 한 줄씩. 고칠 것(보통 벌 tw 칼, stance 표시, 이른 걸음)은 v1.
- 디렉터 9/29 13:00 사장님 답 전달: 시작 자세 표(무리 × 크기별 자연스러운 게임 자세, 중간 자세 시작) — **끝남** (`start_poses.md`, 기한 9/30 18:00). 다른 무기 클립은 배율 목표 없이 관성·몸 몫 근거만 — **고침**. Q1 그만두기 = 물리만, Q5 앞꿈치 돌림 허용(feet yaw 그대로).
- 디렉터 9/29 11:48 과제: ① 검사기 — **끝남** (9e03989) ② 츠바이핸더 large v0 — **끝남** (8f01c96) ③ 세이버 moulinet 4무리 · 레이피어 런지 large v0 — **끝남(9/29 앞당김, c07fa10)**. 한손 자세표는 guards.js ONE_HAND 글을 읽어 검사(게임이 BASE_ONE 을 내보내면 그걸로 — 디렉터에게 제안). 연구 ASS 표본 점검 결과(9/29 인용 5건) 붙임 — **끝남**: ARMA 33.5 m/s 는 계산 예시라 근거에서 뺌, 손-발 시간차 1차 출처 Gholipour 2008, 거합 0.6 m/s·롱소드 모캡 세부 ▶검증 필요 (sources.md §0-2) ④ score.mjs — **끝남(9/29, 15b2240)**. 소견: 작게 벌은 게임 자세표를 이은 것이라 지금 게임 기술 길과 손 오차 0.11~0.39 m — 게임 비교에는 게임 기록 자체를 기준으로 쓰는 편이 맞을 수 있다(디렉터 판단).
- R2 시험판이 나오면 소견 (디렉터 chain.mjs 는 record/1 형식으로 기록을 낸다).
- 사장님 답(9/29 13:30): 비교 화면 "지금 게임보다 훨씬 낫다"(방향 맞음) · 모캡 자료 요청 안 함 · 직접 촬영 안 함(계획에서 뺌) · Meyer 번역서 사 주심 — 받는 형태(드라이브 비공개 PDF/EPUB, 저장소엔 메모만)를 18:00 보고에 한 줄 · 논문 사이트는 여는 쪽으로 논의 중(열리면 알림).
- 사장님 9/29 밤: 웹 제한 풀림(idosi·researchgate·IEEE 만 사이트 쪽 거절, sources.md §0-1). Meyer 는 **유료 번역 대신 sprechfenster.org 의 무료 Garber 영역 + 1570 독일어 원문을 교차**하기로 함 — 대조 끝남(69e73ac, sources.md §0-3). 독일어 원본(라이프치히 대학 도서관 영인본, 퍼블릭 도메인, 사장님 드라이브) 받음 — §0-3 폴리오를 원본 쪽에서 모두 확인, 쪽 찾기 공식은 §0-3. 뒤삭은 "반만 / 끝까지" 둘 다 가르쳐 세이버 차이는 거둠, Schielhau 는 지붕에서도 시작. 검색 요약만 적었던 인용을 원문으로 다시 확인 — **끝남**(sources.md §0-2·§1): ARMA 계산 예시 맞음 · Gholipour 수치 맞음, 표본 8명(4+4)이고 저자는 숙련자 0.07 s 를 "거의 함께"로 읽음(런지 문구 고침, 클립 값 그대로) · Mulloy·투포환 맞음 · Klempous 모캡 세부는 초록으로 확인, 공개 자료 없음 · Ringeck 다섯 베기 주해 맞음(Trosclair 역 비영리 조건) · Figueyredo 는 베기마다 얼굴 앞에서 멈춤("멈추지 않고 잇는다"는 틀림) · 세이버 moulinet: Burton 은 팔을 거의 편 원, Allanson-Winn 은 손목을 어깨 가까이.

- 디렉터 9/29 21:06 v1 과제(기한 9/30 18:00): ① 보통 벌 감기 칼을 작게·크게 가운데로 — **끝남** (tw 차이 작게↔보통 69·90·81° → 47·61·58°, 손목 최대도 줄어 Zwerch 175 → 159°) ② 이른 걸음 — **끝남** (발 뗌 0.41 → 0.33 s, 디딤 tc, 발 최고 7.9 → 4.2 m/s) ③ `stance` 칸 + 검사 F5·T1 — **끝남** ④ 70벌 검사 통과·index 갱신 — **끝남**. 한손 자세표: main b403696 병합, 검사기가 GUARD_BASE_ONE 을 그대로 읽음 — **끝남**(70벌·X1 통과). 보고는 9/30 18:00 정기 보고에 합침(자체 알림 trig_01Ejgv8cVYLczq7HUA3RmtoW 17:52).

- 디렉터 9/30 01:10 사장님 지시(근접 밀어내기): 의견 `docs/motion/close_quarters_opinion_2026-09-30.md` 올림(09b2ca2), 디렉터에게 알림. 클립은 지시 오면 만든다. Fiore 발차기·Ringeck 밀어내기는 원문 대조 전 [기억].

- 디렉터 9/30 22:00 (R2 시험판 실패 — 사장님): ① 사람 움직임 봉투 `docs/motion/human_envelope_2026-09-30.md` + `tools/motion/human_envelope.json` (`node tools/motion/envelope.mjs`) — **끝남**. ② 10/1 아침 `docs/strike/r2_live_diagnosis_2026-09-30.md` 가 main(또는 dev 가지)에 올라오면 검객 역학 독립 검토 `docs/motion/r2_diag_review_2026-10-01.md` (≤40줄) → 디렉터 트리거 5줄. 정기 보고 18:00 그대로.

## 다시 만들기

```bash
node tools/motion/build_clips.mjs     # 클립 48 + index.json + spec_table.md (다른 도구가 끼운 흐름·런지 항목은 지킨다)
node tools/motion/build_flow.mjs      # 8자 흐름 2 + flow_table.md (build_clips 뒤)
node tools/motion/build_lunge.mjs     # 런지 찌르기 2 + lunge_table.md (build_clips 뒤)
node tools/motion/record_game.mjs     # 지금 게임 기록 (hybrid, 2 s 서 있기)
WBS_REV=d781ab9 node tools/motion/record_wbs.mjs --root=<claude/wbs-impl 체크아웃>
node tools/motion/compare.mjs         # compare_game.md
node tools/motion/qa_clips.mjs        # 겹침 검사 (칼 ↔ 몸, 아래팔 ↔ 몸통)
node tools/motion/build_zweihander.mjs # 츠바이핸더 크게 벌 8 + zweihander_table.md (build_clips 뒤)
node tools/motion/build_onehand.mjs   # 세이버 8 + 레이피어 런지 2 + onehand_table.md (build_lunge 뒤)
node tools/motion/validate_clip.mjs   # 클립 검사 (clip_format.md §6). 빌드 셋이 끝에서 스스로 돌린다 — 어긋나면 종료 코드 1
npx vite                              # → /tools/motion/viewer.html
```

## 알려진 흠 (다음 할 일 후보)

- 크게 감기 초반 등 8벌에서 아래팔이 몸통에 0.01~0.22 s 동안 25~40% 들어간다(쥔 손이 가슴 앞에 가까워 팔꿈치로는 못 비킴) — 키를 고칠 거리. 칼이 몸을 지나가는 클립은 없다.
- 보통 벌 감기에서 손목(아래팔-칼) 각이 160° 를 넘는 베기가 있다(Zwerch 175° 등) — 디렉터: R2 뒤에.
- 런지·세이버·테니스 수치 가운데 아직 `snippet` 표시인 것은 원문 확인 전이다(웹은 9/29 밤 열림).
- v1 견줄 거리(9/29 밤 원문에서): 츠바이핸더 베기마다 칼을 얼굴 앞에 세워 멈추는 벌(Figueyredo) · 세이버 팔을 편 큰 moulinet(Burton) · Zwerchhau 를 분노의 자세에서 시작(Meyer).
- 츠바이핸더: 빈 팔 아래팔이 몸통에 들어가는 순간 — Mittelhau 오른쪽 감기 초반 0.28 s 동안 53% (롱소드 같은 곳 41%), Unterhau 왼쪽 35%. 롱소드 키 모양을 늘인 것이라 몬탄테다운 흐름·리카소 쥐기는 없다.
- 왼쪽 벌은 오른손잡이 몸의 거울이라 온전한 거울이 아니다(clip_format §2) — 가운데 자세는 게임 값, 거울 손이 팔 길이를 넘으면 당김.
- 세이버: 칼끝 최고 때 손목 몫 63~79%(같은 측정으로 롱소드 43~66%) — 팔꿈치·어깨 원을 키우는 재저작 거리. 레이피어는 게임 자세(왼발 앞) 때문에 앞발 런지 — 오른발 패서타는 다음. 세이버 Oberhau 칼이 감기 때 머리 뒤 0.05 m 를 지남.
