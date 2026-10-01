# 기준 동작 클립 형식 — `stillness-motion-clip/2` (동작 연구 PM)

- 작성: 2026-09-29. 이 형식은 동작 연구 PM 이 정하고, 바꿀 때는 버전 번호를 올린다. 읽는 쪽은 `format` 을 먼저 본다.
- **clip/2 (9/29 오후)** = clip/1 에 채널·필드만 더한 것이다(지운 것 없음). clip/1 을 읽던 코드는 새 칸을 무시하면 그대로 읽힌다. 바뀐 점은 §3-6·§7.
- **검사 규칙은 §6** — 검사기 `tools/motion/validate_clip.mjs` 가 같은 규칙으로 모든 클립을 본다(빌드 도구가 끝에서 스스로 돌린다).
- 파일은 크기별로 둔다(`<베기>_<쪽>_<크기>.json` + `index.json`) — 디렉터 결정(9/29): 게임 atlas.js 가 index.json 으로 세 벌을 읽는다.
- 만드는 곳: `tools/motion/build_clips.mjs` (키프레임 `tools/motion/lib/cuts.mjs`, 몸 모형 `lib/body.mjs`, 표본·측정 `lib/clip.mjs`).
- 읽는 곳: 게임의 클립 추적(재설계 §2-2 atlas), 비교 화면 `tools/motion/viewer.html`, 비교표 `tools/motion/compare.mjs`.

## 1. 파일

| 경로 | 내용 |
|---|---|
| `docs/motion/clips/<베기>_<right\|left>_<small\|medium\|large>.json` | 클립 한 벌. 베기: zornhau, oberhau, zwerchhau, schielhau, unterhau, scheitelhau, krumphau, mittelhau |
| `docs/motion/clips/index.json` | `{ format: 'stillness-motion-index/1', generated, clips: [{ id, cut, nameKo, nameDe, family, desc, side, size, file, summary }] }` — 롱소드 |
| `docs/motion/clips/<무기>/<베기>_<쪽>_large.json` + `index.json` | 다른 무기, large 만: `zweihander` 8벌·`sabre` 8벌(zornhau·oberhau·mittelhau·unterhau × 좌우), `rapier` 2벌(lunge_thrust × 좌우). 목록 형식은 같고 위에 `weapon`·`grip`·`proposal`, 항목마다 `weapon`. 롱소드 목록과 섞지 않는다 — 같은 베기 id 가 무기마다 있다 |
| `docs/motion/records/<id>.json` | 게임 기록 (§5) |
| `docs/motion/records/index.json` | `{ format: 'stillness-motion-records/1', records: [{ id, cut, kind, file, source, summary }] }` |

## 2. 좌표·부호

- **월드(땅) 틀**: 클립 시작 때 골반 밑 땅이 원점. x = 앞(상대 쪽), y = 위, z = 칼 든 쪽. 오른손잡이(z+ = 오른쪽). 단위 m.
- **가슴 틀**: 원점 = 가슴 가운데(게임 `guards.js` 손 목표 원점과 같은 점), 축 = 가슴 상자(돌림·숙임·옆굽힘을 따라 돈다). `[앞, 위, 칼 쪽]`.
- **돌림(yaw) +** = 칼 든 쪽 어깨·골반이 뒤로 빠짐(칼 쪽으로 감음) — 게임 `guards.js` 부호. **숙임 +** = 앞으로. **옆굽힘 +** = 칼 쪽으로.
- 왼쪽에서 베기(`left`)는 오른쪽을 거울에 비춘 것이다. 손은 그대로 오른손이 앞손(코등이 쪽)이다 — 몸이 오른손잡이 그대로라 온전한 거울은 아니다:
  - 게임 자세 키: 짝이 있는 자세는 게임의 왼쪽 자세 값(pflug → pflugL …). 가운데 한 자세(지붕·긴 자세·바보)는 게임 값 그대로(게임은 양쪽에 같은 자세를 쓴다).
  - 저작 키: 거울. 거울 손이 칼 든 어깨(가슴 틀 [0, 0.1, 0.2])에서 팔 길이 0.565 m 를 넘으면 어깨 쪽으로 당긴다. 앞뒤 게임 자세가 둘 다 가운데 자세인 키(작게 Oberhau·Scheitelhau 의 지붕 → 바보·긴 자세)는 거울에 비추지 않는다(게임에서 그 구간은 양쪽이 같은 길).
- 발 이름 L/R 은 해부학적 왼발·오른발. 게임 `F`/`B` 는 칼 쪽 발/반대 발(오른손잡이면 F = 오른발).

## 3. 한 벌의 구조

```text
{
  format: 'stillness-motion-clip/2',
  id: 'zornhau_right_large', cut: 'zornhau', side: 'right', size: 'large',
  nameKo, nameDe, family, desc,
  hz: 120, weapon: 'longsword', handedness: 'right',
  marks:    { t0, tw, tr, tc, tf, tg },      // 초
  phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
  grip:     { hands, offHand, pommel, guard, tip, mass, com, inertia, from },  // 칼 치수 (앞손에서 칼 축 m · kg · 앞손 둘레 kg·m²) — 게임 src/weapons.js 에서 읽음. hands 1 = 한손 무기(offHand null, handO 는 빈손)
  proposal: { time, trunk, chain, basis },  // 츠바이핸더만: 롱소드 크게 벌 대비 제안 배율과 근거 (zweihander_table.md §1)
  sources:  [{ id, kind, cite, url, read, license }],
  provenance: '…',                          // 작게 = 게임 자세표, 크게 = 저작, 보통 = 섞음
  summary:  { … },                           // 측정 요약 (spec_table.md 와 같은 값)
  step:     { foot, from, to, liftT, landT, liftPhi, landPhi },  // clip/2: 옮기는 발 (흐름은 베기마다 하나씩 배열)
  stance:   { swordFoot, start, end },       // v1: 칼 쪽 발(오른손잡이 = 'R')이 첫 표본·끝 표본에서 'front'(앞) 또는 'rear'(뒤) — 두 발목의 땅 틀 x 로 잰다
  startFrom, startPose,                      // clip/2: 시작 목표 자세 id · 가장 가까운 게임 자세 { nearest, handError, next }
  recoverTo, endPose,                        // clip/2: 복귀 목표 자세 id · 끝 자세에 가장 가까운 게임 자세
  recovery: { from, to, samples },           // clip/2: 복귀 구간(tf → tg) 표본 수
  joints:   ['hipC', …, 'pommel', 'tip'],   // J 의 관절 순서
  bones:    [['hipC','waist','spine'], …],  // 막대 인형 뼈 (표시용)
  data: { n, width: { 채널: 폭 }, cols: { 채널: [표본 n × 폭] } }
}
```

### 3-1. 표시(marks)와 위상 φ

| 표시 | φ | 뜻 |
|---|---|---|
| `t0` | −1 | 준비 자세(게임 자세표 쟁기) |
| `tw` | 0 | 감기 끝 — 되돌아 풀기 시작 |
| `tr` | 0.55 | 손목 풀림 — 칼이 아래팔에 대해 가장 늦은 무렵 |
| `tc` | 0.85 | **칼이 겨눈 선을 지남** (칼 방향이 그 베기의 겨눈 방향과 같아지는 때). 걸음이 땅에 닿는 때 |
| `tf` | 1.6 | 지나가기 끝 |
| `tg` | 2.2 | 복귀 끝 |

- φ 는 표시 사이에서 시간에 선형이다(`data.cols.phi`). 크기가 달라도 같은 φ 는 같은 동작 단계라서 **φ 로 벌끼리 섞을 수 있다**.
- 크기별 시간: 작게 tw 0.20 · tc 0.48 · tg 1.00 s, 크게 tw 0.36 · tc 0.65 · tg 1.50 s, 보통은 그 사이.

### 3-2. 채널 (`data.cols`, 120 Hz)

| 채널 | 폭 | 틀 | 뜻 |
|---|---|---|---|
| `t` · `phi` | 1 | — | 시각 s · 위상 |
| `pelvis.yaw` · `pelvis.pitch` · `pelvis.drop` | 1 | 월드 | 골반 돌림° · 숙임° · 낮춤 m |
| `chest.yaw` · `chest.xFactor` · `chest.lean` · `chest.side` | 1 | 월드 | 가슴 돌림° · 척추 비틀림(가슴−골반)° · 몸 숙임 합° · 옆굽힘° |
| `handS` · `handO` | 3 | 가슴 | 앞손(코등이 쪽)·뒷손(폼멜 쪽) 자리 m. 한손 무기(`grip.hands` 1)는 `handO` = 칼자루를 잡지 않은 빈손 (세이버: 왼 허리, 레이피어: 가슴 앞 막는 손) |
| `sword` | 3 | 가슴 | 칼 방향 단위 벡터(손 → 칼끝) |
| `edge` | 3 | 가슴 | 앞날이 향하는 쪽 — 칼끝 속도에서 칼 축 성분을 뺀 방향(느릴 때는 앞 값). 저작 값이 아니라 결과 |
| `elbowPoleS` · `elbowPoleO` | 3 | 가슴 | 칼 든 팔 · 빈 팔 팔꿈치가 향하는 쪽 (어깨-손 가운데 → 팔꿈치). `elbowPoleO` 는 clip/2 |
| `girdleS` · `girdleO` | 2 | 가슴 | 어깨띠 [들림, 내밂] m — 팔을 60° 넘게 들면 최대 0.06 m 오르고, 뻗으면 최대 0.04 m 앞으로 (clip/2) |
| `guardGap` · `openness` | 1 | 월드 | 칼(자루 끝 → 칼끝)이 가슴 앞 0.45 m 세로 띠에서 떨어진 거리 m · 틈 0~1 (0.2 → 0.4 m, summary 의 '앞이 빈 시간'과 같은 띠) (clip/2) |
| `feet.L.yaw` · `feet.L.lift` (R 도) | 1 | 월드 | 발끝 돌림° · 뒤꿈치 들림 0~1 |
| `com` | 3 | 월드 | 무게중심 (게임 부위 무게 + 칼) |
| `ang.*` | 1 | — | 관절각°: pelvisYaw, chestYaw, xFactor, lean, shoulderElevS(가슴 아래와 위팔 사이), elbowS, elbowO(굽힘, 0 = 곧음), wrist(아래팔-칼), kneeL, kneeR |
| `w.pelvis` · `w.chest` · `w.shoulder` · `w.wrist` | 1 | — | 각속도 rad/s (골반·가슴 = 수직축 둘레, 어깨·손목 = 방향 변화율 — 흔들림 큼) |
| `speed.tip` · `speed.hand` | 1 | 월드 | m/s |
| `J` | 69 | 월드 | `joints` 순서 관절 23개 × [x, y, z] (막대 인형, 발 자리, 칼 양끝) |

- 벡터 채널은 평면 배열이다: 표본 i 의 값 = `cols[ch].slice(i * 폭, i * 폭 + 폭)`.
- 발 딛기 시각은 `J` 의 발목 높이(`ankleL`·`ankleR` y 가 0.08 m 로 돌아오는 때)로 읽는다.

### 3-3. 요약 (`summary`)

`time`(단계 길이) · `tipPeak`·`tipAtLine`·`handPeak` · `sequence`(골반·가슴·어깨·손·손목·칼끝 최고 시각 ms, tc 기준 · 최고값) · `ordered` · `trunkCarry` · `shareAtTipPeak` · `wind`(손 높이·앞뒤·어깨 들림) · `followThrough`(지나가기: `handSideChest` = 가슴 가운데 기준 머리 방향 틀 옆 거리, 디렉터 `mx.mjs` 의 hand_side_min 과 같은 식 · `handSidePelvis`·`handSideRoot` 참고 · `handHeightOverHip`) · `range`(가슴·골반 회전, 척추 비틀림, 손·칼끝 길, 무게중심 옮김) · `opening`(앞이 빈 시간, 칼끝이 몸 뒤, 돌아선 각) · `checks`(팔·다리 넘침, 칼끝 최저 높이, 손목 각) · `keyPoses`(t0·tw·tr·tc·tf 의 관절각·자리).

### 3-4. 흐름 클립 (`flow_*`, `build_flow.mjs`)

베기 둘을 멈추지 않고 이은 클립이다. 형식은 같고 몇 가지를 더 가진다.

| 필드 | 뜻 |
|---|---|
| `cut` · `base` | `flow_zornhau8` · 바탕 베기(`zornhau`). 크게 벌만 있다 — 비교 화면은 없는 크기를 바탕 베기 클립으로 채워 "작게 대비" 숫자에만 쓴다 |
| `marks` | 전체: t0 · 첫 베기 tw·tr·tc · 둘째 베기 tf·tg |
| `marks1` · `marks2` | 베기마다 표시. `marks1.tf` = `marks2.tw` (첫 지나가기 끝 = 둘째 감기 끝, 몸통이 반대로 가장 많이 감긴 때) |
| `summary` · `summary2` | 첫 베기(marks1 창) · 둘째 베기(marks2 창) 측정 |
| `flow` | 두 겨눈 선 사이: `contactGap`(s), `tipMin`·`handMin`(m/s, 첫 겨눈 선 뒤 시각), `bladeRateMin`(rad/s), `tipLow`, `wristMax`, `chestTurn`, 걸음(`pelvisAdvance`·`stepR`·`stepL`) |
| `data.cols.phi` | 첫 베기 φ 가 `marks2.tw` 에서 1.6 에 닿고, 거기서 둘째 베기 φ 0 으로 새로 시작한다 |

### 3-5. 런지 클립 (`lunge_*`, `build_lunge.mjs`)

찌르기라 베기 표시를 이렇게 읽는다: `tw` = 팔이 움직이기 시작, `tr` = 앞발이 뜨기 직전, `tc` = 칼끝이 겨눈 선(앞발 딛기와 같은 때), `tf` = 골반이 가장 낮음, `tg` = 쟁기 자세로 돌아옴. 크게 벌만 있고 바탕 베기(`base`)가 없다.
`lunge` 필드: `handFirst`(ms, + = 손이 먼저), `footLand`(s, 앞발 딛기 − tc), `pelvisDrop`(m), `lowAfterLand`(s), `stanceEnd`(m), `kneeFront`·`kneeBack`(°, 180 = 곧게), `lean`(°), `advance`(m), `legOver`.

### 3-6. 재설계 §2-2 (2) atlas 채널과 대조 (clip/2)

| 재설계 atlas 채널 | clip/2 | 비고 |
|---|---|---|
| 위상 표시 φ0 φw φr φc φf φg, 구간 기본 시간 | `marks`(t0 tw tr tc tf tg, s) · `phiMarks` · `data.cols.phi` · `summary.time` | 있음 |
| 양손 위치 | `handS` · `handO` (가슴 틀) | 있음 |
| 칼 방향과 날 방향 | `sword` · `edge` (가슴 틀) | 있음. `edge` 는 저작 값이 아니라 칼끝 빠르기에서 얻은 결과 |
| 골반 yaw·pitch·내림 | `pelvis.yaw` · `pelvis.pitch` · `pelvis.drop` | 있음 |
| 골반에 대한 가슴 yaw (X-factor) · 숙임 | `chest.xFactor` · `chest.lean` (+ `chest.side`) | 있음 |
| 팔꿈치 방향 (pole) | `elbowPoleS` · `elbowPoleO` | 있음 (빈 팔은 clip/2) |
| 어깨띠 들림과 내밂 (최대 0.06 m) | `girdleS` · `girdleO` | clip/2 에서 채움 |
| 빈손이 칼자루 끝을 당기는 점 | `handO` | 있음 — 뒷손(폼멜 쪽) 쥔 자리, 앞손에서 칼 축으로 0.14 m 뒤 |
| 딛은 발의 앞꿈치 돌림 | `feet.L.yaw` · `feet.R.yaw` (+ 뒤꿈치 `lift`) | 있음 |
| 앞발 딛기 목표와 시각 | `step` { foot, to, landT, landPhi } | clip/2 에서 채움 |
| 복귀 목표 자세 id | `recoverTo` (+ 확인용 `endPose`) | clip/2 에서 채움. 16벌 모두 끝 자세 = 목표 자세 (손 오차 0 cm) |
| balanceAssist | **없음** | 균형 서보를 얼마나 풀지는 게임 쪽 값이다(사람 자료로 정할 수 없음) |
| openness | `openness` · `guardGap` | clip/2 에서 채움 |
| 크기 세 벌 | 파일 셋 + `index.json` | 있음 |
| 보간 (min-jerk, squad) | **없음** — 120 Hz 표본이다. 보간은 atlas.js 몫 | |
| 출처와 사용권 | `sources` (칸마다 `license`) · `provenance` | 있음 |

### 3-7. R2 명세 11장 확인 (디렉터 9/29, 답 — 고칠 것은 v1)

| # | 물음 | 답 |
|---|---|---|
| 1 | `pelvis.drop` 단위 · `chest.lean` 뜻 | 맞음. `pelvis.drop` = guards.js `drop` 과 같은 단위(쟁기 0.07 → 작게 t0 0.07, 게임의 0.06 빼기는 게임 쪽 일). `chest.lean` = 골반 숙임 + 가슴 숙임 **합**(쟁기 pitch 5° → 작게 t0 5°) |
| 2 | 발 순서 (클립: 칼 쪽 발이 뒤에서 시작, `step.from` [−0.26, 0.15]) | v0 은 역할로 읽기(딛은 발 / 내딛는 발) 괜찮다. 클립은 왼발 앞(Meyer 분노의 자세 서술)에서 칼 쪽 발을 내딛는 걸음이다. **v1 (9/30): `stance` 표시를 모든 클립에 넣음**(검사 F5·T1). 오른쪽 베기는 칼 쪽 발 뒤에서 시작(크게·보통은 앞으로 끝남), 왼쪽 베기(거울)는 앞에서 시작. 칼 쪽 발 앞 변형은 아직 없다 |
| 3 | 작게↔보통 감기 끝 칼 방향 차이 | 의도다: 보통 벌은 크게 벌을 겨눈 선 쪽으로 줄인 것이라 감기 끝 칼이 크게 쪽(등 뒤)에 있다. Zornhau 작게↔보통 tw 칼 방향 63°. v1 에서 tw 칼을 작게 쪽으로 당긴(칼 호 약 140°) 보통 벌을 줄 수 있다 — `start_poses.md` §2 에 무리별 tw 칼 호가 있다 |
| 4 | 보통 벌 `wristOver160` | 보고만 — 알겠음. v1 보통 벌을 3번과 같이 고치며 본다 |
| 5 | `edge` 채널 | 알겠음. 지금은 칼끝 속도에서 얻은 결과값이다. 감는 중 날 방향을 저작하게 되면 이 표와 §3-2 에 적는다 |
| 6 | 걸음 시각 (내딛기 0.242 s 에 0.78 m) | v1 에서 감기 끝 무렵 발을 떼는 걸음(더 일찍, 더 길게)을 줄 수 있다 — 손가락 속도로 압축해도 발이 tc 에 가깝게 |

## 4. 쓸 때 주의

- **몸 모형은 표시·검사용이다.** 팔·다리 IK 와 날개뼈는 `lib/body.mjs` 의 단순한 규칙이다. 게임은 자기 IK(재설계 §7-2 `src/strike`)로 `handS`·`sword`·몸통 채널을 따라가면 되고, `J` 의 팔꿈치 자리를 그대로 강요할 필요는 없다.
- 뼈대 치수는 게임(`src/fighter.js`: 팔 0.30 + 0.265 m, 어깨 가슴 틀 (0, 0.1, ±0.2))과 같다. 사람 팔(약 0.63~0.66 m)보다 짧다.
- **크기를 섞을 때**: 작은 벌과 큰 벌을 곧게(선형) 섞으면 사이 자세의 손목이 사람 어림(약 160°)을 넘는다(v0 보통 벌에서 165~177°). 보통 벌(크게 벌을 겨눈 선 자세 쪽으로 줄인 것)을 사이에 두고 두 구간으로 섞기를 권한다(작게↔보통, 보통↔크게).
- **칼 방향을 섞을 때**: 성분마다 섞지 말고 큰 원을 따라(slerp) 섞는다. 성분으로 섞으면 칼이 뒤집히는 곳에서 헛돈다(v0 저작 중에 겪음: 칼끝 50~70 m/s).
- 사람 값(칼끝 빠르기, 관절 범위)은 **참고이지 한도가 아니다**. 게임이 기준보다 빠르거나 큰 것은 문제가 아니다.

## 5. 게임 기록 — `stillness-motion-record/1`

```text
{
  format: 'stillness-motion-record/1',
  id, cut, kind: 'game-arm' | 'wbs-arm' | 'wbs-commit',
  source: '어느 코드·조건으로 쟀나 (사람이 읽는 한 줄)',
  cond: {                                       // 같은 조건을 기계가 읽는 꼴로 (compare_game.md '기록 조건' 표)
    code,                                       // 'src/ 001249b' | 'claude/wbs-impl d781ab9' ('+고침' = 안 올린 고침이 있었음)
    seed, physicsHz, recordHz, inputHz,         // 시드 · 물리 스텝 · 기록 · 손가락 입력 Hz
    weapon, gait, skill,                        // 'longsword' · BODY.weightMode · 숙련도
    gap,                                        // 두 사람 거리 m (null = 상대 치움)
    commit,                                     // WHOLE.commit ('끔' | '켬 (결심 n번)' | null = 그런 설정 없음)
    input,                                      // 손가락을 어떻게 움직였나
  },
  hz: 120,
  marks: { swingStart | cutStroke, tipPeak },   // 기록마다 있는 시각 표시 (s)
  summary: { tipPeak, handPeak, tipPeakT, … },
  joints, bones,                                // 클립과 같은 23 관절
  data: { n, cols: { t, 'speed.tip', 'speed.hand', J } }
}
```

- 좌표는 클립과 같다(기록 시작 때 골반 밑 땅 원점). 랙돌 관절 자리 = 붙은 몸체 자세 × (관절 기준점 − 몸체 처음 자리) — `tools/motion/lib/game_joints.mjs`.
- 만드는 곳: `record_game.mjs`(main), `record_wbs.mjs --root=<체크아웃>`(다른 브랜치). 디렉터 도구가 같은 형식으로 내면 비교 화면·비교표가 그대로 읽는다.

## 6. 검사 규칙 (clip/2)

읽는 쪽(게임 atlas.js 로더 등)이 **같은 규칙으로 크게 실패**하도록 적는다. 규칙 번호는 검사기 출력과 같다.

- 검사기: `node tools/motion/validate_clip.mjs [클립.json | index.json …]` — 인자가 없으면 `docs/motion/clips/index.json` 과 `docs/motion/clips/<무기>/index.json` 모두. 어긋나면 **종료 코드 1** 과 규칙 번호·이유를 찍는다. `--quiet` 어긋난 것만, `--json` 기계용.
- `build_clips.mjs`·`build_flow.mjs`·`build_lunge.mjs` 가 끝에서 스스로 돌린다. 어긋나면 빌드가 실패한다.
- 같은 규칙의 코드: `tools/motion/lib/clip_rules.mjs` 의 `checkClip(clip, { guards })`·`checkIndex(index, clips, guardsFor)` — node 모듈을 쓰지 않아 브라우저에서도 돈다. 게임 자세표는 부르는 쪽이 넘긴다(`src/guards.js` 의 `GUARDS` 를 이름으로 찾아 아래 id 에 붙인 것, `validate_clip.mjs` 의 `gameGuards()`).
- 허용치는 **기준 자료가 맞게 만들어졌나**를 보는 값이다. 게임 동작의 한도가 아니다.
- 읽는 쪽에 권함: 실패 규칙이 하나라도 있으면 그 클립을 쓰지 말고 클립 id·규칙 번호·이유를 오류로 띄운다. 경고(C2·G0 의 null)는 쓰되 한 번 알린다.

### 6-1. 클립 한 벌

| 번호 | 무엇 | 어떻게 재나 | 허용 |
|---|---|---|---|
| F1 | 형식 | `format` = `stillness-motion-clip/2` | 같아야 함 |
| F2 | 필드 | `id`·`cut`·`side`·`size`·`weapon`·`handedness`·`nameKo`·`family`·`provenance` 가 글자. `side` ∈ right·left, `size` ∈ small·medium·large, `handedness` = right, `hz` 양의 정수, `sources` 1개 이상이고 칸마다 `license`, `summary.checks` 있음, `joints` = §3 의 23 관절 그 순서, `bones` 이름은 `joints` 안 | — |
| F3 | 이름 | `id` 끝 = `_<side>_<size>`. 파일 이름 = `<id>.json` | — |
| F4 | clip/2 필드 | `startFrom`·`recoverTo` = 자세 id 또는 null · `startPose`·`endPose` = { nearest, handError, next } · `recovery` = { from, to, samples } · `step` = null, 걸음 하나, 또는 걸음 배열(흐름). 걸음 = { foot L·R, from [x, z], to [x, z], liftT·landT·liftPhi·landPhi 수 또는 null } | — |
| F5 | stance (있으면) | `stance` = { swordFoot L·R, start·end front·rear }. 없으면 검사하지 않는다(옛 클립) | — |
| C1 | 채널 | §3-2 표의 채널이 모두 있고 폭이 같다 (`J` = 관절 23 × 3 = 69) | — |
| C2 | 모르는 채널 | 표에 없는 채널이 있다 | 경고만 (무시해도 된다) |
| L1 | 길이 | `cols[채널]` 길이 = `n` × 폭 | — |
| N1 | NaN | `cols` 의 값이 모두 유한한 수 (JSON 의 null = NaN·무한을 적은 것) | — |
| S1 | 표본 수 | `n` = round((marks.tg − marks.t0) × hz) + 1, `n` ≥ 2 | — |
| S2 | 시각 | `t[0]` = marks.t0, 이웃 표본 간격 = 1/hz | ±0.0005 s |
| P1 | 표시 순서 | t0 < tw < tr < tc < tf < tg, 이웃 사이 한 표본(1/hz) 이상. 흐름 클립은 `marks1`·`marks2` 도 각각, 그리고 marks1.tf = marks2.tw | — |
| P2 | φ 표시 | `phiMarks` = { t0 −1, tw 0, tr 0.55, tc 0.85, tf 1.6, tg 2.2 } | 같아야 함 |
| P3 | φ 채널 | 표시 사이에서 시간에 선형(§3-1), 첫 값 −1 · 끝 값 2.2, 줄지 않는다. 흐름 클립은 marks2.tw 에서 한 번만 되돌아간다(앞은 marks1, 뒤는 marks2 로 셈) | ±0.002 |
| U1 | 방향 벡터 | `sword`·`edge`·`elbowPoleS`·`elbowPoleO` 길이 1 | ±0.01 |
| U2 | 범위 | `openness` 0~1, `guardGap` ≥ 0, `feet.*.lift` 0~1 | — |
| U3 | 땅 | 모든 표본에서 칼끝 높이(`J` 의 tip y, 땅 = 0) ≥ −0.02 m — 칼이 땅을 뚫지 않는다 | −0.02 m |
| G0 | 목표 자세 | `startFrom`·`recoverTo` 가 게임 자세표에 있다. null 이면 경고(대조 안 함). 검사기가 그 무기의 자세표를 모르면 실패 | — |
| G1 | 시작·끝 손 | 첫 표본(`startFrom`)·끝 표본(`recoverTo`)의 앞손 = `J` 의 hS − chest. 땅 틀 축 = 게임이 손 목표를 두는 '바라보는 틀'(가슴 가운데 원점, 돌림·숙임 없음). 게임 자세표 `hand` 와 거리 | **0.02 m** (디렉터 요청) |
| G2 | 시작·끝 칼 | 같은 표본의 칼 방향 = `J` 의 tip − pommel, 자세표 칼끝 방향(guards.js `dir`)과 사이 각 | 3° |
| G3 | 시작·끝 몸통 | `chest.yaw` ↔ `chestYaw`, `chest.lean` ↔ `pitch`, `pelvis.yaw` ↔ `pelvisYaw` × 0.5 (게임 fighter.js 는 골반을 자세표 값의 절반만 튼다), `pelvis.drop` ↔ `drop` | 2° · 0.01 m |
| G4 | 적힌 값 | `startPose`·`endPose` (가장 가까운 자세 id·손 오차)가 데이터로 다시 잰 값과 같다. `recovery` = { from: tf, to: tg, samples: tf~tg 표본 수 } | 0.002 m |
| R1 | 팔 넘침 | 모든 표본: \|손 − 어깨\| − 0.565 m. 어깨(가슴 틀) = [어깨띠 내밂, 0.1 + 어깨띠 들림, ±0.2] — 칼 팔 = `handS`·`girdleS`·+0.2, 빈 팔 = `handO`·`girdleO`·−0.2. 0.565 = 게임 위팔 0.30 + 아래팔 0.265 | max(0.04 m, 첫·끝 표본의 넘침 + 반올림 0.002 m) — 시작·끝은 게임 자세라 그 자세 자체의 넘침까지 봐준다 (롱소드 쟁기 뒷손 0.028 m, 츠바이핸더 쟁기 뒷손 0.047 m: 칼자루가 4 cm 길다) |
| R2 | 다리 넘침 | 모든 표본: \|발목 목표 − 엉덩이\| − 0.85 m (넓적다리 0.43 + 정강이 0.42). 발목 목표 = `J` 의 뒤꿈치 + 0.06 m × 발 방향(뒤꿈치 → 앞꿈치, 수평) + 0.06 m 위 — 발 모양은 `lib/body.mjs` | 0.02 m (지금 가장 큰 값: 런지 뒷다리 0.015 m) |
| R3 | 뼈 길이 | `J` 에서 엉덩이–허리 0.13, 허리–가슴 0.27, 위팔 0.30, 넓적다리 0.43, 정강이 0.42 (게임 뼈대 치수). 두 손 사이(`grip.hands` 1 이면 안 봄)·자루 끝↔칼끝 거리는 표본마다 같다(굳은 칼). `grip` 칸이 있으면 두 손 사이 = \|grip.offHand\|, 자루 끝↔칼끝 = grip.tip − grip.pommel | 0.005 m |
| T1 | 선 자세 ↔ J | `stance.start`·`end` 가 첫·끝 표본의 두 발목(칼 쪽 발 vs 다른 발) 앞뒤와 같다 | — |

### 6-2. 목록 (`index.json`)

| 번호 | 무엇 | 어떻게 |
|---|---|---|
| I1 | 형식 | `format` = `stillness-motion-index/1`, `clips` 가 비지 않은 배열 |
| I2 | 항목 | `id`·`cut`·`side`·`size`·`file` 이 글자, `id` 겹침 없음, `file` = id + '.json', 파일이 있고 §6-1 을 통과 |
| I3 | 목록 = 파일 | 항목에 있는 칸(cut·side·size·family·nameKo·summary·step·startFrom·startPose·recoverTo·endPose·recovery·weapon·base·flow·lunge)이 클립 파일 값과 같다 |
| I4 | 크기 벌 | 한 베기(같은 weapon·cut)는 small·medium·large 셋 다 또는 large 하나. 좌우가 같은 크기를 가진다 |
| I5 | 좌우 짝 | 같은 베기·크기의 right·left 는 `marks`·표본 수가 같다 |
| X1 | 자세표 사본 | 빌드 도구의 자세표 사본(`lib/cuts.mjs` GAME_GUARDS)이 `src/guards.js` 와 같다 — 게임 자세표가 바뀌면 클립을 다시 만들라는 알림 |

### 6-3. 게임 자세표 대조

- 자세 id ↔ `src/guards.js` 이름: tag 지붕 (Vom Tag) · tagR 어깨 지붕 (Vom Tag) · ochs 황소 (Ochs) · langort 긴 자세 (Langort) · side 옆 자세 · pflug 쟁기 (Pflug) · wechsel 바꿈 (Wechsel) · neben 옆 지킴 (Nebenhut) · alber 바보 (Alber) · tagL 왼쪽 어깨 지붕 · ochsL 왼쪽 황소 · sideL 왼쪽 옆 자세 · pflugL 왼쪽 쟁기 · wechselL 왼쪽 바꿈.
- 두손 무기(롱소드·츠바이핸더)는 같은 자세표를 쓴다. 츠바이핸더는 칼자루가 길어(뒷손 −0.18 m, 롱소드 −0.14 m) 같은 쟁기 자세에서 뒷손이 0.047 m 넘친다 — 게임 자세 그대로라 R1 이 봐준다.
- 한손 자세 무기(weapons.js `oneHandStance`: 세이버·레이피어 등)는 게임의 한손 자세표 `BASE_ONE` = `GUARDS` 에 `ONE_HAND`(긴 자세·쟁기·황소·바보만 바꿈)를 덮은 것. 검사기는 게임이 내보내는 `GUARD_BASE_ONE`(main b403696 부터)을 그대로 읽는다(`validate_clip.mjs` gameGuardsOne — 9/29 밤까지는 guards.js 글에서 `ONE_HAND` 를 읽어 덮었다).
- 9/29: 52벌 모두 통과. 이 검사로 왼쪽 벌 5개의 팔 넘침(0.041~0.076 m)을 찾아 거울 규칙을 고쳤다(§2).

## 7. 바뀐 기록

| 버전 | 날짜 | 바뀐 것 |
|---|---|---|
| clip/1, record/1 | 2026-09-29 | 처음 (같은 날 보통 벌 만드는 법을 섞기 → 크게 벌 줄이기로 바꿈 — 형식은 같음) |
| record/1 | 2026-09-29 | `cond`(기록 조건: 커밋·시드·Hz·무기·걸음·skill·거리·결심·입력) 더함 — 없어도 읽힌다, 디렉터 요청 |
| clip/1 | 2026-09-29 | `summary.followThrough.handSideChest` 더함(형식은 같음). 크게 Zornhau 지나가기 손 자리 고침(손을 배 앞으로 끌어들이지 않음) |
| clip/1 | 2026-09-29 | 흐름 클립(§3-4) 더함 — 베기 클립은 그대로 |
| clip/1 | 2026-09-29 | 런지 클립(§3-5) 더함 |
| **clip/2** | 2026-09-29 | 디렉터 요청(재설계 atlas 채널 대조): 채널 `elbowPoleO`·`girdleS`·`girdleO`·`guardGap`·`openness`, 필드 `step`·`startFrom`·`startPose`·`recoverTo`·`endPose`·`recovery` 더함. 게임 자세 키를 게임과 같은 틀(바라보는 틀, 가슴 가운데 원점)로 옮기게 고쳐 시작·끝 자세 손이 자세표와 같아짐(전에는 숙임만큼 3~4 cm 어긋남). balanceAssist 는 없음 |
| clip/2 | 2026-09-29 | 검사 규칙(§6)과 검사기 `validate_clip.mjs`(디렉터 요청). 형식은 같다. 검사로 찾은 왼쪽 벌 팔 넘침을 고치려고 거울 규칙을 바꿈(§2: 가운데 자세는 게임 값, 거울 손이 팔 길이를 넘으면 당김) — 왼쪽 13벌 값이 조금 바뀜, 팔 넘침 최대 0.076 → 0.028 m |
| clip/2 | 2026-09-29 | 칸 `grip`(모든 클립: 칼 치수, 게임 src/weapons.js 에서 읽음)·`proposal`(츠바이핸더) 더함. 츠바이핸더 크게 벌 8벌을 `clips/zweihander/` 에 따로 둠. 검사 U3(칼끝이 땅 밑으로 가지 않음) 더함, R1 허용에 시작·끝 게임 자세 자체의 넘침을 넣음(츠바이핸더 쟁기 뒷손 0.047 m) |
| clip/2 | 2026-09-29 | 한손 무기: `grip.hands`(1·2) 더함, 한손이면 `handO` = 빈손. 세이버 크게 벌 8벌(`clips/sabre/`)·레이피어 런지 2벌(`clips/rapier/`). 검사기가 한손 자세표(게임 ONE_HAND)로 시작·끝을 보고, 한손이면 두 손 사이 검사(R3)를 뺀다 |
| clip/2 (v1) | 2026-09-30 | 디렉터 v1 과제: ① 보통 벌 감기(t0 뒤 ~ tw) 칼 방향 = 작게·크게 같은 키 방향의 가운데(구면 보간), tw → tr 사이는 원래 보통 방향으로 서서히 — tw 칼 차이 작게↔보통 69·90·81° → 47·61·58° (Zorn·Ober·Unter), 작게→보통→크게가 한 길로 이어짐. 몸·손은 그대로 ② 크게·보통 이른 걸음: 걸음 키 시각을 당김(발 뗌 0.41 → 0.33 s = tw 무렵, 디딤 tc 그대로), 골반 앞 옮김도 같이 — 내딛는 발 최고 빠르기 7.9 → 4.2 m/s(Zornhau) ③ 칸 `stance` 더함, 검사 F5·T1 |
