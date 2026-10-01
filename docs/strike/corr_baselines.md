# 검술 보정 v2 기준 sha (시뮬 stdout sha256)

잰 코드: feat-corr `corr limits` 커밋 (item L, `BODY.humanLimits` 기본 true 로 뒤집은 커밋). 저장소 뿌리에서, stdout 만 (stderr 의 'using deprecated parameters' 줄은 뺌: `2>/dev/null`).
fights12 는 바이트 관문 전용 (`tools/sim/README.md` '소음 폭'). sha256 앞 8자리, 전체는 아래.

**새 본판 기준의 까닭: 사장님 9/30 23:40 관절 한도·자기 몸 충돌 켬** (`docs/decisions.md` 9/30 23:40, 확인표 54행). 한도는 사람 움직임 봉투의 물리 범위다
(`src/fighter.js` `HUMAN`: 척추 비틀림 −29~46° (10/1 fix2 C 에서 ±45° 대칭, §6), 칼 어깨 들림 면 −45~130°, 칼 팔꿈치 0~150°, 아래팔-칼 각 ≤ 163°, 아래팔 돌림 ±80°, 제 칼·칼팔 ↔ 제 몸통·허벅지 충돌. 값마다 확인표 70~77행 '사장님 확인 전 (해부학 범위)').
이 기준은 한도 쪽 버그를 고칠 때만 까닭을 옆에 적고 다시 잰다. 보정(corr) 쪽 변경으로는 다시 재지 않는다 — 바뀌면 새는 곳을 찾아 고친다.

## 1. 기본값 (한도 켬, 보정 old, AI old) — 10/1 fix2 C 에서 §6, 밧줄 닿음 고침에서 §7 값으로 바뀜
| 명령 | sha | 두 번 |
|---|---|---|
| `node tools/sim/fights12.mjs` | ~~`5613b5b9`~~ (5613b5b90da11b03c70fc48ed2d1cdaba7952b9e1cc6a61234fe2c357e4c2d0f) → ~~`80083518`~~ (§6) → **`d773dc43`** (§7) | 같음 |
| `node tools/sim/live_battery.mjs` | ~~`37f25f76`~~ (37f25f7676c75e9a2af96288161b4e147a9575a70931b3fd646c878e9d89be0e) → ~~`dbed88e2`~~ (§6) → **`31bceb3a`** (§7) | 같음 |

## 2. 한도 끔 = 오늘 (b03af1a 와 바이트 같음)
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs BODY.humanLimits=false fights12.mjs` | `12223139` |
| `node tools/sim/with_config.mjs BODY.humanLimits=false live_battery.mjs` | `2f453e0b` |
| `node tools/sim/with_config.mjs BODY.humanLimits=false SKILL.corr=old SKILL.corrAI=old live_battery.mjs` | `2f453e0b` |

## 3. SKILL.corr=v2 fights12 (AI 판이라 AI 는 corrAI 'old' — 보정 스위치가 판을 바꾸지 않는다)
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs SKILL.corr=v2 fights12.mjs` (한도 켬) | ~~`5613b5b9`~~ → ~~`80083518`~~ (§6) → **`d773dc43`** (= 1, §7) |
| `node tools/sim/with_config.mjs BODY.humanLimits=false SKILL.corr=v2 fights12.mjs` (한도 끔) | `12223139` (= 2) |

## 4. 한도 켬이 판을 어떻게 바꿨나 (참고, 판정 아님)
- fights12: 사망 9/12 → 7/12, 넘어짐 1.2/판 그대로, 연 상처 7.0 → 6.1/판 (12판은 소음 폭 안 — README).
- live_battery cuts: 세 베기 평균 칼끝 19.4 → 18.3 m/s (자세 지도 옛 보정 0.7, 교본 자세 일부를 한도가 막음: 확인표 71행).
- 기록: `…/scratchpad/corr/impl/impl/gates/itemL/` (명령·시간 shas.txt, 출력 *.txt).

## 5. 10/1 통합에서 다시 돌림 (feat-corr `4fce93e`, 작업 2 도구를 넣은 뒤)
- 1~3 의 여덟 줄 모두 같은 sha (기본값 fights12·live_battery 는 두 번씩). 기록 `…/scratchpad/corr/impl/integ/identity/shas.txt`.
- `node tools/sim/corr_s0.mjs --limits=off,on --scenes=a,b` = 12/12 IDENTICAL (새 보정 설정 0 = 옛 설정 0, 끝점 겨눔 켬), `--s=0.4` 는 12/12 스텝 0 에서 달라 통과.
- 도구 옛 출력(한도 끔): live_battery 2f453e0b · body_share dab0a69d · skill_level_duel 0.7 4 be742581 = b03af1a.
- envelope_check 로 감싸도 stdout 그대로: fights12 켬 5613b5b9 · 끔 12223139, live_battery 켬 37f25f76 · 끔 2f453e0b.

## 6. 10/1 척추 ±45° 대칭 (fix2 C, 동작 PM 교정) — 1·3 의 한도 켬 줄을 바꾼다
- **까닭: 10/1 척추 ±45° 대칭(동작 PM 교정)**. `HUMAN.spineTwist` −29~46° → −45~45° (복부 : 가슴 = 0.5 : 0.6 그대로). 예전 값은 오른쪽 클립만 잰 것 — 동작 PM 노트 `docs/motion/corr_v2_shoulder_note_2026-10-01.md` (origin/claude/pm-motion-research `922058d`): AAOS 가슴허리 돌림 한쪽 약 45, 왼쪽 클립 −41°. 확인표 70행.
- 한도 값만 바뀐 것이라 한도 끔·새 보정 0 은 그대로여야 하고 그대로다.

| 명령 | 옛 | 새 sha | 두 번 |
|---|---|---|---|
| `node tools/sim/fights12.mjs` | `5613b5b9` | **`80083518`** (800835189d9e478dc00f9570b91f59ecf4c80f80ffc5cc26ff5911842f30f8f5) | 같음 |
| `node tools/sim/live_battery.mjs` | `37f25f76` | **`dbed88e2`** (dbed88e2d4929a1282ec96a11e1da4ccb4883dbf26dd497d67d609e1b06afa9e) | 같음 |
| `node tools/sim/with_config.mjs SKILL.corr=v2 fights12.mjs` (한도 켬, AI 는 'old') | `5613b5b9` | **`80083518`** (= 새 fights12) | |
| `node tools/sim/with_config.mjs BODY.humanLimits=false fights12.mjs` | `12223139` | `12223139` (같음) | |
| `node tools/sim/with_config.mjs BODY.humanLimits=false SKILL.corr=old SKILL.corrAI=old live_battery.mjs` | `2f453e0b` | `2f453e0b` (같음) | |
| `node tools/sim/with_config.mjs BODY.humanLimits=false SKILL.corr=v2 fights12.mjs` | `12223139` | `12223139` (같음) | |
- `node tools/sim/corr_s0.mjs --limits=off,on` = 12/12 IDENTICAL, `--s=0.4` 12/12 달라 통과 (v2 가지가 산다).
- `envelope_check.mjs` 의 설계 칸도 `spineTwist-45..45` 로 (참고 수, stdout 그대로).
- 기록: `…/scratchpad/corr/fix2/gates/C/shas.txt` (명령 순서·출력).

## 7. 10/1 칼 어깨 밧줄 닿음 끔 (fix2 고침, 한도 쪽 버그) — 1·3·6 의 한도 켬 줄을 바꾼다
- **까닭: 10/1 칼 어깨 밧줄 닿음 끔(한도 쪽 버그)**. 어깨 공 관절은 가슴 ↔ 칼 위팔 닿음을 끈다(생성자 '원래 겹쳐 있어 닿음을 끈다'). 그런데 같은 쌍 사이의 들림 면 밧줄 둘(`shoulderOn`, 엔진 기본 닿음 켬)이 그 닿음을 되살려, 한도 켬에서 위팔 윗머리가 가슴 상자에 −12~−20 mm 파고들고 면 약 80° 에서 몸 앞 가로지르기가 멈췄다(130° 밧줄은 느슨). 밧줄도 닿음을 끈다. 새 수 없음.
- 한도 켬의 모든 경로(옛 보정·AI 포함)가 바뀐다. 한도 끔·새 보정 0 은 그대로여야 하고 그대로다.

| 명령 | 옛 (§6) | 새 sha | 두 번 |
|---|---|---|---|
| `node tools/sim/fights12.mjs` | `80083518` | **`d773dc43`** (d773dc43428660ed2d6d6c0fe668a17d5be770f546431281b4b021cf66a1bd61) | 같음 |
| `node tools/sim/live_battery.mjs` | `dbed88e2` | **`31bceb3a`** (31bceb3ab4d9f2b8698055a2447230099f105a2dbb082c43608163e1f0206cde) | 같음 |
| `node tools/sim/with_config.mjs SKILL.corr=v2 fights12.mjs` (한도 켬, AI 는 'old') | `80083518` | **`d773dc43`** (= 새 fights12) | |
| `node tools/sim/with_config.mjs BODY.humanLimits=false fights12.mjs` | `12223139` | `12223139` (같음) | |
| `node tools/sim/with_config.mjs BODY.humanLimits=false SKILL.corr=old SKILL.corrAI=old live_battery.mjs` | `2f453e0b` | `2f453e0b` (같음) | |
| `node tools/sim/with_config.mjs BODY.humanLimits=false SKILL.corr=v2 fights12.mjs` | `12223139` | `12223139` (같음) | |
- `node tools/sim/corr_s0.mjs --limits=off,on` = 12/12 IDENTICAL, `--s=0.4` 12/12 달라 통과.
- 같은 묶음의 v2 고침(결합 괄호·매핑 식 하나로)은 한도 끔·s 0 을 건드리지 않는다(위 같음 줄).
- 봉투 (chain_corr hit,hitMove 108 판/방식, 한도 켬, 플레이어): 척추 ±45·제 몸 뚫림 0 그대로. 칼 어깨 면은 이제 130° 밧줄에 실제로 닿아 old07 123 스텝(최대 1.2° 넘음)·v21 11 스텝(0.2°)·v207 0 — 손목 원뿔 아래팔 돌림(≤ 1.8°)과 같은 밧줄 풀이 오차. 칼 팔꿈치 > 150 old07 362 → 0.
- 기록: `…/scratchpad/corr/fix2/fix/identity/shas.txt`.
