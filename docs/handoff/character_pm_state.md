# 캐릭터 PM 상태 (늘 최신)

세션 `session_01HSrct4UE9qVgfTi4hd59qi` · 브랜치 `claude/pm-characters` · 디렉터 `session_014nJCzE4hyxiYc9innhSUng` · 갱신 2026-09-29

## 맡은 일
- 캐릭터 5명 + 변형(`src/characters.js`): 시트·성격 수치(persona.level/pers)·감정 문턱값·대사·**온몸 타격 기질(persona.whole)**
- `src/ai.js`의 감정·부활 부분, `src/emotions.js`, `src/schools.js`의 유파 꾸러미 값(기술 변경은 아님)
- 설정집·프로필·기록: `docs/character_lore.md`, `character_profiles.md`, `characters.md`, `settings_audit.md`, `character_whole_body.md`
- 라운드마다 성격·승률 점검 → `docs/reviews/R<n>_characters.md` (기준선 `baseline_characters_940f665.md`)

## 불가침 (내가 안 건드리는 것)
`src/fighter.js` · characters.js의 `look`/`lookVersion`(외형 PM) · 이졸데 `revive`(디렉터) · ai.js의 온몸 부분(opportunity, seize, planStrike, 디렉터) · schools.js 기술 · main 직접 푸시 · 제한·상한 넣기(사장님) · 난이도 테스트 · 모델 이름

## 지금 상태
- 브랜치 = main 940f665 + 온몸 기질 초안(persona.whole, 게임 미연결) + 이 문서들. fights12 회귀는 origin/main 기준과 바이트 동일(whole은 읽히지 않음).
- 시트에 값만 있는 칸(게임 미연결): persona.whole(온몸 기질), persona.close(근접 밀치기). persona.idle은 ai.js holdStart로 연결됨(시작 정지 2초, 발 고정).
- 광기의 하인리히 도른(`heinrich_mad`, '밤의 왕', 낮 +20%)은 main cc746f6에 반영·배포 완료.

## 열린 요청 (사장님 답 대기)
1. 여정 대화 목업 v3 — **보류(사장님이 다시 말씀하실 때까지, 9/29 13:30)**. 관련 작업 없음. https://claude.ai/artifact/CFPNVy9ug6ZPdHZxmDJtmK (스테이지 사이 대사창 임시 화면, 대사 전부 임시, 설정집 미저장). 다시 열리면 분담: 화면·전환 디렉터 / 대사 본문 캐릭터 PM(`lines.arrive`·`lines.road`).
2. 설정 점검 ⑥-4·5·8 (`docs/settings_audit.md`).
3. 온몸 타격 제한 둘(`docs/character_whole_body.md` §7): "검술 낮으면 동작 작다"는 S에 걸지 말 것 / Q2 감기 공짜 거두기.

답 받은 것(9/29 13:00): 광기의 하인리히 조급함 그대로 · Q1 물리로만 · Q3 S 상한 없음 · Q5 발 돌림 허용 · Q8 최소 감기 제한 없음(기질값만) → `character_whole_body.md` §6 반영.

## 다른 PM에게 기다리는 것
- 동작 PM: 캐릭터별 감기 모습 범위(브란 windup 1.6 ~ 하인리히 0.28) → 오면 `windLen`을 그 안으로 재조정.
- 디렉터: R5에서 persona.whole 연결 + §5의 판별 기록(고른 S·감기 비율·틈 본/간 횟수·비켜선 횟수).

## 재현 명령
```
# 기본 AI 회귀 (origin/main 워크트리에서 기준을 뽑아 HEAD와 cmp — 바이트 동일해야 함)
node tools/sim/fights12.mjs > head.txt
# 성격·균형 기준선 (docs/reviews/baseline_characters_940f665.md와 같은 명령)
node tools/sim/characters_eval.mjs rr 8
node tools/sim/characters_eval.mjs passive 6
node tools/sim/pair_sweep.mjs <A> <B> precision <A의 현재 precision> 8 45   # 10쌍
# 시트 확인
node -e "import('./src/characters.js').then(m=>console.log(Object.keys(m.CHARACTERS_BY_ID)))"
```

## 다음 할 일
- [x] 시작 정지 동안 persona.idle 자세 잡기 — ai.js holdStart (발 고정, 시간값은 ARENA.startHold만). 9/30
- [ ] 근접 밀치기 동작(디렉터·동작·무기 PM)이 생기면 persona.close 연결
- [ ] 사장님 답(위 1·3) 오면 반영
- [ ] 동작 PM 범위 오면 windLen 재조정
- [ ] R5 연결 뒤 `docs/reviews/R5_characters.md`: 기준선 대비 성격 유지 확인
- [ ] (보류) 여정 대사 — 사장님이 다시 말씀하실 때만
