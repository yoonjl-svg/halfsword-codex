# R2 설계 — 조작 우선(손가락에서 시작) : gesture.js → atlas.js → drive.js

- 대상 코드: worktree `/home/user/hs-wbs`, 가지 `wbs-impl`, 끝 `bcf1fb1` ("R0 prep"). 아래 줄 번호는 이 스냅숏에서 직접 확인한 것이다. R0·R1이 합쳐지면 줄은 밀리므로 **줄 번호 옆에 그 줄의 실제 코드를 같이 적었다** — 그 문자열로 다시 찾으면 된다.
- 참고 문서: `docs/whole_body_redesign.md` §0·1·2·3·4·5·7-2·8·9·10, `docs/motion/clip_format.md`(clip/2), `docs/motion/targets.md`, `docs/motion/spec_table.md` §7, `docs/motion/clips/index.json` + `zornhau_right_{small,large}.json`(직접 열어 채널·표시·값을 확인).
- R0가 주는 것으로 가정: `STRIKE.gripMu`, `STRIKE.glitchFilter`(30 m/s 버림 제거), `STRIKE.sweep`, `STRIKE.wristRel`(아래팔 상대 60 rad/s), `RENDER.interp`, `FEEL.logScale`, `INPUT.coalesce` + `fingerTrace.at(t)`, `tools/sim/chain.mjs`(record/1). 이 문서는 그 위에 얹는다. `fingerTrace.at(t)`의 정확한 시그니처가 다르면 gesture.js 안의 어댑터 한 함수만 바꾼다(§2-1-2).
- 원칙(사장님 정의): 빠르기·세기·크기·빈도·시간에 상한·하한·바닥을 새로 두지 않는다. 한도로 작용할 수 있는 값은 모두 §6에 모아 Q1~Q26에 붙였다. 새 Q는 만들지 않았다. 난이도 조정 없음.

---

## 1. 요약 (10줄)

1. 플레이어의 손가락 궤적(`input.fingerTrace`, 자르지 않은 패드 좌표)을 **물리 스텝마다** 읽어 세 연속량 S(싣기), dir/무리, φ(위상)를 낸다. 알아보기 단계(detectCommit A/B, 50~117 ms)는 없다: 감기는 첫 프레임부터 손가락을 1:1로 따라가고, 베기는 손가락 속도가 꺾이는 그 스텝에 시작한다.
2. `gesture.js`는 상태를 `fighter.ges` 하나에만 쓴다. 다른 어떤 상태도 바꾸지 않는다. 모든 소비자는 `ges.S`(또는 `drive.w`)를 곱해 쓰므로 **S = 0이면 수식적으로 지금 코드와 같다**(§3).
3. `atlas.js`는 clip/2(`stillness-motion-clip/2`, 120 Hz)를 `index.json`으로 읽고, 형식·버전·채널·폭·표시 순서·작은 벌 = 자세표 일치를 검사해 하나라도 틀리면 **던진다**(조용한 폴백 없음). 표본은 φ로 찾고, 같은 클립의 작게↔보통↔크게를 S로 섞으며(두 구간), 해석 미분으로 속도·가속도를 낸다.
4. `drive.js`(ClipDrive)는 스텝마다 (무리, 쪽, φ_body, S)에서 클립을 뽑아 몸통·골반은 **시간표 + 앞먹임 토크**로, 손·칼 방향은 **명령된 가슴 틀**에서, 어깨띠·팔꿈치 pole은 클립에서(이력 포함) 준다. 필터(`follow()` 34/26, `pelvisRate`, `holdSpeed`, 손 목표 2차 필터)는 클립 몫에는 걸리지 않는다.
5. 몸 위상 φ_body는 φ_finger를 임계감쇠 2차 필터(ω 60)로 따르되 **경사 지연을 정확히 상쇄**하는 앞섬(2/ω = 33 ms)을 넣어 일정 속도 끌기에서 정상 지연이 0이고, 실린 만큼(40 ms·S) 몸이 앞선다. 스칼라 하나라 1/120 s에서 ω·dt = 0.5로 안정.
6. 베기 위상 속도 φ̇ = 1/T0 + kv·(손가락의 획 방향 빠르기). 손가락이 빠르면 몸이 빨리 풀리고 칼끝이 빨라진다. 손가락이 멈추면 1/T0로 계속 나간다(R2에는 제동이 없다 — 제동 brake0/brakeK는 R4, Q1).
7. 지나가기(φ 1~1.6) 동안 손가락 입력은 몸을 움직이지 않고 0.15 s 고리 버퍼에 담긴다. 복귀 시작 순간 버퍼 안의 마지막 쉼점이 새 손짓 원점 o가 되어, 지나가기 중에 이미 시작한 다음 감기가 지연 없이 인정된다("손가락은 언제나 이긴다").
8. 감기 없는 큰 긋기는 S_stroke(≤ kStroke 0.4, Q3)로 **몸통·골반·발·공동수축 채널만** 싣는다. 손 채널은 섞지 않는다(클립 손을 섞으면 손이 감기 자리로 되돌아가 휘청인다).
9. 관문(§4): 꼭두각시 손 오차 ≤ 0.03 m, 동작 크기(§2-6·targets.md 아래 문턱), S = 0 ±2 cm(사실상 바이트 동일), 감기 골반 5° ≤ 33 ms, 추적 손 오차 ≤ 0.08 m·칼 방향 ≤ 15°, 60/120 Hz ±3%, 비교 뷰어 화면.
10. 작업은 W1 atlas ∥ W2 gesture → W3 drive 몸통(+꼭두각시) → W4 drive 팔 → W5 관문 도구 → W6 AI 고리 인터페이스(6개, 파일 경계 분리, §7).

---

## 2. 모듈별 설계

### 2-1. `src/strike/gesture.js` — 손짓 읽기

#### 2-1-1. 파일과 API

```js
// src/strike/gesture.js
export class Gesture {
  constructor(fighter)                 // fighter.ges = this.out (한 번만 만든다, 스텝마다 새 객체 없음)
  attachTrace(fingerTrace)             // 플레이어: input.fingerTrace (main.js:344 자리)
  attachSource(src)                    // AI/도구: { at(tMs, predictMs) } 를 주는 아무 것 (SyntheticFinger)
  update(dt, tStepMs)                  // 물리 스텝마다 (skill.update 맨 앞). tStepMs = 이 스텝의 벽시계 ms
  reset()                              // 판 시작·부활 때
  get S(), get phi(), get fam(), get side(), get state()
}
export class SyntheticFinger { push(tMs, x, y); at(tMs, predictMs); }   // AI(R5)·시뮬이 같은 길로 넣는다
export const GES_IDLE = 0, GES_WIND = 1, GES_CUT = 2, GES_FOLLOW = 3, GES_RECOVER = 4;
```

출력 `fighter.ges` (모두 숫자/작은 배열, 미리 만든 것):

| 필드 | 뜻 |
|---|---|
| `state` | IDLE/WIND/CUT/FOLLOW/RECOVER |
| `S`, `Swind`, `Sstroke` | 싣기 0~1 (S = max(Swind, Sstroke); CUT 뒤에는 잠근 값) |
| `mode` | `'wind'` (손 채널까지) / `'stroke'` (몸 채널만, §2-1-6) |
| `phiF`, `phiDotF` | 손가락 위상과 그 속도 |
| `phi`, `phiDot`, `phiDDot` | 몸 위상(필터 출력)과 1·2계 미분 — drive가 쓴다 |
| `famA`, `famB`, `famMix` | 이웃 두 무리와 섞임 비 (CUT 뒤 lateSelect 지나면 famB = famA, mix 0) |
| `side` | `'right'` / `'left'` (클립 쪽) |
| `dirC[2]` | 획 방향(패드 단위 벡터, lateSelect 때 확정) |
| `w[2]`, `o[2]`, `p[2]`, `v[2]` | 감기 벡터, 원점, 자르지 않은 손가락 자리, 속도(패드 m, m/s) |
| `overWind` | (|w| − sL1) / (padExt − sL1), 0 아래는 0. 위는 자르지 않는다 |
| `tCut`, `tRecover` | 베기 시작·복귀 시작 시각(스텝 시계) |
| `busy` | state ≥ CUT && S > 0 (skill의 자세 복귀가 기다리는 조건) |

#### 2-1-2. 입력 어댑터

- R0의 `fingerTrace.at(tMs, predictMs)`가 (자르지 않은 패드 좌표 누적값, 속도)를 주는 것으로 본다. 다르면 `readFinger(src, t)` 한 곳만 고친다. 두 가지는 이 모듈이 스스로 지킨다:
  1. **절대 자리 p는 자르지 않는다.** `FingerTrace`는 dx·dy 조각이고(`input.js:127 this.fingerTrace.push(e.timeStamp || performance.now(), tdx, -tdy)`), `handOffset`은 `skill.js:399 if (off.length() > R) off.setLength(R);`에서 0.62 m로 잘린다. gesture는 조각을 스스로 적분한 p를 쓰고, **IDLE이고 손가락이 쉴 때만** `p := f.handOffset`으로 다시 맞춘다 — `detectCommit`이 `skill.js:566~577`에서 하던 것과 같은 기법(쉴 때 패드 자리에 맞춤, 긋는 중엔 안 맞춤). 그래서 원판 밖 0.62~1.0 m(그 너머도)로 끈 감기가 그대로 센다.
  2. **꺾임 판정은 예측값을 쓰지 않는다.** 8 ms 내다보기(`predictMs`)는 자리 p에만 쓴다. 속도 v와 꺾임(§2-1-5)은 마지막 두 실제 표본으로 잰다 — 예측은 꺾이는 순간을 앞뒤로 틀리게 찍는다.
- 시각: `tStepMs`는 부르는 쪽이 준다. main.js에서는 `input.fingerTrace.tick(now)`(`main.js:1254`) 뒤 스텝 k의 시각 = `now − (acc − h·(k+1))·1000`(R0의 `at(t)` 정의를 따른다). 헤드리스(`tools/sim/harness_m.mjs feedTrace`, 223행)는 펌프 벽시계 `P.wall`을 그대로 준다 → 결정적.
- 떼기(`TRACE_LIFT`)는 `held=false`로 온다. 떼면 v는 마지막 두 표본 값으로 한 스텝 더 살아 있고(떼며 긋기 = 꺾임 판정에 쓴다), 그다음 0.

#### 2-1-3. 스텝마다 하는 일 (상태 기계)

```
update(dt, t):
  F = readFinger(src, t)                          // p, v, held
  if (!F.held && state == IDLE) rebase p to f.handOffset when at rest
  updateRest(F)                                   // |v| < restV 인 시간 → dwell; dwell ≥ restDwell 이면 o := p (IDLE/WIND에서만)
  switch state:
    IDLE:    w = p − o;  computeWind(w)           // Swind, famA/B/mix, side, phiF = −1 + min(1, |w|/windLen)
             if Swind > 0 → state = WIND (같은 스텝에 계속)
    WIND:    w = p − o;  computeWind(w)
             if reversal(F, w) → startCut(t)      // §2-1-5
             else if slowReturn(F, w) → Swind decays τ tauRelease toward smoothstep(sL0,sL1,|w|)
             if Swind == 0 && dwell ≥ restDwell → state = IDLE
    CUT:     phiDotF = 1/T0 + kv·max(0, v·dirC); phiF += phiDotF·dt
             Sstroke = smoothstep(strokeL0, strokeL1, strokeLen(t))·kStroke;  S = max(Scut, Sstroke)
             if t − tCut ≤ lateSelect: lateSelect(F)     // §2-1-4
             if phiF ≥ 1 → state = FOLLOW
    FOLLOW:  phiDotF = 1/T0 (+ kv 항은 계속: 손가락이 여전히 획 방향으로 빠르면 지나가기도 빠르다)
             buffer.push(t, p)                    // 0.15 s 고리
             if phiF ≥ followEnd(1.6) → startRecover(t)
    RECOVER: phiF += dt / Trec(S)                 // 1.6 → recoverEnd 2.2, Trec = 클립 (tg−tf) 를 S로 섞은 값 (R4가 TrecBase+TrecS·S로 바꾼다)
             S decays τ tauRelease toward 0 ... 단 w = p − o 가 새 감기면 Swind가 곧바로 올라 state = WIND
             if phiF ≥ 2.2 && S == 0 → IDLE
  phiFilter(dt)                                   // §2-1-7: phi, phiDot, phiDDot
  write out
```

- S = 0인 스텝은 소비자가 아무 것도 하지 않으므로, IDLE·작은 감기·짧은 긋기는 **팔 베기 그대로**다(§3).
- 넘어지거나 칼을 놓치거나 찌르는 중(`skill.tap`)이면 `reset()`: S를 τ 0.08로 0으로 접고 IDLE. (`skill.canCommit()` 547행의 조건을 그대로 쓴다: `f.alive && f.armed && !f.weapon?.gun && (stand|kneel) && !this.tap && !(finish.amt > 0.5)`.)

#### 2-1-4. 감기 벡터, S, 무리 고르기

- **원점 o**: 손가락이 `restV` 0.25 m/s 아래로 `restDwell` 40 ms 이상 머문 마지막 자리. 터치를 새로 대면 그 자리. RECOVER 시작 때는 버퍼의 마지막 쉼점(없으면 t_recover − 0.15 s의 자리).
- **감기 벡터 w = p − o**, |w|는 자르지 않는다. **S_wind = smoothstep(sL0 0.12, sL1 0.55, |w|)**. 오를 때 즉시, 내릴 때는 손가락이 천천히(|v| < vStrike) 돌아올 때만 τ 0.25 s(Q2: 감기는 공짜로 들고 거둘 수 있다). `overWind = max(0, (|w| − sL1) / (padExt − sL1))` — 1.0 m는 정규화 기준일 뿐 자르지 않는다. drive가 감기 채널을 크게 벌 너머로 외삽하는 데 쓴다(`overWindGain`).
- **감기 위상**: `phiF = −1 + min(1, |w| / windLen)`, windLen = sL1. 준비 자세(φ 0)에 S = 1과 같은 자리에서 닿는다. 그 너머는 φ 0에 머물고 overWind만 는다. 감기 자세는 첫 프레임부터 |w|에 1:1이다 — 준비 동작이 곧 끌기.
- **무리 고르기(이웃 둘만)**. 가우스 8방향 섞기는 쓰지 않는다. 무리마다 준비 자세 패드 `ch`(`config.js STROKE.path[fam].ch`: diagR [0.42,0.42], diagL [−0.4,0.42], vert [0.02,0.52], horizR [0.52,0.03], horizL [−0.52,0.03], riseR [0.38,−0.44], riseL [−0.4,−0.42])가 있다. **원점 o에서 본 준비 자세의 방위** `b_f = atan2(ch_f − o)`를 스텝마다 구하고 원형으로 정렬한다. 손가락 방위 `atan2(w)`를 끼우는 두 이웃 f_A, f_B를 고르고 `famMix = 각 비율`. 순수 방위(ch−end 축)가 아니라 원점 기준 방위를 쓰는 까닭: 쟁기(0.18, −0.28)에서 어깨 지붕으로 끄는 방위는 71°인데 축 방위로 보면 diagR 46°와 vert 89° 사이라 절반이 Oberhau가 된다. 원점 기준이면 순수 diagR이다.
  - 두 이웃 사이 각이 `sectorMax` 80°를 넘는 틈(아래쪽, riseL과 riseR 사이 = 곧장 아래로 끄는 것 = 바보 자세로 자세 바꾸기)은 감기가 아니다: S_wind = 0.
  - 왼쪽 무리(diagL·horizL·riseL)는 `side='left'` 클립(거울). vert는 `w.x` 부호로 쪽을 정하고, 0 근처는 직전 값을 지킨다.
  - 무리 → 클립: `CONFIG.GESTURE.famClip = { diag:'zornhau', vert:'oberhau', horiz:'mittelhau', rise:'unterhau' }` (다음 차례 zwerchhau·schielhau·scheitelhau는 값만 바꾼다).
- **lateSelect(70 ms)**: 베기 시작 뒤 70 ms 안(또는 획 길이가 0.10 m를 넘는 순간, 먼저 오는 쪽)에 획 방향 `dirC = unit(p − p_cut)`으로 무리를 한 번 다시 고른다: 모든 무리의 획 방향 `unit(end − ch)`과 내적이 가장 큰 무리. 감기 때 고른 짝과 다르면 famA→새 무리로 `famBlendT` 40 ms 크로스페이드(famMix가 그 시간 동안 1→0). 그 뒤 φ 1.6까지 고정. 근거(§2-2): 사람도 풀기 첫 60~80 ms는 골반·발이 움직이고 손은 거의 가만히 있다.

#### 2-1-5. 베기 시작: 속도 꺾임 (매 스텝 운동학 조건)

```
reversal(F, w): |v| > vStrike(1.5)  &&  dot(v, ŵ) < revDot(−0.3)·|v|
```
- 참이 되는 첫 스텝에 `startCut(t)`: `tCut = t`, `p_cut = p`, `Scut = Swind`(잠금), `phiF = 0`(감기가 덜 됐어도 0에서 출발 — 클립 φ 0 = 풀기 시작. 감기가 얕으면 S가 작아서 클립 몫 자체가 작다), `dirC = −ŵ`(lateSelect가 고친다), `state = CUT`. 확정 2단계는 없다. 이 스텝의 나머지 계산(φ̇, S)도 곧바로 한다.
- 떼며 긋기: `TRACE_LIFT`가 온 스텝에 마지막 두 표본으로 reversal이 참이면 시작. 그 뒤 v = 0이라 φ̇ = 1/T0로 나간다.
- 감기 도중 꺾이지 않고 손가락이 멈추거나 천천히 돌아오면 베기가 아니다(S_wind τ 0.25로 풀림, Q2).
- S = 0(감기 없음)이어도 reversal은 상태를 CUT으로 넘긴다 — S_stroke를 재기 위해서다(§2-1-6). S가 0으로 남는 동안은 아무 소비자도 움직이지 않는다.

#### 2-1-6. 감기 없는 큰 긋기 (S_stroke)

- `strokeLen(t)` = 베기 시작 뒤 손가락 이동 길이의 누적. `Sstroke = smoothstep(strokeL0 0.35, strokeL1 0.9, strokeLen)·kStroke 0.4`. `S = max(Scut, Sstroke)`, CUT 중에는 오르기만 한다.
- Scut = 0이고 Sstroke만 있으면 `mode = 'stroke'`: drive는 **몸통·골반·발·공동수축·닻 풀기·앞먹임**만 S로 싣고, **손·칼 방향·어깨띠·pole 채널은 섞지 않는다**(손은 자세표 = 손가락 그대로). 까닭: 쟁기에서 그은 손에 클립 손(φ 0에서 머리 위)을 섞으면 손이 뒤로 한 번 되돌아간다. 몸통만 실으면 "급할 때 크게 베는 맛"(Q3)이 몸의 회전으로 나온다.
- stroke 모드의 클립 위상 정렬: φ를 0이 아니라 **지금 가슴 yaw와 클립 chest.yaw(φ)가 같아지는 φ_align ∈ [0, 0.85]**에서 출발시킨다(클립 chest.yaw는 이 구간에서 단조 감소라 유일). 몸이 감겨 있지 않은데 클립이 감긴 자세에서 풀기 시작하는 어긋남을 없앤다.
- kStroke 0.4는 Q3의 값이다(§6).

#### 2-1-7. 위상 속도와 몸 위상 필터

- CUT/FOLLOW: `phiDotF = 1/T0 + kv·max(0, dot(v, dirC))`. T0는 무기군: `weaponCfg.gestureT0 ?? (twoHand ? (swordIhand/iLongsword > 1.3 ? 0.38 : 0.30) : 0.24)`(롱소드 0.30, 츠바이핸더 0.38, 세이버 0.24). kv 0.35 /m. 예: 손가락 6 / 12 / 20 m/s → φ̇ 5.4 / 7.5 / 10.3 /s → φ 0→0.85가 157 / 113 / 83 ms. 위로 자르지 않는다. 사람 힘으로 못 따라가는 재생을 요구받아도 클립 시계를 늦추지 않는다 — 늦는 만큼은 근력 한도(Hill, 22/80 N·m)와 물리가 정한다(Q4).
- **몸 위상 필터(스칼라, 임계감쇠 2차, ω = phiW 60)**:
  ```
  u    = phiF + phiDotF·(2/ω + leadMs·S/1000)   // 2/ω = 33 ms: 경사(ramp) 정상 지연을 정확히 상쇄. leadMs·S: 실린 만큼 몸이 앞선다
  a    = ω²(u − phi) − 2ω·phiDot
  phiDot += a·dt;  phi += phiDot·dt;  phiDDot = a          // 반음해 오일러, ω·dt = 0.5 (1/120) 에서 안정 (< 2)
  phi = min(phi, phiF + phiDotF·leadMs·S/1000)              // 몸이 손가락보다 앞서는 정도는 40 ms·S 까지 (Q1, §6)
  ```
  임계감쇠 2차 필터는 기울기 r인 경사 입력을 정상 상태에서 2r/ω 만큼 늦게 따른다. 그 몫을 입력에 미리 더하므로 일정 빠르기로 끄는 감기에서는 몸 위상이 손가락에 **지연 0**으로 붙고, 갑작스러운 점프(터치 새로 댐)만 33 ms 안에 59%로 따른다. 이것이 "골반 5° ≤ 33 ms" 관문의 위상 쪽 몫을 0으로 만든다. 나머지는 관절 응답(drive의 앞먹임)이다.
  WIND에서도 같은 필터를 쓴다(φ_F가 |w|로 직접 정해지므로 φ̇_F = dot(v, ŵ)/windLen).
- 물리 스텝은 늘 1/120(`config.js PHYSICS.timestep: 1 / 120`, `main.js:1293 while (acc >= PHYSICS.timestep && steps < PHYSICS.maxStepsPerFrame)`)이라 dt 가변성은 없다. 화면이 24~45 fps로 떨어져도 `at(t)`가 이벤트 시각으로 보간하므로 φ̇의 빠르기 항은 유지된다(§3-3의 "φ는 이벤트 시각을 쓰므로 빠르기가 유지됩니다").

#### 2-1-8. 지나가기 버퍼 (0.15 s)와 복귀

- FOLLOW(φ 1~1.6) 동안 gesture는 `w`를 갱신하지 않고 `(t, p)`를 길이 0.15 s 고리 버퍼(24 칸 × 3 Float64, 미리 만든 것)에 담는다. 몸은 클립 지나가기를 간다. 손가락은 이 구간에서 몸을 움직이지 못한다 — 대신 자세표 몫(1 − S)은 여전히 손가락을 따른다(S가 작으면 거의 팔 베기처럼 곧바로 선다: "S = 0이면 곧바로 섭니다").
- `startRecover(t)`: `o :=` 버퍼 안 마지막 쉼점(|v| < restV 구간의 끝) 또는 버퍼 첫 칸의 자리. 곧바로 `w = p − o`를 재어 S_wind를 계산한다 → 지나가기 중에 이미 반대쪽으로 끌기 시작했으면 **복귀 첫 스텝부터 WIND**다(Q18 이어 베기 기본 예). 몸통 몫은 남은 운동량을 이어받으므로(물리) 깊은 지나가기에서 큰 감기를 하려면 몸이 되감기는 시간이 물리적으로 든다 — 대본이 아니다.
- RECOVER 동안 S는 τ 0.25로 0을 향하되 새 감기가 이기면 오른다. 복귀 클립(tf→tg, `recoverTo` 자세, 예: zornhau_right → pflugL)은 drive가 S로 섞는다.
- skill의 "자세로 돌아가기"(`skill.js` 4단계, `this.recovering`, homeGuard로 1.2 m/s)는 `ges.busy`인 동안 시작하지 않는다(§2-3 고리 (h)). 끝나면 지금처럼 pflugL→pflug로 기어간다(그 빠르기 자체는 Q17).

#### 2-1-9. 고리(hook) — 정확한 자리

1. `src/skill.js:405` `if (WHOLE.on && WHOLE.commit && this.detect && this.trace) this.detectCommit(dt);`
   → `if (GESTURE.on && this.ges) this.ges.update(dt, this.stepT); else if (WHOLE.on && WHOLE.commit && this.detect && this.trace) this.detectCommit(dt);`
   `GESTURE.on`이면 플레이어는 detectCommit을 쓰지 않는다(예전 경로는 `GESTURE.on=false`로 비교 시험용). `cm.on`은 영원히 false라 406~407·457~459·467·481의 결심 가지들은 모두 죽은 가지다(값이 바뀌지 않는다).
2. `src/main.js:342~344` `input.fingerTrace.clear(); player.skill.detect = true; player.skill.trace = input.fingerTrace;`
   → 뒤에 `player.ges.attachTrace(input.fingerTrace); player.ges.reset();`. `skill.update(dt)`에 스텝 시각을 넘기는 자리는 `fighter.js:716 this.skill.update(dt);` → `this.skill.update(dt, this.stepT)`; `this.stepT`는 main 루프(`main.js:1293~1305`)가 스텝마다 넣는다(`player.stepT = …`). 헤드리스 펌프도 같은 필드를 채운다.
3. `src/fighter.js:233` `this.skill = new Skill(this);` 다음 줄에 `this.ges = GESTURE.on ? new Gesture(this) : null;`. AI 파이터도 만들되 소스가 없으면 `update()`는 즉시 return(S = 0).
4. `skill.js:547 canCommit()`의 몸 조건을 `Gesture.bodyOk(f)`로 옮겨 같이 쓴다(권총·넘어짐·찌르기·마무리).

#### 2-1-10. `CONFIG.GESTURE` (첫 값 = §9)

| 손잡이 | 첫 값 | 뜻 |
|---|---|---|
| `on` | true | 손짓 층. false면 이 모듈은 불리지 않는다(예전 detectCommit 경로) |
| `sL0`, `sL1` | 0.12, 0.55 | S_wind smoothstep (m). windLen = sL1 |
| `padExt` | 1.0 | overWind 정규화 기준 (m). 자르지 않는다 |
| `overWindGain` | 0.15 | drive: 감기 채널을 크게 벌 너머로 외삽하는 비율 × overWind |
| `restV`, `restDwell` | 0.25 m/s, 0.04 s | 손짓 원점 |
| `vStrike`, `revDot` | 1.5 m/s, −0.3 | 베기 시작(꺾임) |
| `tauRelease` | 0.25 s | 감기를 천천히 거둘 때 S가 주는 시정수(Q2) |
| `kStroke`, `strokeL0`, `strokeL1` | 0.4, 0.35, 0.9 | 감기 없는 큰 긋기(Q3) |
| `lateSelect`, `lateSelectLen`, `famBlendT` | 0.07 s, 0.10 m, 0.04 s | 무리 다시 고르기 |
| `sectorMax` | 80° | 이웃 준비 자세 사이 틈이 이보다 크면 감기가 아니다 |
| `predictMs` | 8 | 자리 내다보기 (꺾임 판정에는 안 씀) |
| `T0` | { two: 0.30, heavy: 0.38, one: 0.24 } | 위상 기본 시간(무기군, `weaponCfg.gestureT0`가 있으면 그것) |
| `kv` | 0.35 /m | 손가락 빠르기 → φ̇ |
| `phiW`, `leadMs` | 60 rad/s, 40 ms | 몸 위상 필터, 실린 만큼 앞섬 |
| `followEnd`, `recoverEnd` | 1.6, 2.2 | 클립 φ 표시와 같다 |
| `buffer` | 0.15 s | 지나가기 입력 버퍼 |
| `famClip` | 위 표 | 무리 → 클립 cut id |

---

### 2-2. `src/strike/atlas.js` — clip/2 읽기·검사·표본

#### 2-2-1. 파일과 API

```js
export const ATLAS_FORMAT = 'stillness-motion-clip/2', INDEX_FORMAT = 'stillness-motion-index/1';
export function loadAtlas({ index, files })  // Vite: import index from './clips/index.json'; files = import.meta.glob('./clips/*.json', { eager: true })
  → Atlas { get(cut, side, size) → Clip, sample(cut, side, phi, S, out), timing(cut, side, S), step(cut, side, S), recoverTo(cut, side), families }
export class Clip { id, cut, side, size, hz, n, marks, phiMarks, cols: { ch: Float32Array }, width, phiToT(phi), tToIdx(t) }
export function validateClip(json)           // 틀리면 throw new AtlasError(id, reason). 조용히 넘어가지 않는다
export function validateSmallAgainstGuards(clip, guardAt)  // 작은 벌 시작·끝 손 ≈ guards.js (허용 0.02 m)
```

- 클립 파일은 `src/strike/clips/`에 둔다. 만드는 곳은 동작 PM의 `tools/motion/build_clips.mjs`이므로 `--out=src/strike/clips` 옵션(또는 `npm run clips`가 `docs/motion/clips/*.json`+`index.json`을 복사)으로 가져온다. 게임 코드가 `docs/`를 직접 읽지 않는다. 복사한 파일에는 `sources`·`provenance`·`license`가 그대로 남는다.

#### 2-2-2. 검사 (하나라도 틀리면 throw)

- `format === ATLAS_FORMAT`, index `format === INDEX_FORMAT`. clip/1은 **거절**한다(clip/2에 필요한 `girdleS`·`elbowPoleO`·`step`·`recoverTo`가 없다).
- `hz === 120`, `data.n === cols.t.length`, 채널마다 `cols[ch].length === n × width[ch]`, NaN/Infinity 없음.
- 필수 채널: `t phi pelvis.yaw pelvis.pitch pelvis.drop chest.yaw chest.xFactor chest.lean chest.side handS handO sword edge elbowPoleS elbowPoleO girdleS girdleO feet.L.yaw feet.R.yaw feet.L.lift feet.R.lift com` (+ 검사용 `ang.*`, `J`). 실제 zornhau_right_large.json에서 모두 있음을 확인했다.
- `marks` 순서 `t0 < tw < tr < tc < tf < tg`, `phiMarks === {t0:−1, tw:0, tr:0.55, tc:0.85, tf:1.6, tg:2.2}`, `cols.phi` 단조 비감소이고 표시 사이에서 선형(오차 1e−3).
- 벡터 채널(`sword`, `edge`, `elbowPole*`) 길이 1 ± 0.02.
- 크기 세 벌이 다 있어야 그 (cut, side)가 등록된다. `index.json`에 있는데 파일이 없으면 throw.
- `size === 'small'`의 `startPose.handError`·`endPose.handError` ≤ 0.02 이고, 로드 시 `guardAt(pad)`로 다시 계산한 손 자리와 `handS[0]`, `handS[n−1]`의 차 ≤ 0.02 m(spec_table §7: 48벌 모두 0). 자세표가 바뀌면 여기서 걸린다.
- `handedness === 'right'`; 왼손잡이 파이터는 drive에서 z를 거울한다(`f.side`).

#### 2-2-3. 표본 `sample(cut, side, phi, S, out)`

- φ → t: `phiMarks` 구간을 찾아 `marks`로 선형 → 표본 자리 `i = t·hz` (실수).
- 표본 사이 보간: **Catmull-Rom(C¹)**, 4점. 각도·자리·스칼라는 성분별, 단위 벡터(`sword`·`edge`·`elbowPole*`)는 성분 보간 뒤 정규화(인접 표본 사이 각이 작아 nlerp = slerp 오차 무시 가능; 검사에서 인접 각 > 20°이면 throw). 재설계의 "5차 min-jerk·squad"는 저작 도구 몫이었고 clip/2는 이미 120 Hz 표본이다(clip_format §3-6 "보간은 atlas.js 몫").
- 크기 섞기(같은 클립의 벌끼리, φ 같은 자리): `S ≤ sizeMid(0.5)`: small↔medium, u = S/sizeMid; `S > sizeMid`: medium↔large, u = (S − sizeMid)/(1 − sizeMid). 두 구간인 까닭: clip_format §4 — 작게↔크게를 곧게 섞으면 손목(아래팔-칼) 각이 165~177°까지 간다. 보통 벌을 거치면 대부분 160° 안.
- 외삽(감기 채널만, φ ≤ 0, `mode='wind'`): `out += overWind·overWindGain·(large − medium)` — handS/handO/girdleS/pelvis.yaw/chest.yaw/chest.xFactor. 위로 자르지 않는다(soft limit이 물리로 막는다).
- **미분**: CR 스플라인의 해석 1계 미분 × (dt/dφ, 구간 상수) × `phiDot` → 속도(가슴 yaw·골반 yaw·손 등). 2계는 로드 때 각 표본에서 1계 미분을 Savitzky-Golay(5점)로 한 번 더 미분해 채널로 저장(`d2.*`), 표본 때 선형 보간 × `phiDot²` + 1계 × `phiDDot` (연쇄 법칙). 스텝마다 스플라인을 두 번 미분하지 않는다.
- `timing(cut, side, S)`: `summary.time`의 wind/releaseToLine/follow/recover를 같은 두 구간으로 섞은 값. gesture의 Trec(복귀)와 R3의 chainGap 확인에 쓴다.
- `step(cut, side, S)`: clip/2 `step { foot, from, to, liftT, landT, liftPhi, landPhi }` — 실제 large: `foot 'R', to [0.52, 0.12], liftPhi 0.14, landPhi 0.85`; small은 `null`. S로 보폭을 섞고(small null = 0), liftPhi/landPhi는 large 값.
- 할당 없음: `out`은 호출자가 가진 `Float32Array` 묶음. 스텝당 채널 ~40 × 4점 CR × 3벌 ≈ 500 곱셈 → ≪ 0.05 ms.

#### 2-2-4. 좌표·부호 (clip_format §2와 게임)

- 가슴 틀 원점 = 가슴 가운데 = `guards.js` 손 원점 = `fighter.js:1721 const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));`의 `c`(chest translation). 축 [앞, 위, 칼 쪽] = 게임 `handLocal` (x 앞, y 위, z 칼 쪽) — 같다. 다만 게임 손 틀은 **바라보는 틀(this.yaw)**이고 클립 손은 **가슴 상자 틀**이다 → drive가 명령 가슴 회전으로 돌린다(§2-3 (b)).
- yaw 부호: 클립 + = 칼 쪽 어깨가 뒤로(guards.js 부호). 게임 `bodyPose.chestYaw = −G.chestYaw`(`fighter.js:647 follow('chestYaw', -G.chestYaw * gw * amp, …)`). 그러므로 `chestYawCmd = −deg2rad(clip.chest.yaw)`, `pelvisYawCmd = −deg2rad(clip.pelvis.yaw)`. 왼쪽 클립은 이미 거울이라 추가 부호 없음.
- 낮춤 `pelvis.drop`: 자세표는 `(G.drop − 0.06)`을 쓴다(`fighter.js:648`). 클립 small이 자세표에서 왔으므로 같은 뜻이라고 보되, **꼭두각시 모드에서 확인**한다(§4).

#### 2-2-5. `CONFIG.ATLAS`

`{ dir: 'clips', format: 'stillness-motion-clip/2', indexFormat: 'stillness-motion-index/1', hz: 120, sizeMid: 0.5, smallTol: 0.02, vecStepMaxDeg: 20 }`.

---

### 2-3. `src/strike/drive.js` — ClipDrive (몸통·다리) + `src/strike/drive_arm.js` (팔·손·칼)

두 파일로 나눈 까닭: 별도 worktree에서 병행(§7). `fighter.drive = new ClipDrive(fighter, atlas)` 하나가 두 부분을 가진다.

#### 2-3-1. API와 스텝 순서

```js
class ClipDrive {
  constructor(fighter, atlas)
  update(dt)            // fighter.step: skill.update 뒤, updateBodyPose 앞. ges → (fam, side, phi, S) → atlas.sample → this.cmd 채움
  get w()               // = ges.S (0이면 아래 모든 고리가 아무 것도 하지 않는다)
  mixBody(bp, bv, dt)   // updateBodyPose 끝: 클립 몫을 S로 섞고 bv를 클립 미분으로
  applyTorques()        // applyPose 뒤: 척추·엉덩이 앞먹임 τ_ff, soft limit, 관절 범위 갱신
  anchorYawRelax()      // driveBalance: 1 − anchorRelaxYaw·S (yaw 축만)
  twistLim()            // applyPose: lerp(0.8, spineTwist, S)
  footPivot(k)          // gait: 발 yaw 목표 더함
  requestStepIfDue()    // φ가 liftPhi를 지나면 gait.requestStep
  // drive_arm.js
  mixHand(handLocal)    // driveSword: 손 목표(바라보는 틀) 섞기
  mixAim(aim)           // driveSword: 칼 방향 섞기
  shoulder(out), pole(out, Dn, flex)   // armIK: 어깨점 오프셋, pole(이력)
  rateLim(base), cocontract()          // driveJoints/manualMuscle: lerp(15|20, 40, S), 1 + 0.5·S
  armFF(j)                             // manualMuscle: I·α_des·ffGain·S
  onResult(kind, info)                 // combat: 닿음·막힘 — aim warp 끝, R3/R4가 쓴다
  script(phi, S, fam, side)            // 시험: gesture 대신 대본으로 φ·S를 넣는다 (꼭두각시·관문)
  debug                                // chain.mjs가 읽는 표본 (§2-4)
}
```

`fighter.step` (`fighter.js:698~730`) 순서에 끼우는 자리:
```
716  this.skill.update(dt);            → this.skill.update(dt, this.stepT);
     + if (this.drive) this.drive.update(dt);
717  this.updateBodyPose(dt);          (안에서 끝에 drive.mixBody)
718  this.driveBalance(dt);            (안에서 anchorYawRelax)
719  if (this.gait?.active) this.gait.pinFeet();   (안에서 footPivot)
720  this.applyPose(dt);               (안에서 twistLim)
     + if (this.drive?.w > 0) this.drive.applyTorques();
722  this.driveSword();                (안에서 mixHand/mixAim/shoulder/pole)
723  this.offHand();                   (그대로. 빈손 지렛대는 R3)
724  this.driveJoints();               (안에서 rateLim/cocontract/armFF)
```

#### 2-3-2. (a) 몸통과 골반: 시간표 + 앞먹임

고리 1 — `fighter.js:605 updateBodyPose(dt)`. 지금 코드는 그대로 두고(612 `const follow = (key, target, w) => {…}`, 622 `const pf = …`, 646~649의 `follow(...)` 넷) 651 `this.pelvisYawOffset = bp.pelvisYaw;` **바로 앞**에 한 줄:
```js
if (this.drive?.w > 0) this.drive.mixBody(bp, bv, dt);
```
`mixBody`:
```
S = w
for key of [pelvisYaw, chestYaw, pitch, drop]:
  tgt   = clipTarget(key)            // pelvisYawCmd = −rad(clip.pelvis.yaw) [wind 모드: × 1, stroke 모드: × 1] ; chestYawCmd = −rad(clip.chest.yaw)
                                     // pitch = rad(clip.chest.lean), drop = clip.pelvis.drop − 0.06 (§2-2-4, 꼭두각시로 확인)
  bp[key] = bp[key] + (tgt − bp[key])·S          // lerp(자세표 값(필터 통과), 클립 값(필터 없음), S)
  bv[key] = bv[key] + (clipRate(key) − bv[key])·S // 미분도 섞는다: S가 내려갈 때 follow()가 이어받는 상태가 연속
pelvisTgt 는 건드리지 않는다 (결심 가지 전용, 죽은 가지)
```
- **hipRoom**: 지금 `COMMIT.hipRoom` 0.6 클램프는 결심 가지(632~636) 안에만 있어 gesture 경로에서는 걸리지 않는다. 대신 골반 관절 한계 `GAIT.hipTwist 0.9`(`gait.js:45 jd.lim = { ...jd.lim, y: [-GAIT.hipTwist, GAIT.hipTwist] }`)와 `GAIT.maxTwist 0.9`(`gait.js:252`)가 실제 벽이다. 큰 Zornhau는 골반 +35° → −40°(0.7 rad 최대), 지나가기 끝 발 yaw −45°(클립 `feet.L.yaw` tf). 발 돌림(Q5)이 있어야 골반이 관절 한계 안에 머문다. `hipRoom 1.1`은 이 경로에서는 `DRIVE.hipRoom`으로 두고 **골반 명령 각의 soft limit 중심**으로 쓴다(1.1 − 0.15부터 되밈).
- **앞먹임 토크** (`applyTorques`, applyPose 뒤): 척추(abdomen·chest 몸체 수직축)와 엉덩이(pelvis ↔ 딛은 허벅지)에 `τ_ff = I_eff · α_cmd · ffGain(0.8) · S`. `α_cmd = clipYawDDot`(atlas 2계 × φ̇² + 1계 × φ̈). `I_eff`는 몸체들의 실제 질량과 무게중심 거리로 스텝마다 점질량 근사(`gravityTorque`(`fighter.js:1600~`)와 같은 방식, 할당 없음): 척추 위 = chest+head+uarmS+farmS+uarmO+farmO+sword, 골반 = 위 + abdomen. 작용·반작용은 딛은 허벅지(`gait.legs[k].stance`)에 나눠 준다. 스플라인의 I·q̈라 뾰족하지 않다(§6-6).
- **곧게 서기 닻 yaw 풀기**: `fighter.js:1321~1324`
  ```js
  for (const ax of MOTOR_AXES) {
    const r = this.uprightRelax(ax);
    raw.jointConfigureMotorPosition(this.uprightJoint.handle, ax, 0, BODY.uprightStiffness * assist * r, BODY.uprightDamping * assist * r);
  ```
  → `const r = this.uprightRelax(ax) * (ax === MOTOR_AXES[2] && this.drive?.w > 0 ? this.drive.anchorYawRelax() : 1);` 로 **yaw(비틀기, 축 5) 성분만** `1 − anchorRelaxYaw(0.9)·S`. 기울기 축(3·4)은 그대로 — 넘어짐 방지는 유지. 닻의 회전 목표 자체(1310 `anchorQ = _qt.setFromAxisAngle(UP, this.heading + this.pelvisYawOffset)`)는 `pelvisYawOffset = bp.pelvisYaw`(651)이라 mixBody 뒤의 명령 골반을 따라 돈다 — 닻이 클립과 싸우지 않는다.
- **범위 넓히기와 soft limit** (Q5 기본 허용):
  - `fighter.js:1542 const twist = THREE.MathUtils.clamp(chestYaw - (this.state === 'stand' ? bp.pelvisYaw : 0), -0.8, 0.8);` → `-tl, tl`, `const tl = this.drive?.twistLim() ?? 0.8` (= lerp(0.8, DRIVE.spineTwist 0.95, S)).
  - 관절 한계 `jointDefs`(`fighter.js:80~81`: abdomen `y: [-0.5, 0.5]`, chest `y: [-0.6, 0.6]`)와 엉덩이 `hipTwist`: 생성 때 값은 그대로 두고, `applyTorques`가 S > 0일 때 `rawSet.jointSetLimits(handle, axis, −L, L)`로 `L = lerp(base, wide, S)`(abdomen 0.55, chest 0.7, hip 1.1)로 넓히고, S가 0으로 돌아오면 **마지막 한 번** base로 되돌린다. S = 0인 스텝에는 엔진을 건드리지 않는다(§3). Rapier 버전에 `jointSetLimits`가 없으면(확인 항목, §5) 생성 때 `DRIVE.on`일 때만 넓히고 soft limit 토크로 base를 지킨다 — 그 경우 S = 0 바이트 동일은 "충돌로 한계에 닿는 드문 스텝"에서 깨지므로 시험판 노트에 적는다.
  - soft limit: 넓힌 한계 `softLim 0.15 rad` 앞부터 `τ = −k_soft·(q − (L − 0.15))² ·sign` (k_soft는 관절 k의 2배), 감쇠 소량. 튐 방지용이지 속도 한도가 아니다.
- **stroke 모드**(§2-1-6): 위 모든 것을 그대로, 손 채널만 섞지 않는다. 골반·가슴은 클립 φ_align부터.

#### 2-3-3. (b) 손·칼: 명령 가슴 틀과 앞먹임 (`drive_arm.js`)

고리 2 — `fighter.js:1688 driveSword()`:
```
1694  const off = this.skill.aim;                             (자세표 몫은 지금처럼 걸러진 aim)
1702  const G = guardAt(off.x, off.y, this.guardPose, this.finish);
1703~1718 handLocal = 자세표/찌르기/결심 덧씌움 (그대로)
1719  handLocal.x = Math.min(handLocal.x, this.closeReach());   ← 자세표 몫에만: 이 줄 **뒤에**
   +  if (this.drive?.w > 0 && this.drive.handOn) this.drive.mixHand(handLocal);
1721  const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));
1722  if (mus >= 0.12 && this.state !== 'dead') this.armIK(target);
```
`mixHand(handLocal)`: `hClip = R_cmd · clip.handS`(왼손잡이면 z 거울) 여기서 `R_cmd = R_up(chestYawCmd_rel) · R_side(leanCmd)`; `chestYawCmd_rel`은 **명령된** 가슴 회전(mixBody가 쓴 bp.chestYaw − 바라보는 틀) — 실측 가슴을 쓰면 되먹임 떨림(§2-2 (3)(b)). `handLocal ← handLocal + (hClip − handLocal)·S`. 그 결과 월드 손 속도 = 가슴 회전 × 반지름 + 팔 상대 속도. `closeReach` 클램프는 자세표 몫에 이미 걸렸고 클립 몫에는 걸리지 않는다(재설계: "closeReach 자르기(1711)와 패드 원판 자르기(skill.js 401-402, 465)는 팔 베기 몫에만" — 스냅숏 줄은 1719, 399, 462).
- **aim warping ≤ 0.25 m**: φ ∈ [φr, φc] 동안 `hClip += ramp(φ)·clamp(target_part − clipHandAtPhiC, warpMax 0.25)` — `target_part`는 상대 머리/가슴 중 클립 겨눈 선에 가까운 것(`foe.bodies.head|chest.translation()`을 바라보는 틀로). `onResult`가 오면 0으로 접는다(30 ms). 조정 손잡이이지 한도가 아니다(§6).

칼 방향: `1733 const aim = _v3.set(...guardDir(off.x, off.y));` … `1745 if (cp.plane > 0) this.cutPlane(aim, cp);` 다음, `1746 aim.applyQuaternion(this.yaw);` **앞**에
```js
if (this.drive?.w > 0 && this.drive.handOn) this.drive.mixAim(aim);   // slerp(aim, R_cmd·clip.sword, S), 정규화
```
클립 `sword`는 저작 때부터 "몸통이 먼저 돌고 칼이 늦게 따라오는" 늦춤을 품고 있다(README 3항). 손목의 명시적 늦게 풀기·빈손 지렛대는 R3. 1751 `if (wAim.length() > 25) wAim.setLength(25);`는 R0의 `STRIKE.wristRel`(아래팔 상대 60)로 이미 바뀐다.

고리 3 — `fighter.js:1925 armIK(target)`:
```
1931  const S = _ik2.set(0, 0.1, this.side * 0.2);           → 뒤에  if (dr?.w > 0) dr.shoulder(S);  // S.y += girdleS[0]·w, S.x += girdleS[1]·w (클립 최대 0.06/0.04 m)
1938  const pole = _ik3.set(-0.25, -1, this.side * 0.5).normalize();  → 뒤에  if (dr?.w > 0) dr.pole(pole, Dn, flex);
```
`pole(pole, Dn, flex)`: `pNew = normalize(lerp(pole, R_cmd·clip.elbowPoleS, w))`, 투영 `pDirNew = pNew − Dn·(pNew·Dn)`. **이력**: `dr.pDirPrev` 유지. 뒤집힘 후보 = `|pDirNew| < 0.25` 또는 `dot(unit(pDirNew), pDirPrev) < cos(120°)`. 후보면 이전 pDir를 쓰고, 후보 상태가 `poleHystT 30 ms` 넘게 이어지고 `flex > 20°`(팔이 곧지 않아 pole이 뜻이 있음)일 때만 새 값으로 넘어간다(그 뒤 40 ms slerp). 그렇지 않은 경우 `pole.copy(pNew)`. 지붕 자세의 pole은 위·바깥(large tw: `elbowPoleS = [0.58, 0.47, 0.67]`, small: `[0.36, −0.93, 0.09]`) — 90° 근처를 지나므로 이력이 꼭 필요하다. 뻗는 길이 0.565 m는 그대로.

고리 4 — `fighter.js:1552 driveJoints()`:
```
1591  const vz = THREE.MathUtils.clamp((_rv.z - prev.z) * inv, -15, 15);      → const rl = dr?.w > 0 ? dr.rateLim(15) : 15;  … clamp(…, -rl, rl)
1596  const v = THREE.MathUtils.clamp((_rv[ax] - prev[ax]) * inv, -15, 15);   → 같은 rl
      k, d (1564~1565 `const k = j.k * mus * (j.gain || 1);` `const d = j.d * Math.sqrt(Math.max(0.05, mus)) * (j.gain || 1);`):  칼 든 팔(uarmS·farmS)만 × dr.cocontract() = 1 + 0.5·S
```
`rateLim(base) = base + (DRIVE.motorRate 40 − base)·S`. S = 0이면 15 그대로(§3). `DRIVE.motorRateAll=false`(시험용: 모두에게 40 — 팔 베기 지연이 어떻게 변하나 보는 A/B, Q4·Q17에 붙임).

고리 5 — `fighter.js:1642 manualMuscle(j, k, d, maxT)`:
```
1660  if (wT.length() > 20) wT.setLength(20);   → const wl = dr?.w > 0 ? dr.rateLim(20) : 20;
      _mT = k·err + d·(wT − ω) (지금 그대로)  +  dr.armFF(j) = I_arm(axis)·α_des·ffGain·S   (α_des = (wT − wTprev)/dt, 1차 필터 τ 8 ms)
```
Hill 곡선(`hill(...)`, 124행)과 `maxT`(어깨·팔꿈치 80, 손목 22)는 그대로(Q4). 앞먹임은 cap 안에서만 낸다(같은 `if (tlen > cap) _mT.setLength(cap)` 뒤에 더하지 않고 **앞에** 더한다 — 근력 한도는 사람 생리).

#### 2-3-4. (d) 다리·걸음

- **발 돌림**(Q5): `gait.js:975 pinFeet()`의 발 yaw 스프링 — `1040 let ye = wrap(l.yaw - l.footYaw);` … `1046 _f.y = clamp(GAIT.pinYawK * ye - GAIT.pinYawD * w.y, -lt, lt);` — 에서 딛은 발의 목표 `l.yaw`에 `dr.footPivot(k)` = `rad(clip.feet[k].yaw)·S`를 더한다(마찰 한계 `lt = GAIT.pinMu · l.Nf · 0.05`를 넘으면 발이 미끄러져 돈다 — 물리이지 한도가 아니다)(발 이름: 클립 L/R ↔ 게임 F/B는 `f.side`로 대응; 오른손잡이 F = R). `GAIT.swingTwist 0.6`은 `lerp(0.6, DRIVE.swingTwist 1.0, S)`. `limitTurn`(`gait.js:243`)의 `GAIT.maxTwist`도 같은 lerp(0.9 → 1.1).
- **지나는 걸음**(Q7 기본 예): `requestStepIfDue()` — `state==CUT`, `S > stepS 0.3`, `f.gait?.active`, φ_body가 `clip.step.liftPhi`(large 0.14)를 지나는 첫 스텝에
  ```js
  f.gait.requestStep({ kind: 'strike', fwd: clip.step.to[0]·S(≈0.5 m), side: clip.step.to[1]·S, duration: (landPhi − liftPhi)/phiDot, hold: 0.25 })
  ```
  `gait.js:222 requestStep(o = {})` 은 `state==='stand'`·`move.y ≥ −0.1`을 요구하고 `duration`을 `clamp(…, 0.28, 0.7)`(226행)로 자른다 — 이 바닥은 §6-15. `kind:'strike'`는 `gait.js:411 next = this.req.kind === 'lunge' ? front : …`·`683 r.kind === 'lunge' ? l.p0 : other.plant`에서 'pass'처럼 처리된다(뒷발이 앞으로). 딛는 순간 `gait.js:742 this.onTouchdown(l.k, strength, kind)`(750행 빈 함수)에 `kind==='strike'`로 온다 → drive가 `landed=true`(R3 몸 결합·R4 잡는 걸음·연출이 읽는다).
  - `skill.js:525~530` 조이스틱 내딛기 `if (this.lunge > 0) { … f.move.y = Math.max(f.move.y, SKILL.lungeMove * L); }` 는 `&& !(f.drive?.stepping)` 조건을 더해 S > 0.3에서 겹치지 않게 한다(재설계 "S > 0.3이면 COMMIT.armLunge와 합칩니다").
- capture-point 잡는 걸음·관성 남기기는 R4.

#### 2-3-5. 그 밖의 고리

- (h) `skill.js:504` 자세 복귀: `if (canRecover && this.cutPending && !swinging && !f.handHeld && this.idle > SKILL.recoverDelay && !(prog && !cm.ended))` → `&& !(f.ges?.busy)`.
- (i) `combat.js:565 if (att.commit?.on) att.skill.strikeResult(r.pass ? 'through' : 'hit', r);` 와 `467 … f.skill.strikeResult(vn >= 2 ? 'blocked' : 'glance', …)` 옆에 `att.drive?.onResult(kind, r)` 한 줄씩(aim warp 끝, R3/R4 훅).
- (j) 왼손잡이·한손 무기: `guardAt`의 `out.oneHand` 처리와 같이 `f.weaponCfg.oneHandStance`이면 `handO`·빈손 채널은 쓰지 않는다. 세이버 moulinet 클립은 R6.

#### 2-3-6. `CONFIG.DRIVE` (첫 값)

| 손잡이 | 첫 값 | Q |
|---|---|---|
| `on` | true | |
| `ffGain` | 0.8 | |
| `cocontract` | 0.5 (× S) | |
| `motorRate`, `shoulderRate` | 40, 40 rad/s (lerp from 15/20 by S) | Q4 |
| `motorRateAll` | false | Q4·Q17 |
| `anchorRelaxYaw` | 0.9 (R4가 0.7 carry로 바꿈) | Q24 |
| `spineTwist`, `absTwist`, `chestTwist`, `hipRoom`, `swingTwist`, `maxTwist` | 0.95, 0.55, 0.7, 1.1, 1.0, 1.1 | Q5 |
| `softLim` | 0.15 rad | |
| `girdleMax` | 0.06 m (검사용 상한 아님, 클립 값 확인) | |
| `poleHystDeg`, `poleHystT` | 120°, 0.03 s | |
| `warpMax` | 0.25 m | (한도 아님, §6-16) |
| `stepS`, `stepHold` | 0.3, 0.25 s | Q7 |
| `handOnStroke` | false (stroke 모드 손 채널 섞지 않음) | Q3 |
| `puppet` | false / 클립 id | |

---

### 2-4. drive.js가 §3-3 조작감 목표를 위해 내놓아야 하는 것

`drive.debug`(미리 만든 Float64 필드, chain.mjs가 스텝마다 읽는다): `t, state, S, mode, phiF, phiB, phiDot, fam, side, handCmdW[3], handActW[3], handErr, aimCmdW[3], aimErrDeg, pelvisYawCmd, pelvisYawAct, chestYawCmd, chestYawAct, ffSpine, ffHip, stepReq, landed, warp`. 여기에 gesture의 `tCut`, 원점·w를 더하면 §3-3의 모든 항목이 한 기록에서 나온다.

| §3-3 목표 | 어디서 나오나 | 설계상 예산 |
|---|---|---|
| 손가락 → 손 목표 2 cm ≤ 33/25 ms | S = 0 경로(R1 aimLead) + S > 0: `handCmdW`는 φ_body(지연 상쇄)로 움직인다 | 입력 0~8 ms(coalesce+predict) + 위상 0 ms(경사) → 손 목표는 같은 스텝 |
| 고른 지연 ≤ 20 ms | 위와 같음; 필터를 거치지 않는 클립 몫 | 0~8 ms |
| 끌기 시작 → 골반·가슴 5° ≤ 33/25 ms | `pelvisYawAct − pelvisYawCmd`: 위상 0 + 관절 응답(τ_ff = I·α로 PD 오차 없이 출발) | 관절 20~30 ms (측정 관문) |
| 클립 추적 손 지연 ≤ 40~60 ms, 오차 ≤ 0.08 m | `handErr` 시계열의 DTW 지연 | FF + 40 rad/s + 공동수축 |
| 손가락 → 칼끝 5 cm: 지금보다 30 ms 이상 빠름 | chain.mjs tip 시각 − tCut | 위상 지연 제거(58~67 → ~0) + 팔 지연 감소 |
| 팔 베기 멈추면 0.07 m 안 | S = 0 경로 동일 | 동일 |
| 60/120 Hz 칼끝 ±3% | φ̇가 이벤트 시각 기반, 물리 dt 고정 | |
| 떨림(3 mm, 8 Hz) | 가죽끈 유지 + vStrike 1.5 ≫ 0.15 m/s(3 mm·2π·8) → 꺾임 오탐 0; S_wind는 |w| < 0.12에서 0 | |
| 쟁기 긋기 오분류 ≤ 3% | 쟁기에서 앞·옆 긋기는 w의 방위가 준비 자세 쪽이 아니거나(위 준비 자세 방위와 반대) 꺾임 전에 S_wind = 0 → stroke 모드 몸통 ≤ 0.4·smoothstep | `gesture_eval.mjs`로 잰다 |

---

## 3. S = 0 불변 논증

주장: `GESTURE.on = true`, `DRIVE.on = true`인 채로, 손가락이 감기(|w| ≥ 0.12)를 하지 않고 획 길이가 0.35 m를 넘지 않는 모든 입력에서 **모든 물리 입력(관절 목표·토크·모터 한계·발 목표·손 목표)이 `GESTURE.on = false && WHOLE.commit = false`(팔 베기)와 비트 단위로 같다.**

1. **S ≡ 0의 조건**: `Swind = smoothstep(0.12, 0.55, |w|)`는 |w| < 0.12에서 정확히 0(smoothstep은 x ≤ a에서 상수 0). `Sstroke = smoothstep(0.35, 0.9, len)·0.4`는 len ≤ 0.35에서 0. `S = max(0, 0) = 0`. RECOVER의 감쇠는 0에서 0. 따라서 `drive.w = ges.S = 0`.
2. **gesture는 자기 필드만 쓴다**: `fighter.ges.*`와 자기 버퍼. `handOffset`, `skill.*`, 관절, 엔진을 읽기만 한다. `p := f.handOffset` 재맞춤은 gesture 내부 값이다. skill.js:405의 분기로 `detectCommit`이 불리지 않으므로 `f.commit.on`은 false — 이것은 **의도한 제거**(§2-1 "두 가지를 없앱니다")이고, 팔 베기 경로(`WHOLE.commit=false` 기준)와 견주면 같은 값이다.
3. **모든 소비 고리는 `w > 0` 게이트 또는 항등식**이다:
   - `if (this.drive?.w > 0) …mixBody / mixHand / mixAim / applyTorques / shoulder / pole / onTouchdown 처리` — 불리지 않는다.
   - `rateLim(15) = 15 + 25·0 = 15`, `rateLim(20) = 20`, `twistLim() = 0.8 + 0.15·0 = 0.8`, `cocontract() = 1 + 0.5·0 = 1`, `anchorYawRelax() = 1 − 0.9·0 = 1`, `footPivot = 0`, `swingTwist = 0.6 + 0.4·0 = 0.6`. IEEE에서 `x + y·0 = x`(y 유한)이고 `x·1 = x`이므로 비트 동일. 클립 값의 NaN/Inf는 atlas 검사가 막는다(y 유한 보장).
   - 관절 한계 `jointSetLimits`는 S > 0에서만 부르고 S가 0으로 돌아오는 순간 한 번 base로 되돌린다. 감기·베기를 한 번도 하지 않은 판에서는 엔진을 건드린 적이 없다.
   - `requestStepIfDue`는 `S > 0.3`에서만.
   - `skill.recovering`의 `!(f.ges?.busy)`: busy = `state ≥ CUT && S > 0` → false → 조건 그대로.
   - `skill.lunge`의 `!(f.drive?.stepping)`: stepping은 requestStep을 부른 뒤에만 true.
4. **바이트 비교 시험**(W5): `node tools/sim/hybrid.mjs wholebody.mjs cuts`(SHAPE=minjerk, 팔 베기 입력 22가지 × 4~12 m/s × 60/90/120 Hz), `live_battery.mjs` 기본, `dance.mjs` 기본, `fights12.mjs` 시드 1/13/25/37/49 — `with_config.mjs GESTURE.on=true DRIVE.on=true` 대 `GESTURE.on=false WHOLE.commit=false`의 결과 JSON을 `diff`로 비교한다(칼끝 시계열·손 자취·판 결과). 기대: 동일. 어긋나면 그 스텝의 `drive.debug`를 찍어 S ≠ 0이 된 원인(오탐 감기)을 잡는다 — 그것은 "S = 0 경로가 바뀐 것"이 아니라 "S가 0이 아니었던 것"이라 gesture 문턱 문제로 분류한다(§2-4 오분류 ≤ 3%).
5. **한 번 S > 0이었다가 0으로 돌아온 뒤**는 상태(bp/bv, 관절 각)가 다르므로 동일할 수 없고, 그럴 필요도 없다(그것이 반동이다). 관문 "S = 0 ±2 cm"는 4의 시험으로 사실상 0 cm.
6. R1이 합쳐지면 팔 베기 경로 자체가 "의도한 지연 개선"만큼 바뀐다(§8 원칙). 그 뒤의 기준선은 R1 끝 커밋이다.

---

## 4. 꼭두각시 모드와 관문

### 4-1. 꼭두각시 모드 (운동학 확인, 물리 추적 전에)

- `DRIVE.puppet = '<clip id>'`(URL `?puppet=zornhau_right_large`, 헤드리스 `tools/sim/puppet.mjs`): 파이터의 `step()`에서 근육·균형·IK를 건너뛰고 스텝마다 클립 `J`(23 관절, 월드 → 파이터 heading·위치로 옮김)로 각 몸체 자세를 **운동학적으로** 놓는다(`tools/motion/lib/game_joints.mjs`의 "랙돌 관절 자리 = 몸체 자세 × (관절 기준점 − 몸체 처음 자리)"의 역). 카메라는 그대로라 사장님이 '진짜 사람 같은가'를 랙돌로 본다(비교 뷰어 옆에).
- 같은 스텝에 **게임 IK로 다시 풀어 견준다**: `armIK(chest + R_cmd·handS)`(어깨띠 오프셋·클립 pole 포함) → 앞으로 계산한 손 자리 vs 클립 `handS`(월드), 칼 방향 vs `sword`. 기록: 손 오차 최대/평균, 칼 각 오차, 팔꿈치 자리 vs `J.elbowS`(참고), 골반·가슴 yaw 부호 일치(클립 `pelvis.yaw`를 `−rad`로 넣었을 때 `bodies.pelvis` 회전이 클립 `J` 엉덩이선과 같은 쪽으로 도는가), `pelvis.drop` 규약(0.06 빼기).
- 관문(재설계 §2-2 (2)·§8 R2): **손 오차 ≤ 0.03 m**(모든 φ, 12벌: 4무리 × 좌우 × small/large 최소). 제안 추가: 칼 방향 ≤ 5°, yaw 부호 검사 통과. 여기서 틀리면 좌표 규약 문제라 물리 추적을 시작하지 않는다.

### 4-2. R2 관문 (수치는 §8 R2 행 + §2-6 + targets.md 아래 문턱)

| 관문 | 값 | 재는 도구 |
|---|---|---|
| 꼭두각시 손 오차 | ≤ 0.03 m | `puppet.mjs` |
| 동작 크기 (S = 1, 사선·가로·올려) | 감기 손 높이 ≥ 머리 +0.05 m(머리 위 베기), 손 앞뒤 ≥ 0.10 m 뒤, 어깨 들림 ≥ 130°(가로 110°), 칼 몸 뒤 ≥ 1.0 m, 지나가기 손 옆 ≤ −0.30 m(사선)/−0.33(가로·올려), 가슴 회전 ≥ 120°, 골반 ≥ 65°, 손 길 ≥ 1.8 m, 사슬 순서 골반 ≤ 가슴 ≤ 손 ≤ 칼끝 | `chain.mjs`(mx 항목) |
| S = 0 | ±2 cm (사실상 바이트 동일, §3-4) | `s0_diff.mjs` |
| 감기가 끌기를 지연 없이 | 끌기 시작 → 골반 5° ≤ 33 ms(60 Hz)/25 ms(120 Hz) | `chain.mjs` 지연 항목 |
| 추적 오차 | 시간 정렬 뒤 손 평균 ≤ 0.08 m, 칼 방향 ≤ 15°, 손 지연 ≤ 40~60 ms | `tools/motion/compare.mjs`(DTW) + record/1 |
| 60/120 Hz | 칼끝 ±3%, 24~45 fps 흔들림도 | `chain.mjs HZ=` |
| 성능 | 클립 추적 ≤ 0.05 ms/스텝, 보통 스텝 CPU ≤ +5~10% | `perf_ab.mjs SWITCH=DRIVE.on` |
| 안정성 | 세 무기, 헛침·맞힘·막힘, AI 대 AI 10분 NaN 0·튐 0 | `fights12.mjs`, `weapon_smoke.mjs` |
| 비교 뷰어 화면 | 크게 클립 ‖ 게임 기록 겹침 캡처를 사장님께 | `viewer.html` |
| 최종 | **사장님 플레이 평가** ("더 크고 준비가 보이며 둔하지 않은가") | 시험판 |

빠르기·세기 비율 관문(≥ 1.45배, ≥ 2배)은 R3 행이다. R2에서는 **기록만** 한다(위쪽 관문 없음).

---

## 5. 위험과 대응

| 위험 | 대응 |
|---|---|
| 무리를 잘못 고름(쟁기에서 위·옆으로 끌 때 Oberhau/Zornhau 경계) | 원점 기준 방위로 이웃 둘만 섞기(§2-1-4), lateSelect 70 ms, 획 방향으로 베는 면 굽히기는 R3(cutPlane) |
| 꺾임 오탐(떨림·느린 되돌림) | vStrike 1.5·revDot −0.3, 예측값 미사용, 가죽끈 유지; `gesture_eval.mjs`로 쟁기 긋기 오분류 ≤ 3% 측정 |
| 꺾임 미탐(둥글게 도는 손가락: 감기 끝에서 호를 그리며 베기) | dot(v, ŵ) < −0.3|v|는 63°만 꺾여도 참. 호가 더 완만하면 S_wind가 유지된 채 WIND에 머물고 S_stroke 경로로 흘러간다(몸통 몫은 남음). 수치는 시험판에서 |
| 클립 시작(φ −1 = 쟁기)이 지금 자세와 다를 때 | S가 |w|와 함께 오르므로 클립 시작 자세는 S ≈ 0에서만 보이고 섞임 무게가 0 — 자연히 숨는다. stroke 모드는 φ_align |
| 팔꿈치 pole 뒤집힘(지붕 자세 90° 근처) | 이력 120°/30 ms + flex > 20° 조건, 40 ms slerp |
| 앞먹임과 균형이 싸움(큰 S에서 넘어짐) | 닻은 yaw만, 기울기 축 유지; soft limit; 발 돌림; τ_ff는 스플라인 I·q̈; R2에서 넘어짐 비율을 기록만 하고 잡는 걸음은 R4. `anchorRelaxYaw`는 손잡이 |
| '정해진 애니메이션'처럼 보임 | ffGain 0.8, 나머지는 PD·충돌이 흔든다; 세 벌 섞기; 손가락 빠르기가 φ̇를 바꾼다 |
| `at(t)`의 8 ms 예측이 꺾임 판정을 흐림 | 예측은 자리에만 |
| `requestStep` duration 바닥 0.28 s가 빠른 베기에서 딛기를 늦춤 | §6-15, Q7. gait.js에 `kind:'strike'`면 clamp를 [0.12, 0.7]로 두는 변경을 사장님께 보고 |
| Rapier `jointSetLimits` 부재 | W3 첫날 확인. 없으면 생성 때 넓히고 soft limit로 base 유지(§2-3-2), S = 0 바이트 동일에서 예외 항목으로 기록 |
| 작은 벌 ≠ 자세표 중간 경로 | 끝점만 일치(0 cm). 중간 차이는 S 배로 들어오므로 S 작을 때 작다. 관문은 S = 0 뿐 |
| 지나가기 중 손가락 무시가 둔하게 느껴짐 | S 배로만 무시된다(작은 S는 곧바로 선다). 큰 S는 Q1의 정의 그대로. 버퍼로 다음 감기는 잃지 않는다 |
| 클립 좌표 규약(yaw 부호·drop) 오해 | 꼭두각시 모드 첫 관문 |
| CPU·할당 | Float32Array 미리 할당, THREE 객체 생성 0, CR 4점; `perf_ab.mjs` |
| 결정성 | 시각은 부르는 쪽이 준다(헤드리스 펌프 벽시계); `Math.random` 없음 |
| 폰 화면 가장자리(1.0 m 끌기) | pointer capture는 R0/input 몫, Q21. gesture는 자리를 자르지 않으므로 코드 쪽은 준비됨 |

---

## 6. 한도로 작용할 수 있는 값과 사장님 질문 대응

| # | 값(첫 값) | 어떻게 한도가 될 수 있나 | Q |
|---|---|---|---|
| 1 | `sL1` 0.55 (S_wind 포화) | 0.55 m 넘게 끌어도 S는 1. 단 overWind로 감기 채널은 계속 커진다(자르지 않음) | Q21 |
| 2 | `kStroke` 0.4 | 감기 없는 큰 긋기의 최대 싣기 | Q3 |
| 3 | `sectorMax` 80° (아래쪽 틈 = 감기 아님) | 곧장 아래로 끄는 것으로는 온몸을 싣지 못한다 | Q21 |
| 4 | `vStrike` 1.5, `revDot` −0.3 | 이보다 느린 되돌림은 베기가 아니라 감기 거둠 | Q2 |
| 5 | `tauRelease` 0.25 | 감기를 거두는 데 드는 시간(공짜지만 즉시는 아님) | Q2 |
| 6 | `lateSelect` 0.07 s | 그 뒤 무리 고정 = 속임수·꺾어 베기 불가(φ 1.6까지) | Q1 |
| 7 | `1/T0` (0.30/0.38/0.24) | 시작된 베기의 **아래 한도 빠르기**: 손가락을 멈춰도 T0로 끝까지 간다 | Q1 |
| 8 | `leadMs` 40·S | 몸이 손가락을 앞서는 정도의 상한 | Q1 |
| 9 | 지나가기 버퍼 0.15 s / FOLLOW 중 손가락 무시 | φ 1~1.6 동안 조작이 몸에 닿지 않는다(S 배) | Q1 |
| 10 | S 잠금(CUT 뒤 오르기만) | 베는 중 더 감아 S를 올릴 수 없음 | Q1·Q3 |
| 11 | `motorRate` 15→40·S, `shoulderRate` 20→40·S | 생리와 무관한 목표 속도 자르기(팔 베기는 15/20 그대로) | Q4 (`motorRateAll`은 Q17) |
| 12 | Hill 곡선, `maxAimTorque` 22, 어깨·팔꿈치 80 N·m (그대로) | 사람 근력 | Q4 |
| 13 | `STRIKE.wristRel` 60 rad/s (R0) | 손목 상대 속도 보호값 | Q22 |
| 14 | `spineTwist` 0.95, `absTwist` 0.55, `chestTwist` 0.7, `hipRoom` 1.1, `swingTwist` 1.0, `maxTwist` 1.1, `softLim` 0.15 | 관절 범위(사람 범위 안, 연구 트랙 실측으로 확인) | Q5 |
| 15 | `gait.requestStep` duration `clamp(0.28, 0.7)`, `req.age > 1`, `move.y < −0.1` 거절 | 빠른 베기에서 딛기가 늦거나 안 나감; 물러나며 베면 걸음 없음 | Q7 |
| 16 | `warpMax` 0.25 m | 자동 맞춤 도움의 크기(플레이어 힘·빠르기를 자르지 않음). Q 없음 — 투명성을 위해 적음 | — |
| 17 | `stepS` 0.3 | 이 S 아래는 지나는 걸음이 없음 | Q7 |
| 18 | `anchorRelaxYaw` 0.9 | 닻 yaw를 덜 풀면 몸통 회전이 잡힌다(속도 한도처럼 작용) | Q24 |
| 19 | 복귀 Trec (클립 tg−tf, small 0.30 ~ large 0.55) / RECOVER 중 S 감쇠 | 다음 감기는 언제나 시작 가능(쿨다운 없음) | Q18 |
| 20 | `phiW` 60 | 낮추면 몸이 손가락보다 늦어져 한도처럼 작용 | (손잡이, 조작감) Q17 |
| 21 | S × `guardWeight()`? — **넣지 않음**. 검술 보정 0에서도 손짓 층은 S 그대로 | (만약 넣으면 Q17) | Q17 |
| 22 | AI 최소 감기 시간 0.45/0.3/0.2 s (R5) | AI만 일부러 느리게 감음 | Q8 |
| 23 | 세이버·레이피어 T0 0.24 / 몸통 몫 | 한손 무기 크기 | Q26 |
| 24 | `closeReach` 클램프 | 자세표 몫에만; 클립 몫은 상대 몸 안까지 간다(한도 아님) | — |
| 25 | `PHYSICS.maxStepsPerFrame` 6 | 느린 폰에서 시간이 늘어나도 φ는 이벤트 시각 기준이라 빠르기 유지(한도 아님) | — |

---

## 7. 작업 나누기 (worktree별, 파일 경계, 순서)

| 항목 | 파일 | 내용 | 의존 | 검사 |
|---|---|---|---|---|
| **W1 atlas** | `src/strike/atlas.js`, `src/strike/clips/*`(복사), `tools/motion/build_clips.mjs --out`, `config.js CONFIG.ATLAS`, `tools/sim/atlas_check.mjs` | 로더·검사·φ 표본·두 구간 섞기·CR 미분·SG 2계·`timing/step/recoverTo` | 없음 | 검사 통과 48벌, 표본 연속성(φ 0.001 간격 C⁰/C¹), 보통 벌 손목 각 ≤ 160° 비율, NaN 0 |
| **W2 gesture** | `src/strike/gesture.js`, `config.js CONFIG.GESTURE`, `skill.js:405` 1줄, `fighter.js:233` 1줄·`716` 인자, `main.js:344` 2줄, `tools/sim/gesture_eval.mjs` | 상태 기계·o/w/S·이웃 무리·꺾임·lateSelect·φ̇·필터·버퍼·SyntheticFinger | R0 `fingerTrace.at` | `wholebody.mjs detect` 입력 묶음 재생: S/φ/무리 시계열, 쟁기 긋기 오분류 ≤ 3%, 꺾임 지연(첫 표본 → CUT) = 0 스텝, 60/90/120 Hz 동일 φ̇ |
| **W3 drive 몸통 + 꼭두각시** | `src/strike/drive.js`, `config.js CONFIG.DRIVE`, `fighter.js` 651·716~720·1321·1542, `gait.js` pinFeet·requestStep(`'strike'`)·750, `tools/sim/puppet.mjs`, `main.js ?puppet=` | mixBody·τ_ff·닻 yaw·관절 범위/soft limit·발 돌림·지나는 걸음·`script()`·debug | W1 (W2는 `script()`로 대체 가능) | 꼭두각시 손 ≤ 0.03 m, 대본 φ로 골반 5° ≤ 33 ms, 넘어짐 비율 기록, S = 0 바이트 비교 1차 |
| **W4 drive 팔** | `src/strike/drive_arm.js`, `fighter.js` 1719/1746/1931/1938/1591/1596/1564~1565/1660, `combat.js` 467/565 1줄씩 | mixHand(명령 가슴 틀)·mixAim·어깨띠·pole 이력·rateLim·공동수축·armFF·aim warp·onResult | W1, W3의 `cmd` 틀 | 추적 손 오차 ≤ 0.08 m·지연 ≤ 60 ms, pole 뒤집힘 0, S = 0 바이트 비교 2차 |
| **W5 관문 도구** | `tools/sim/chain.mjs`(R0에 gesture/drive 채널 추가), `tools/sim/s0_diff.mjs`, `tools/motion/compare.mjs` 연결(record/1), `film_wholebody.cjs` 장면(`zornhau-wind`, `mittelhau-wind`, `pflug-drag`), README 표 | §4-2 표 전부를 한 명령으로; 비교 뷰어 캡처 | W2~W4 | §4-2 |
| **W6 AI 고리 인터페이스** | `src/strike/gesture.js` (`attachSource`, `SyntheticFinger` — W2에 포함), `src/ai.js` 새 메서드 `planStrike(tech, S, windT)` **정의만**(호출하지 않음), `tools/sim/ai_gesture_probe.mjs` | AI 기술 경로(`tech.from → tech.path`)를 합성 손가락(감기 → 꺾임 → 획)으로 바꿔 Gesture에 넣는 변환기와, 같은 조각을 `handOffset`에도 더하는 규칙(자세표 몫이 같은 손가락을 보게). R5가 `startStrike()`(`ai.js:865`)에서 켠다 | W2 | 합성 손가락으로 플레이어와 같은 S/φ가 나오는지, AI 판 결과 불변(호출 안 하므로) |

순서: **W1 ∥ W2 → W3(꼭두각시 관문을 먼저 통과) → W4 → W5 → W6**. W3와 W4는 `fighter.js`의 다른 구역(605~651·1321·1542 vs 1564~1660·1719~1751·1931~1938)을 건드리므로 worktree를 나눌 수 있고, W3가 먼저 들어간 뒤 W4가 rebase한다. R3(손목 늦게 풀기·빈손 지렛대·몸 결합·운동량)·R4(반동)·R5(허점·AI)는 이 문서의 `drive_arm.js onResult`, `drive.landed`, `ges.state/S`, `SyntheticFinger` 위에 얹는다.
