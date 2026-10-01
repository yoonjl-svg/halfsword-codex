# 사운드 PM 인계서 (새 세션용)

새 사운드 PM 세션은 이 문서부터 읽는다. 차수별 변경 기록은 [`pm-sound-impact.md`](pm-sound-impact.md)에 있다.
그 문서 앞부분(합치기·바뀐 파일)은 옛 브랜치 기준이라 지금과 다르다. 지금 상태는 이 문서가 기준이다.

작성: 2026-09-28. 이때 main은 `00c560d`이고, 사운드 작업은 전부 main에 병합되어 있다(마지막은 `b5da38e`, 카드 뒤집기 소리).

---

## 1. 역할과 규칙

- **역할**: "Stillness"(적막, 옛 제목 미들 소딩)의 사운드 PM.
  - 게임은 Half Sword 같은 물리 롱소드 결투다. Three.js + Rapier로 만들었고, 아이폰 모바일 웹이 주 대상이다.
- **사람**:
  - 오너(사장님): 들어 보고 결정한다.
  - 디렉터(별도 세션): 병합·배포하고 `main.js`를 소유한다.
- **고칠 수 있는 파일**:
  - `src/sound.js`, `src/soundgen.js`, `src/soundlab.js`, `sounds.html`, `public/sfx/**`
  - `src/config.js`의 SOUND 블록
  - `src/main.js`의 **사운드 호출 줄만**. 디렉터 요청에 따라 최소로 고치고, 보고에 정확한 전/후 조각과 행 번호를 적는다.
  - `src/gun.js`는 디렉터 모듈. 소리 함수(`gunshotSound`·`reloadSound`)만 디렉터 지시로 고친다(30차: 첫 줄 한 줄로 `sound.gunshot` 에 넘김).
- **건드리지 않는다**:
  - `src/fighter.js`
  - main.js의 갑옷·판정 코드(`r.plate`). 소리 호출만 디렉터 요청으로 고친다.
    - (방어구 병합에서 반영됨: `PLATE_PARTS`는 없어졌고 `onWound`가 `r.plate`로 `plateBlock`·`plateBreak`를 부른다 — `pm-sound-impact.md` 7차 덧붙임)
- **브랜치**: `claude/pm-sound-impact`에만 커밋·푸시한다. **main에 직접 푸시하지 않는다.** PR은 요청이 있을 때만 만든다.
  - 디렉터가 병합하면 브랜치를 main에서 다시 시작한다: `git fetch origin && git checkout -B claude/pm-sound-impact origin/main`, 그다음 푸시는 `--force-with-lease`.
- **커밋 메시지**: 영어로 쓴다. 끝에는 세션이 주는 attribution 줄을 넣는다. 코드·커밋에 모델 이름을 쓰지 않는다.
- **주석**: 한국어로, 기존 톤(쉬운 말, 소리를 의성어로)을 따른다.
- **음원 라이선스**:
  - CC0 또는 재배포 가능한 것만 쓰고, 파일별 출처를 `public/sfx/LICENSE.txt`에 적는다.
  - 추가 음원은 한 번에 ~600KB 이내로 한다. 지금 `public/sfx` 전체는 504KB다.
- **폰 부담**:
  - 합성 소리는 일꾼 스레드(`soundgen.js`)가 미리 만들어 둔다(BANK).
  - 실시간 노드는 적게 쓰고, 동시 소리 수는 `SOUND.maxVoices`(12)로 제한한다.
  - 우선순위(prio)가 낮은 배경 소리는 전투 소리에 자리를 내준다.
- **iOS**: 무음 스위치를 켜도 소리가 나게 `navigator.audioSession.type = 'playback'`을 쓴다. 잠금이 풀리면 `unlock()`을 다시 부른다. 이 처리를 유지한다.

## 2. 디렉터와 연락하기

- SendMessage는 디렉터 세션에 닿지 않는다. **트리거로 보낸다**:
  - `mcp__Claude_Code_Remote__create_trigger`에 `persistent_session_id`(디렉터 세션 id)와 `run_once_at`(몇 분 뒤)을 준다.
  - **디렉터 세션 id** (2026-09-29 11:16 KST, 은퇴 디렉터의 알림 — 사장님 지시): 진짜 디렉터 = `session_014nJCzE4hyxiYc9innhSUng`("Stillness game director handoff", 사장님이 직접 만든 세션). 옛 디렉터 `session_01KcYCh6UfKjrR4m8QjPcEbM`는 은퇴했고 더 보내지 않는다. 디렉터 인계서는 main `docs/director_handoff.md`(`940f665`).
    - 혼선 기록: 같은 날 09:59에 옛 디렉터가 `session_01NDJVGN7xsXPq19Yzry3BvH`("디렉터 · Stillness 총괄 (새)")을 새 디렉터라고 알렸으나, 이는 옛 디렉터가 만든 중복 세션이었고 보관됐다. 그쪽으로 보낸 인수 보고는 014n에 다시 보냈다.
    - 보고 전에 `get_session`으로 살아 있는지(RUNNING, 제목) 한 번 보는 습관은 유지한다.
  - 보고는 짧게 쓴다: 커밋 해시, 무엇을 했는지, main.js 전/후 조각, 관문 결과.
  - **새 디렉터 규칙(2026-09-29)**: 보고는 하루 한 번 18:00 KST, 10줄 안, "끝남 / 진행 중 / 안 함"과 커밋 해시. 막혔을 때만 그 전에. 확인용 답장 금지. 일이 끝나고 지시가 없으면 "대기" 한 줄. 폴링·자체 알림 반복 금지. 이미 검증한 것은 다시 검증하지 않는다. 상태 파일 `docs/handoff/sound_pm_state.md`를 늘 최신으로. 역할 분담안(main `docs/pm_roles_charter.md` 부록 B [사운드 PM]) 기본값대로. 제한·상한·조건은 제안만(사장님 몫). 난이도 테스트 금지.
- 디렉터의 지시·병합 알림은 이 세션에 "scheduled trigger" 알림으로 온다. `ReadNotifications`로 읽는다.
- 디렉터가 요구하는 **관문**:
  - 시뮬 3종이 main과 **바이트 동일**: `node tools/sim/live_battery.mjs`, `node tools/sim/fights12.mjs`, `node tools/sim/characters_eval.mjs both 2`.
    - 시뮬은 sound.js를 부르지 않아서 보통 그대로 통과한다. 그래도 main 워크트리와 브랜치에서 각각 돌려 `cmp`로 비교해 보고한다.
  - 브라우저 콘솔 에러 0.
  - 실제 게임에서 해당 소리를 확인한다(녹음 또는 파형 그림 첨부).

## 3. 지금 게임에 들어 있는 소리 (전부 main에 있음)

### 전투
- **재질 쌍 충돌** `sound.impact({ a, b, energy, pos })`
  - 재질: steel, armor, flesh, wood, plasma, rubber, frozen.
  - main.js `onClash`: 강철끼리면 `clash`, 아니면 `impact`로 보낸다.
- **칼끼리** `clash`: 무겁고 짧은 "챙". 냄비 소리가 나는 대역을 파내고, 쇠가 갈라지는 "크랙"을 넣었다. 마림바 같은 음정은 없다.
- **피격** `cut`·`stab`·`blunt`·`helmet`·`bone`: 대전 게임(사무라이 쇼다운)식 피격음이다. BANK의 `hitCut`, `hitStab`, `hitBlunt`, `hitArmor`를 쓴다.
- **판금** `plateBlock(energy, { material, pos })`, `plateBreak(energy, { pos })`: 미리 만들어 두었다. 26차부터 `plateBreak`의 조각 꼬리는 합성 `plateDebris`(지웠다) 대신 `_shard('armor')` 둘~셋(0.1~0.35초에 흩어져 "철컥").
  - main `6669659`(갑옷)에서 디렉터가 연결했다: 막으면 `plateBlock(e, {material})`, 뚫리면 `impact({b:'armor'})`, 판이 완전히 깨지면 `plateBreak(e)`, 투구는 `helmet(e)`. 디렉터의 armor_check로 판정대로 나는 것을 확인했다.
- **휘두르는 바람** `whooshLoop(material)`: 플라즈마는 "훔" 소리를 낸다.
- **칼 긁기** `scrape`: 강철끼리만.

### 몸 소리 (`BodySounds`, fighter.js는 밖에서 읽기만 한다)
- **발소리**: 발이 9cm 위로 들렸다가 6cm 아래로 닿는 순간 낸다. 녹음은 배경마다 다르다(아래 표).
- **쓰러짐**: 골반·가슴이 초속 1m 넘게 떨어지다 땅 근처에서 멈추는 순간 낸다. 배경 바닥 알갱이 소리를 한 겹 더한다.
- **세기 눈금** `hitWeight(energy, e0)` → `{ e, w, low }` (29차, 디렉터 R3 대비): `e` 는 지금 눈금(clamp01(energy/e0)), `w` 는 `hitScale` 이 'log' 일 때 200 J(`SOUND.hitKnee`) 위로 붙는 로그 무게(500 J = 1, 상한 없음), `low` 는 재생 속도 배율. 베기·찌르기·강철 충돌이 쓴다. `hitScale` 은 `SOUND.hitScale`(기본 'legacy' = 게임 소리 그대로) 또는 `sound.hitScale`. 새 타격 소리를 만들면 이 함수로 세기를 받는다.
- **참수** `decapitate({me, pos})` / **떨어진 머리** `headLand(speed, {helmet, pos})` (32차): BodySounds 가 `f.decapitated` 와 `f.bodies.head` 를 보고 부른다. 참수면 죽음 목소리를 내지 않는다. `COMBAT_HOOKS.onDecapitate`(combat.js)는 쓰지 않는다(일꾼에 three.js 가 딸려 오지 않게).
- **칼→몸 소리 후보** `SOUND.fleshHit` (31·33차, 사장님 "전자 파리채로 모기 잡는 소리 같아" → 31차 안은 "둔기·죽도 같다"): 'legacy'(5차 hitSlash, 지금) / 'synth'(날 선 칼 합성 `bladeCut`) / 'rec'(칼 박힘 녹음 `flesh/edge*` + 젖은 꼬리, `_fleshRec`) / 'samsho'(34·35차 대전 게임식 2 `slashHit`: "자-쩌억 + 쿵 + 촤아아악", 112J 위는 강베기 판 `slashHeavy`). 베기·찌르기만 바뀌고 새 안에서는 몸통 "퍽"을 0.25~0.3배로 줄인다. 사장님 선택 대기.
- **리볼버 총성** `gunshot({pos})` (30차, 사장님 "더 파괴력 있는 소리"): `SYNTH.gunshot`(크랙+몸통+충격파) + `SYNTH.gunTail`(바깥 메아리). gun.js `gunshotSound` 가 첫 줄에서 여기로 넘긴다. 꼬리는 `STAGE_SOUND.room` 유무로 정한다. 장전 소리는 gun.js 에 남아 있다.
- **큰 타격 배경 소리 간격** `_spaced(key)` / `_hitCall(kind, k)` (30차, 사장님 "간격을 좀 두자"): 같은 소리는 `SOUND.stageHitGap`(10초) 안에 다시 안 낸다 — gust 의 불길·천·돌·비둘기·박쥐·단풍잎·풍경, 성 안뜰 종, 화전 터 까마귀. 타격음에는 안 건다. 새 배경 반응 소리를 넣으면 `_hitCall` 로 부른다.
- **디딤** `footStrike(strength 0~1, pos)` (29차): 지나는 걸음의 무거운 딛기. 디렉터가 gait 딛는 순간에 잇는다(아직 안 부름).
- **무기 부러짐** `weaponBreak(material)`: 강철(26차: `_shard` "팅-팅" + 작은 "철컥"), 나무 "우지끈", 언 참치 "쩍". 강철 칼도 등급표대로 부러지므로(커먼·레어·에픽) 강철 갈래가 꼭 있어야 한다 — 없으면 나무 소리가 난다.
- **쇠 조각 `_shard(ev, kind, {gain, delay, grit})`** (26차): `swordLand` 조각을 빠르게 돌린 "팅"(blade 1.5~1.9배)/"철컥"(armor 1.15~1.4배) + 선택으로 무대 바닥 알갱이. 25차 조각 착지 소리를 사장님이 좋아하셔서("꽤 좋던데") 부서지는 순간에 쓴다. 새 파일 0KB.
- **내 숨** `breath(d)` (21차, 디렉터 규칙·사장님 승인, C안 녹음). 27차(main `d93c2aa`): 사장님 "지금보다 절반 정도로 작게" → 디렉터가 직접 gain을 0.5+0.2k → 0.25+0.1k로 낮췄다(약 -6dB). 더 줄이거나 키울 때 이 숫자만.
  - 나만 낸다. `blood < 0.8`(VITALS.weakBlood)이고, 아직 피가 흐르거나(`bleed > 0.002`, 붉은 테두리 맥박과 같은 문턱) `blood < 0.6`일 때만.
  - 위험도 d = (0.8 − blood) / (0.8 − 0.45), 간격 5초(d=0) → 2초(d=1) ±15%, 처음 한 번은 1.2초 뒤. 크기는 신음보다 약 9dB 작게 시작해 d=1이면 2.6dB 더 크고 조금 느리게(무겁게) 재생한다.
  - 조건이 풀리면 다음 숨부터 내지 않는다. 죽으면 멈추고, 판이 바뀌면 새 BodySounds라 초기화된다. main.js가 `state === 'fight'`에서만 update를 부르므로 메뉴·카드 뽑기·일시정지에서는 나지 않는다.
- **부활** `revive(who, { breath })` (22차, 사장님 요청): 이졸데가 처음 쓰러진 뒤 하늘에서 성스러운 빛이 내려와 비추고 다시 일어선다. 빛이 내려오기 시작할 때 디렉터가 main.js에서 한 번 부른다(`sound.revive('isolde')`).
  - 소리: 짧은 성가 한 구절 녹음(`stage/chant1.mp3` = Patrick_Corra "Choir" 0~4.3초, CC0, 사장님 선택 D). 처음 만든 합성(반짝임·종·합창 패드)을 "마음에 안 들어. 짧은 그레고리안 성가 같은 느낌으로"라고 하셔서 성가 녹음 후보 6개 중 고르셨다. 칼 부딪힘보다 조금 작다(4초 평균 −27dB).
  - 0.9초에 그 캐릭터의 짧은 숨 들이켬(`rec.revive`)을 곁들인다. 사장님이 1안(같은 배우 "흡", `voice/isolde_revive1.mp3`)을 고르셨다. `breath: false`면 효과음만.
- **상처 신음** `hurt(voice, severity)` (20차, 사장님 승인):
  - 깊은 상처(깊이 0.4 초과)에만 낸다. 한 사람당 2초에 한 번까지이고, 죽는 상처는 죽음 목소리가 대신한다.
  - `VOICES.<id>.rec.hurt`개의 녹음(`voice/<id>_hurt<n>.mp3`)을 쓴다. 죽음 목소리와 같은 배우다.
  - 주인공 목소리는 조금 작게 낸다.
- **칼이 바닥에 떨어짐** `swordLand(speed, material)` (19차, 사장님 승인):
  - 놓친 칼, 또는 쥔 채 쓰러진 칼이 땅에 닿는 순간 낸다. 칼 몸체가 초속 1.2m 넘게 떨어지다 높이 25cm 아래에서 멈출 때다.
  - 튀어서 다시 닿는 것은 0.5초에 한 번만 낸다. 서서 칼을 쥐고 있을 때는 보지 않는다.
  - 쇠(강철·광검 자루)는 합성 "철-컥"(`SYNTH.swordLand`, 칼자루·칼끝 두 번, 울림 0.05초 안), 나무는 "딱", 고무 닭·언 참치는 둔한 "툭"이다. 그 배경의 바닥 알갱이 녹음을 조금 섞는다.
- **죽음** `death(voice, cause, { me })`:
  - `VOICES` 표에서 녹음(`rec`)이 있으면 녹음을, 없으면 합성 목소리를 쓴다.
  - 목을 베였으면 피 끓는 소리를 더한다.
  - 내가 죽으면 목소리 대신 이명과 먹먹함이 온다.

| 캐릭터 id | 죽음 소리 |
|---|---|
| player, generic, bran, heinrich | 녹음 (HaelDB CC0, Baradari CC-BY 3.0, kanyonwyvern CC0). VoiceBosch CC-BY-SA 4.0은 17차에서 뺐다 |
| liao | 녹음 (HaelDB 2번 목소리 = 하인리히와 같은 배우를 작고 조금 낮게). 사장님: "설정상 하인리히와 더 비슷해야"(20차) |
| isolde | 녹음 (mvVoiceActing "girl damage" CC0: 짧게 맞는 소리 두 개, `gain: 1.3`). 사장님이 후보 3개 중 고름(15차) |
| margarethe (슈바르츠) | 녹음 (hisoul CC0: 지친 날숨 섞인 낮은 "하아…", 두 죽음에 같이 씀, `gain: 1.1`). 사장님 선택(15차, "노장이니까"). `mute`는 기능만 남고 쓰는 캐릭터가 없다. 사장님이 아낀 Reitanna 녹음은 `docs/sound_reserve/`에 보관 |

### 배경(스테이지) — `STAGE_SOUND` 표 + `setStage(id)`
- 스테이지는 **고정 순서**로 돈다: 포세이돈 → 화전 터 → 산사 → 성 안뜰 → 밤의 포세이돈 → 대성당 → 다시 포세이돈 (사장님 결정, stages.js `STAGE_ORDER`). 무대마다 그곳 검객이 나온다(`STAGE_FOE`).
  - 어두운 홀(`darkhall`)은 순서에서 빠졌고 `?stage=darkhall`로만 열린다. 소리는 그대로 남겨 두었다.
- main.js는 판을 열 때 `sound.setStage(id)`를 부르고, 그 뒤 `newRound`에서 `roundStart()`를 부른다.

| 배경 | 늘 깔리는 소리 | 가끔 | 큰 타격(`gust`) | 발소리 녹음 | 방 울림 |
|---|---|---|---|---|---|
| poseidon | 먼 파도 + 옅은 바람 | - | - | `step/sand1-8` (모래) | 없음 |
| poseidon_night 밤의 포세이돈 (하인리히 재등장) | 낮보다 낮고 느린 파도(380Hz, 물결 0.06·0.095Hz) + 더 낮고 어두운 바람(480Hz, 1.4kHz 위 닫음) + 네 귀퉁이 화로·횃대 불 "타닥"(fireLoop 좌우, 아주 작게) | 찢어진 검은 천이 펄럭 15~40초 (합성 `clothFlap`) | 바람 잠깐 + 화로 불길 "화르륵"(flare 0.6배) + 천 펄럭 | `step/sand1-8` (모래) | 없음 |
| clearing 화전 터 = 2안 (1안은 `clearing_a`, 비 없는 1안은 `clearing_a_dry`이고 소리는 같다. dry는 비만 뺌) | 잔잔한 봄비(합성 루프 두 겹) + 옅은 숲 바람 + 낮은 바닥 + 오른쪽 멀리 잉걸불 "탁탁"(fireLoop 아주 작게) | 먼 까마귀 20~55초 (녹음 3벌, 3번에 1번 두 번) | 바람만 잠깐 (튀는 소리 없음). 배경이 `onEvent('crows', {amp, pos})`로 알리면 까마귀들이 날아오름(날갯짓 + 까악, 4초에 한 번) | `step/mud1-8` (젖은 재·흙) | 없음 |
| temple 산사 | 솔바람 + 골짜기 바람 | 풍경 9~26초, 산새(작은 산새·휘파람새) 14~40초 | 낙엽 바스락 + 솔바람, 세면 풍경 | `step/gravel1-8` (마사토) | 없음 |
| castle 성 안뜰 | 찬 바람 + 화로 불 "타닥" | 마구간 말(발굽+굴레 / 콧바람) 50~110초 | 눈보라 + 불길 "화르륵" | `step/snow1-8` | 성벽 메아리 0.55초 |
| cathedral 대성당 | 돌 공간의 낮은 "웅—" + 깨진 창 바람 | 비둘기·날갯짓·돌 부스러기 | 돌 부스러기, 세면 비둘기가 날아오름 | `step/stone1-8` | 2.5초 |
| darkhall | 거의 적막 + 벽난로 | 박쥐 | 박쥐 + 불길 | `step/stone1-8` | 1.3초 |

- **판 시작**:
  - 대성당에서만 파이프 오르간 라단조 화음 하나가 2.6초 울린다(`SYNTH.organ`).
  - 무기 뽑기 동안 `newRound`가 두 번 불리므로, 그 사이에 싸움 소리가 없었으면 같은 판으로 보고 다시 울리지 않는다(`_roundOpen`).
- **성 안뜰 종탑**:
  - `stageEvent('bell', { amp, max, pos })`: stage_castle.js가 종이 크게 흔들릴 때 알린다.
  - 교회 종 배음(험 264, 프라임 529, 티어스 633, 퀸트 791, 이름음 1057Hz)을 쓰고, 여운은 최대 8초다.
  - 동시 여운은 3개까지. 좌우는 `sound.listener = camera` 기준이다.
- **배경 전환**:
  - 옛 배경은 약 1초에 걸쳐 줄이고, 새 배경은 0.9초에 걸쳐 차오른다. 옛 노드는 떼어 낸다.
  - 옛 배경의 예약(`_timers`)은 모두 지운다.

### 화면 소리
- **무기 뽑기 카드** `cardFlip({ pick, tier, grand })`:
  - 고른 카드: 두꺼운 카드 "촥" → 0.2초 뒤 낮은 "둥".
  - 에픽·레전드는 작은 반짝임을 더한다. 진짜 엑스칼리버도 등급(레전드)대로만 낸다(사장님: 등급과 별개로 우대하지 않는다, 18차).
  - 고르지 않은 내 카드 한 장: "촥" 한 번(무기 뽑기 v2부터 카드가 내 것 2장 + 상대 무기 1장이다. 예전 두 장용 "촥촥"을 한 번으로 줄였다).
  - 상대 무기 카드: 고른 카드와 같은 소리(`pick: true`, 상대 무기 등급). main.js가 약 0.8초 뒤 부른다. 사장님이 후보(더 낮은 "둥", "스릉") 대신 이대로 두기로 하셨다(18차).
  - 실시간 노드로 만들어서 첫 탭에도 늦지 않는다.
- 예전 `tick()`은 남아 있지만 부르는 곳이 없다.

## 4. 오너 취향 (피드백에서 배운 것 — 꼭 지킬 것)

- **음정이 또렷한 짧은 소리는 싫어한다**: "마림바처럼 통통", "냄비 두드리는 소리".
  - 전투음은 무겁고 짧게, 음정 없이, 쇠는 "날카로운 파열음"으로.
- **발소리**: 낮고 무겁고 짙게("저벅저벅"). 밝은 "또각"과 복도 울림은 안 된다("당나귀가 회랑을 걷는 소리").
- **부활 효과음은 "짧은 그레고리안 성가 같은 느낌"** (2026-09-28): WoW식 반짝임·종·합창 패드 합성은 "마음에 안 들어". 실제 성가 녹음을 쓴다.
- **합성 사람 목소리는 거의 실패했다**:
  - 여성 녹음을 음을 낮추면 → "익룡", "괴수 울부짖음".
  - 합성 숨이 치찰음처럼 새면 → "기차 소리".
  - 합성 한숨·중얼거림 → 폰에서 넷 다 같고 짧게 뭉개짐.
  - 그래서 **실제 녹음을 찾는 쪽이 맞다.**
- **합성 동물 울음도 위험하다**: 말 울음(히히힝)은 오너가 뺐다. 콧바람·발굽처럼 바람·충격 소리만 남겼다.
- **게임의 결은 "적막하고 고독한 대결"이다** (사장님, 2026-09-28):
  - 관중 함성은 넣지 않는다.
  - **칼이 살에 맞는 소리는 "날카로운 금속에 고기가 베이는 소리"**(9/30). 금속 울림·딱딱 튀는 클릭·세게 누른 찌그러짐은 전기 "파직"이 된다("전자 파리채"). 반대로 1~2kHz "탁"과 주먹 "퍽"만 남기면 "둔기·죽도"가 된다(31차). 날카로움은 3~12kHz 의 **매끈한** 칼날 "슉"(60ms 안팎)에서, 고기는 젖은 "쯔억"에서 낸다. 쇠 울림은 투구·판금·칼끼리만.
  - 날카로움을 잴 때는 맞은 뒤 150ms 만, 창 없이(또는 A-가중으로) 잰다. 긴 구간에 한닝 창을 씌우면 맞는 순간이 지워져 판단을 그르친다(31차의 실수).
  - 흩어진 칼날·방어구 조각이 땅에 닿을 때마다 나는 소리는 넣지 않는다(25차, 사장님 "그럼 하지말자"). 대신 그 소리(`_shard`)를 **부서지는 순간**에 쓴다(26차, 사장님 "떨어질 때 쓰려고 만든 소리가 꽤 좋던데? 부서질 때 그걸 가져다 쓰자"). 사장님 확인: "일단 그렇게 해".
  - 소리는 드물고 가볍게 낸다. 기합("하앗")처럼 휘두를 때마다 나는 소리는 이 결을 깨므로 권하지 않는다.
  - 새 소리는 프레임·메모리·용량을 거의 쓰지 않아야 한다(사장님 조건).
  - 숨소리처럼 계속 나는 소리는 "지금 얼마나 위험한가"를 알릴 때만 내고, 위험이 지나면 멈춘다(디렉터 규칙, 21차). 출혈은 굳어서 멎으므로 "피가 적으면 계속"으로 하면 판 끝까지 이어져 적막함을 깬다.
- **음악처럼 들리는 것은 조심한다**:
  - 산사 판 시작 범종은 뺐다.
  - 대성당 오르간은 "전형적인 오르간 소리"를 원했고, 결국 화음 하나를 짧게 쓰는 것으로 정했다.
- **후보를 만들어 들려주면 오너가 고른다**:
  - 미리듣기 mp3를 `SendUserFile`로 보낸다. 게임 엔진으로 녹음한 장면(타격 → 소리 → 쓰러짐 등)이 좋다.
  - 잘 들리게 +3~6dB 올리고, 올렸다고 알린다.
- **오너 말투**: 짧고 구어체이며 오타가 많다. 뜻을 헤아려 읽는다.

## 5. 남은 일 (우선순위 순)

1. ~~네트워크 확인~~, ~~슈바르츠·이졸데 죽음 목소리~~: 15차에서 끝냈다. 사이트 접속 결과는 `sound_pm_takeover.md`.
2. ~~VoiceBosch(CC-BY-SA) 남성 신음 3개 교체~~: 17차에서 A안으로 끝냈다. 이제 CC-BY-SA 음원은 없다.
3. ~~판금 소리 연결~~: main `6669659`에서 디렉터가 연결했다(23차). 조각 착지 소리(`src/debris.js` 130행 자리)는 25차에 만들어 들려드렸으나 사장님이 **"그럼 하지말자"** → 되돌렸다(`1361fbc` 참고). 다시 제안하지 않는다. (연결됨 — 방어구 병합. 실제 게임 확인은 남았다)
4. (보류, 디렉터 결정) 산새·말 울음·비둘기 녹음 비교. 말 소리는 사장님이 뺀 적이 있다.
5. ~~내 숨소리~~: 21차에서 끝냈다(C안, 디렉터 규칙, 사장님 확인 "그래 그렇게 해").
   - 참고로 고르지 않은 후보: A craigsmith R15-47(0.55-2.6·3.45-4.75·4.7-6.85초), B sickfin 711359(0.5-1.3·4.95-5.6·10.2-11.1초). 모두 CC0.
   - 지금 남은 일은 없다.
7. ~~밤의 포세이돈 소리~~(24차): 사장님 확인 "밤 버전으로 쓰자". 디렉터 지시(낮고 느린 밤바다, 화로 넷의 약한 불, 가끔 검은 천 펄럭임, 조용하게)대로 만든 밤 판을 쓴다.
6. ~~화전 터 소리·이졸데 부활~~: 22차에서 끝냈다. 사장님: 부활 숨은 1안, 성가는 D(합창 한 구절), 화전 터는 "실제로 적용해 보고 이상하면 다시 말할게".
   - 외형 PM에게 알릴 것: 까마귀가 날아오를 때 `arena.onEvent('crows', { amp: 0~1, pos })`를 부르면 소리가 난다. 디렉터를 통해 전했다.
   - 코드와 파일은 `git stash`에 있다: "hurt grunts + low-blood breath + sword landing".
     - 모두 `BodySounds`가 fighter를 읽기만 한다(`wounds`·`blood`·`armed`·`sword`). main.js는 바뀌지 않는다.
     - 추가 용량은 약 110KB 이하다.
   - 상대 카드 공개 소리는 사장님이 0번(지금 그대로)을 고르셨다(18차). 후보 코드는 버렸다.

## 6. 작업 도구와 방법

- **개발 서버**: `npx vite --port 5179 --strictPort`(백그라운드). `public/`이 루트로 서빙되어 `sfx/...` 경로가 맞는다.
  - http-server로 루트를 서빙하면 `/public/sfx`가 어긋나 녹음이 안 실린다. 예전에 이 때문에 측정이 틀린 적이 있다.
- **브라우저**: Playwright + `/opt/pw-browsers/chromium`.
  - 게임은 `--use-gl=swiftshader --enable-unsafe-swiftshader --autoplay-policy=no-user-gesture-required`로 띄운다.
  - Vite가 파일 변경으로 새로고침하면 "Execution context was destroyed"가 나는데, 한 번 더 돌리면 된다.
- **오프라인 녹음(측정 기본 도구)**: `sounds.html`을 열고 `window.lab.render({ dur, samples: true, reverb: 0, seed, events: [{ t, call: '메서드', args: [...] }] })`.
  - `OfflineAudioContext`로 게임 엔진 그대로 그린다. 결과는 `audio`(Float32 배열)와 `peak`.
  - 배경을 바꾸려면 첫 이벤트로 `{ t: 0, call: 'setStage', args: ['castle'] }`, 배경 소리는 `{ call: 'ambience' }`.
  - 오프라인에서는 타이머(풍경·새 등)가 돌지 않는다. `windChime`, `bird`, `stageCall(kind)`를 직접 부른다.
- **실제 게임 녹음**:
  - `window.game.sound`의 `master`를 `ctx.createMediaStreamDestination()`에 연결하고 `MediaRecorder`로 webm을 받는다.
  - 싸움은 `?stage=castle&weapon=longsword` 같은 주소로 열고 `#btnStart`를 누르면 시작된다. 무기를 고정하지 않으면 카드 `#draw .wcard`를 눌러야 한다.
- **디버그 API**: `window.game` 아래에 `sound`, `setStage(id)`, `stage`, `draw`, `state`가 있다.
- **분석**: Python numpy/soundfile, matplotlib(`pip install`로 설치). ffmpeg는 `imageio_ffmpeg.get_ffmpeg_exe()`로 찾는다(libmp3lame, rubberband 포함).
- **자주 쓴 지표**:
  - 스펙트럼 중심, 200Hz 아래 비중, 2~8kHz 쉿 비중("기차" 판별), 300~900Hz 냄비 대역.
  - 음정 뾰족함("마림바" 판별), RMS 크기(칼 부딪힘 대비), YIN 음높이.
- **음원 받기 (차단된 경우)**:
  - raw.githubusercontent.com은 된다. `github.com/Mcamento8/open-game-sfx-index`의 `index.json`에 Kenney·OGA CC0 음원 1451개가 SHA-256과 함께 있다.
  - 사람 목소리·새·말 녹음은 거기 없다(확인함).
  - 아니면 오너가 사무실 컴퓨터에서 받아 채팅에 올려 준다(발소리를 이렇게 했다).
- **sounds.html**: 소리마다 줄이 있다. 오너가 폰에서 직접 눌러 들을 수 있다. 새 소리를 만들면 줄을 추가한다(`soundlab.js`의 `ROWS`).

## 7. 코드 지도 (`src/sound.js`)

- `SYNTH.*`: 합성 함수(일꾼 스레드에서도 돈다). `BANK`는 미리 만들 조각 목록 `[이름, 벌 수, 함수]`이다.
- `SAMPLES`: 녹음 파일 목록. `loadSamples`가 한꺼번에 받고, `pickSample(name)`은 같은 파일이 연달아 나오지 않게 고른다.
- `VOICES`: 캐릭터별 목소리. `prepareVoices(ids)`는 이번 판 캐릭터 것만 만들고, 녹음을 받는다.
- `STAGE_SOUND`: 배경별 발소리, 쓰러짐 알갱이, 방 울림.
- 배경 관련 함수:
  - `setStage`, `_applyRoom`, `ambience`, `_ambTemple`, `_ambCastle`, `_ambCathedral`, `_ambHall`
  - `_every`(배경이 바뀌면 자동으로 멈추는 예약), `stageCall(kind, k)`(가끔 나는 소리), `gust`, `roundStart`, `stageEvent`, `_where`(카메라 기준 좌우)
- `event()`, `layer()`: 소리 하나를 버스(metalBus / fleshBus)에 올린다. 동시 소리 수 제한과 prio 처리를 한다.
- `BodySounds`: 파이터마다 하나. main.js가 매 프레임 `update(dt)`를 부른다.
- 쓰이지 않는 코드:
  - voiceScript 스타일 'sighV', 'mumble', 'groanSigh', 'hum': 슈바르츠 합성 후보였고 폰에서 탈락했다.
  - `tick()`.
  - 지워도 되지만 남겨 두었다.

## 8. 새 세션 첫 할 일 체크리스트

1. `git fetch origin && git checkout -B claude/pm-sound-impact origin/main`
2. 이 문서와 `pm-sound-impact.md`의 9~14차를 훑는다.
3. 네트워크 확인(5장 1번). 결과를 오너에게 한 줄로 알린다.
4. 되면 슈바르츠 녹음 후보를 찾아 들려준다. 안 되면 오너에게 받을 파일(사이트·검색어·파일)을 골라 준다.
5. 디렉터 알림이 오면 `ReadNotifications`로 읽고 처리한다(판금 연결 등).
