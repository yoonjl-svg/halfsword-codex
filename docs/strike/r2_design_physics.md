# R2 물리 설계 — 액티브 랙돌에서 출발 (physics-first)

- 작성 2026-09-29. 대상 코드: `wbs-impl` 워크트리 `/home/user/hs-wbs` (HEAD bcf1fb1, R0 깃발 자리 `R0_OFF` 만 있음). 설계서: `docs/whole_body_redesign.md` §0–§5, §7-2, §8 R2 행, §9, §10. 참고 클립: `docs/motion/clips/*.json` (`stillness-motion-clip/2`, `clip_format.md`).
- 전제: R0 가 `STRIKE.gripMu`, `STRIKE.glitchFilter`(30 m/s 버림 삭제), `STRIKE.sweep`, `STRIKE.wristRel`(아래팔 상대 60 rad/s), `RENDER.interp`, `FEEL.logScale`, `INPUT.coalesce` + `fingerTrace.at(t)`, `tools/sim/chain.mjs`(record/1) 를 넣는다. R2 는 그 위에 얹는다.
- 원칙(사장님): 빠르기·세기·크기·빈도·시간에 새 한도를 두지 않는다. 한도처럼 작동할 수 있는 값은 §6 에 모두 적고 Q1–Q26 에 대응시킨다. 난이도 조정 없음. 인용한 줄 번호는 모두 워크트리에서 직접 확인한 것이다.

---

## 1. 요약 (10줄)

1. 지금 몸통이 칼에 힘을 싣지 못하는 물리적 이유는 세 가지다: (a) 골반 yaw 의 **유일한 구동기**가 곧게 서기 닻(`jointConfigureMotorPosition`, k 2500·d 330, `fighter.js:1323`)인데 목표 각속도가 0 이라 감쇠 330 N·m·s/rad 가 곧 **브레이크**다, (b) 손 목표가 `this.yaw`(바라보는 틀, `fighter.js:1721`)라 가슴이 돌아도 손이 실려 가지 않는다, (c) 모터 목표 속도가 ±15 rad/s(`1591`, `1596`)·어깨 20 rad/s(`1660`)에서 조용히 잘린다.
2. R2 의 물리 변경은 "필터를 시간표로, 위치 서보를 추적 서보로": S > 0 이면 골반·가슴·손 목표가 클립 φ 시간표에서 나오고, 모든 관절 모터에 **목표 각속도**(클립 미분 × φ̇)를 주며, 척추·어깨에는 앞먹임 τ_ff = ffGain·I·α_cmd 를 건다.
3. 닻은 **yaw 축만** `jointConfigureMotor(axis, θ_cmd, ω_cmd, k·(1−anchorYawRelax·S), d)` 로 바꾼다. 감쇠가 목표 속도를 향하므로 브레이크가 아니게 되고, 강성만 S 로 풀린다. 기울기(pitch·roll) 축은 그대로라 넘어짐 보호는 R2 에서 손대지 않는다.
4. 손은 **명령된** 가슴 틀에 둔다: `q_hand = slerp(this.yaw, q_chestCmd, S)`. 월드 손 속도 = ω_chest × r + v_arm 이 되어 R3(늦은 손목 풀기) 전에도 몸통 각운동량이 손·칼로 간다.
5. 범위: 척추 비틀기 자르기 ±0.8→±0.95, 배·가슴 한계 ±0.5/±0.6→±0.55/±0.7, hipRoom 0.6→1.1, swingTwist 0.6→1.0 (Q5 기본 허용), 한계 0.15 rad 앞부터 soft limit. 골반 큰 회전은 대부분 **발 앞꿈치 돌림**(gait pin yaw 목표 = 클립 `feet.*.yaw`·S)이 낸다 — 엉덩이 관절 한계는 거의 걸리지 않는다.
6. 안정성: 엔진 모터(척추·엉덩이·팔꿈치·닻)는 Rapier 0.19.3 의 암시적 constraint 라 k·d·dt 에 무조건 안정. 명시적 항(manualMuscle 어깨, 손목, 빈손 스프링, soft limit, τ_ff)만 ω_n·dt ≤ 0.5, c·dt/I ≤ 1 로 본다. 공동수축 ×(1+0.5S)는 어깨 **휘두름 성분만**(비틀기 축 k 25·d 0.8 은 60 Hz 에서 이미 ω·dt≈1 로 한계) 곱한다. φ 필터(ω 60)는 60 Hz 에서 2ω·dt = 2 라 explicit 로는 위험 → 정확 이산화(exact discretization)로 구현한다.
7. S = 0 경로는 모든 훅이 `if (D.active) {...} else { 기존 코드 그대로 }` 꼴이고, 모터 속도 클램프 ±15·어깨 20 도 `D.active` 일 때만 40 으로 올려 바이트 단위로 같게 둔다. R1 이 의도한 지연 개선 외에는 ±2 cm 안이어야 한다.
8. 꼭두각시 모드(`DRIVE.puppet`)는 물리 전에 옮기기(retarget) 수학을 검사한다: 클립 표본 → 명령 자세 → 순운동학 손 자리 vs 클립 `handS`, 관문 ≤ 0.03 m.
9. 반동·균형은 R4: R2 는 `updateFooting` 의 capture-point·stumble·fall 코드를 건드리지 않고, 관성 남기기·잡는 걸음 패드·복귀 클립을 넣지 않는다. 대신 R4 가 읽을 계측(`drive.debug`)을 남긴다.
10. 작업 5개(atlas·gesture·drive-trunk·drive-hands·step/AI/관문)로 나눠 별도 워크트리에서 간다. 순서: W1‖W2 → W3 → W4 → W5.

---

## 2. 모듈별

### 2-0. 지금 컨트롤러 (관절군별, 코드에서 읽은 값)

| 관절군 | 몸체·관절 | 지금 컨트롤러 | 이득·한도·필터·클램프 (줄) |
|---|---|---|---|
| 골반–다리 | pelvis ↔ anchor(kinematic) `uprightJoint` generic; thighF/B ball k 1800 d 160 max 560 lim x±0.6 y±0.6(z −0.5..2.0); hybrid: y±`GAIT.hipTwist` 0.9 (`gait.js:38-48`) | 닻: `raw.jointConfigureMotorPosition(handle, ax, 0, 2500·assist·r, 330·assist·r)` (`fighter.js:1321-1324`), anchorQ = heading + `pelvisYawOffset` (`1310`). 다리: `gait.poseLegs()` → `legIK` 가 **실제** 골반 회전 기준으로 허벅지 목표를 만든다(`gait.js:946-948`) → 엉덩이 모터는 골반 yaw 를 **구동하지 않고 발을 붙잡는다**. 골반 yaw 목표: `updateBodyPose` follow() 임계감쇠 2차 필터 w = `SKILL_BODY.pelvis` 34 × spd (`605-651`), 결심 중엔 `COMMIT.pelvisRate` 600°/s 와 `hipRoom` 0.6 클램프 (`634-637`) | 닻 yaw 감쇠 330 N·m·s/rad 가 목표속도 0 을 향함 = 브레이크. `uprightRelax` 실험은 `RECOIL.anchorRelax` false (`1189-1200`). `GAIT.maxTwist` 0.9 (heading 회전 한도, `gait.js:242-256`), 발 pin yaw `pinYawK` 300·`pinMu`·N·0.05 (`gait.js:1039-1047`) |
| 척추 | pelvis→abdomen ball k 1800 d 180 max 500 lim y ±0.5; abdomen→chest k 1600 d 160 max 440 lim y ±0.6 (`fighter.js:80-81`), abdomen 추가 관성 0.4 (`289`) | `applyPose`: `twist = clamp(chestYaw − pelvisYaw, −0.8, 0.8)`; `spine('abdomen', bend·0.5, twist·0.45)`, `spine('chest', bend·0.5, twist·0.55)` (`1542-1545`); chestYaw 목표는 follow() w = `SKILL_BODY.chest` 26 × spd. 모터: `driveJoints` 엔진 모터, 목표속도 = 목표 차분 클램프 **±15 rad/s** (`1596`), maxErr = max·mus/k | 비틀기 자르기 ±0.8, 한계 ±0.5/±0.6 hard(`jointSetLimits`, `353`) |
| 어깨(칼) | chest→uarmS ball `manual` k 320 d 26 max 80 (`85`) | `manualMuscle` (`1642-1684`): τ = k·e_swing + d·(ω_T − ω)_swing + 중력 보상, 힘-속도 `hill(·, shoulderVmax 18)` 로 cap (`1676-1677`); 목표 각속도 ω_T = 목표 차분, **20 rad/s 클램프** (`1660`); 비틀기 축 k 25 d 0.8 ±20 (`1680`) | 명시적(explicit) 토크 |
| 팔꿈치(칼) | uarmS→farmS hinge k 400 d 38 max 80 lim [0, 2.5] (`87`) | 엔진 모터, maxErr × `hill(wRel, elbowVmax 25)` (`1580-1588`), 목표속도 클램프 **±15** (`1591`) | |
| 빈팔 | uarmO ball k 400 d 36 max 140; farmO hinge k 240 d 20 max 100 | `offArmIK(gripAim)` (`2006-2035`), 스프링 `GRIP` k 1500 d 50 max 250 N (`1964-2004`) | 명시적 스프링 |
| 손목/칼 | farmS↔sword 구형 관절(`gripJoint`, `482`), 칼 토크 직접 | `driveSword` (`1688-1846`): aim PD `aimStiffness` 60·`aimDamping` 11, cap `maxAimTorque` 22×hill(wristVmax 30), 놓아주기/제동, wAim **25 rad/s** (`1751`, R0 가 wristRel 60 으로 바꿈), 날 세우기 4·twistScale | 명시적 |
| 손 목표 | — | `skill.update`: 가죽끈 → aimRaw → 원판 R 0.62 클램프 (`skill.js:399`, `462`) → 2차 필터 24/14 rad/s (`467-476`) → `driveSword` 깊이 매핑 + `guardAt` 가우스 SIGMA2 0.15² (`guards.js:82`) → `closeReach()` 자르기 (`fighter.js:1719`) → **`this.yaw` 틀** (`1721`) → `armIK` 어깨 (0, 0.1, ±0.2), pole (−0.25, −1, ±0.5) 고정 (`1931`, `1938`) | 원판·closeReach·자세표 볼록껍질이 손을 가슴 앞 상자에 가둔다 |
| 발 | shinF/B→footF/B (hybrid: ball, lim x±0.4 y±0.3 z −0.6..0.8) | `gait.pinFeet()` 정지마찰 스프링 pinK 20000, yaw 붙잡기 pinYawK 300 (한계 μN·0.05) (`gait.js:975-1051`); 뒤꿈치 `heelOff/toePivot` (`885-918`); 내딛는 발 yaw = 골반 기준 ±`swingTwist` 0.6 (`711-714`) | 발 돌림 목표는 지금 없음(딛은 yaw 를 지킨다) |
| 스텝 | `main.js:1293-1310` | 120 Hz 고정 스텝(`PHYSICS.timestep` 1/120), 최대 6 스텝/프레임; `step()` 순서 `updateHeading → skill.update → updateBodyPose → driveBalance → gait.pinFeet → applyPose → shove → driveSword → offHand → driveJoints → elbowGravity → trackBlade` (`fighter.js:714-725`) | |

관성 어림(부위 정의 `partDefs`, 상자는 반너비): 가슴 I_yaw 0.24, 배 0.11+0.4, 골반 0.13, 머리 0.024; 칼 든 팔 어깨 둘레 0.39(칼 없음)·≈1.3(롱소드, `swordIhand` 0.27 포함); 상체(배 관절 위) 수직축 I_up ≈ 1.0(감기, 손이 머리 위)~2.2(쟁기·긴 자세) kg·m².

### 2-1. `src/strike/gesture.js` — 손짓 읽기 (물리 스텝마다 S, dir, φ)

**Export**
```js
export class Gesture {
  constructor(fighter, opts = { trace: null })   // trace: FingerTrace (플레이어 input.fingerTrace 또는 AI 합성 trace)
  update(dt, tStep)      // 물리 스텝마다. tStep = 벽시계(ms), R0 의 fingerTrace.at(t) 로 보간·예측
  get S()                // 0~1 = max(S_wind, S_stroke)
  get phi()              // φ_body (−1 감기 … 0 감기 끝 … 1.6 지나가기)
  get phiDot()
  get family()           // { a: 'diagR', b: 'vert', t: 0.3 } 이웃 두 무리와 섞임(감는 동안) 또는 { a, b: null } (고정)
  get side()             // 'right' | 'left' (무리에서)
  get windVec()          // w (패드 m)
  reset()                // 터치 새로 댐
  feed(t, dx, dy, flag)  // 합성 표본 (AI 훅, §2-9). 내부 FingerTrace 에 push
}
```

**스텝 알고리즘** (`skill.update` 맨 앞, `skill.js:405` 자리에서 호출)
1. 손가락 자리 p(t) = `trace.at(tStep + predictMs)` (R0). 원점 o: |v| < `restV` 0.25 m/s 가 `restT` 40 ms 이어진 마지막 자리. 터치를 새로 대면(`TRACE_LIFT` 뒤 첫 조각) o 를 다시 잡는다. 손가락은 원판 0.62 를 넘어 `padExt` 1.0 까지 그대로 읽는다 — `skill.js:399` 의 `off.setLength(R)` 는 **팔 몫**에만 남고, gesture 는 `handOffset` 이 아니라 trace 를 적분한 자기 좌표를 쓴다.
2. 감기 벡터 w = p − o. "준비 쪽"인지: 지금 자세(pad)에서 각 무리 준비 자세 `STROKE.path[fam].ch` 로 가는 방향과 dot(ŵ, ĉ) > 0 인 무리가 하나라도 있으면 감기. 없으면 w = 0.
3. `S_wind = smoothstep(sL0 0.12, sL1 0.55, |w|)`. 오를 땐 즉시, 내릴 땐 |v| < vStrike 일 때만 τ `fallTau` 0.25 s 로 (감아 든 채 기다리기 가능, Q2).
4. 베기 시작(운동학 조건, 매 스텝): `dot(v, ŵ) < reverseDot(−0.3)·|v|` 이고 |v| > `vStrike` 1.5 m/s → `cutting = true`, φ 가 0 에서 출발. 인식 지연 0.
5. φ_finger: 감는 동안 `φ = −min(1, |w| / sL1)` (준비 동작 = 끌기 1:1). 베기 시작 뒤 `φ̇ = 1/T0 + kv·v_along` (v_along = 획 방향 손가락 빠르기, T0 무기별 0.30/0.38/0.24, kv 0.35 /m). 손가락을 멈추거나 떼도 φ 는 1/T0 로 계속 간다(끝까지 벰; 제동은 R4 Q1).
6. φ_body: 2차 임계감쇠 필터 ω `phiW` 60 rad/s 로 φ_finger 를 따르되 **정확 이산화**로 푼다 (§2-6): `E = e^{−ω dt}; x' = x_t + (e + (ė + ω e)dt)·E; ė' = (ė − ω(ė + ω e)dt)·E` (e = x − x_t). 몸은 손가락을 `leadMs` 40·S ms 까지 앞설 수 있다(φ_body ≤ φ_finger + 0.04·S·φ̇).
7. 큰 긋기: `S_stroke = smoothstep(0.35, 0.9, L_stroke)·kStroke`(0.4, Q3). S = max(S_wind, S_stroke). S 는 베기 시작 순간 값을 `S_cut` 으로 고정해 클립 크기 섞기에 쓴다(중간에 크기가 바뀌면 자세가 튄다); 감기 중에는 S 가 스텝마다 자유.
8. 무리: 감는 동안 ŵ 의 각도를 무리 준비 방향(`FAMS[].ch` 를 지금 pad 기준으로 본 각)의 원형 순서에 넣어 **이웃 둘**만 고르고 각도 비로 t 를 정한다. 베기 시작 뒤 `lateSelect` 70 ms 안에 v̂ 와 `FAMS[].dir` 의 cos 최대로 한 번 다시 고르고 고정. 무리→클립: diagR→`zornhau/right`, diagL→`zornhau/left`, vert→`oberhau/right`(왼쪽 지붕이면 `/left`), horizR/L→`mittelhau`, riseR/L→`unterhau` (`ATLAS.families`). 왼손잡이(`fighter.side` −1)는 z 거울.
9. 출력은 `fighter.gesture = { S, S_cut, phi, phiDot, fam, famB, famT, side, cutting, wind: w }`. `Skill` 은 `GESTURE.on && this.detect` 이면 `detectCommit` 을 부르지 않는다(`skill.js:405` 조건에 `&& !GESTURE.on`). 예전 경로는 `GESTURE.legacyCommit` 비교용.

### 2-2. `src/strike/atlas.js` — 클립 모음 (clip/2 로더·검증·표본)

**Export**
```js
export async function loadAtlas(url = ATLAS.dir + '/index.json')   // 브라우저 fetch / node fs. 한 번
export class Atlas {
  has(cut, side)
  sample(cut, side, phi, S, out)   // out = { handS[3], handO[3], sword[3], edge[3], poleS[3], poleO[3], girdleS[2],
                                   //   pelvisYaw, pelvisPitch, pelvisDrop, chestYaw, xFactor, lean, sideBend,
                                   //   feet: { L:{yaw,lift}, R:{yaw,lift} }, com[3], openness, guardGap,
                                   //   d: { …같은 키의 dφ 미분 }, dd: { chestYaw, pelvisYaw, xFactor, handS[3] } (2차) }
  marks(cut, side, S)              // { t0,tw,tr,tc,tf,tg } 크기 섞은 초, phiMarks
  step(cut, side, S)               // { foot, from, to, liftPhi, landPhi } (S 로 to·from 보간, 없으면 null)
  recoverTo(cut, side)             // 자세 id (R4 가 쓴다)
  sizes(cut, side)                 // ['small','medium','large']
}
```

**검증(불러올 때, 실패는 throw — 조용한 대체 없음)**
- `index.format === 'stillness-motion-index/1'`, 각 클립 `format === ATLAS.format` ('stillness-motion-clip/2'), 아니면 `throw new Error('atlas: ' + id + ' format ' + f + ' != ' + ATLAS.format)`. 시뮬 하니스(`tools/sim/harness_m.mjs newRound`)는 이 예외로 중단된다.
- `hz === 120`, `marks` 단조 증가, `phiMarks` = {−1, 0, 0.55, 0.85, 1.6, 2.2}, `data.cols[ch].length === n × width[ch]`, 필수 채널: `phi handS handO sword edge elbowPoleS elbowPoleO girdleS girdleO pelvis.yaw pelvis.pitch pelvis.drop chest.yaw chest.xFactor chest.lean chest.side feet.L.yaw feet.L.lift feet.R.yaw feet.R.lift com openness guardGap`. 단위 벡터 채널 |v| ∈ [0.98, 1.02].
- 작은 벌: `startPose.handError ≤ 0.02`, `endPose.handError ≤ 0.02` (S = 0 불변 조건: `spec_table.md §7` 은 모두 0). 넘으면 throw.
- 세 벌의 `phiMarks` 가 같아야 φ 로 섞을 수 있다(다르면 throw).

**표본**: φ → 각 벌의 t: `phiMarks` 구간 안 선형 역함수(구간별 `dt/dφ` 상수). 열마다 120 Hz 표본에 Catmull-Rom(C¹) 스플라인; 위치·각 채널은 성분 보간, 방향 채널(`sword`, `edge`, `elbowPole*`)은 보간 뒤 정규화하고 **벌끼리는 slerp**(`clip_format.md §4`: 성분 섞기는 칼이 뒤집힌다). 미분 `d/dφ = (dcol/dt)·(dt/dφ)` 는 스플라인 도함수(해석적), 2차는 φ ± `ATLAS.dPhi` 0.01 의 1차 미분 중앙차분. 크기 섞기는 두 구간: S < 0.5 → small↔medium (u = 2S), S ≥ 0.5 → medium↔large (u = 2S − 1) (`clip_format.md §4`: 작게↔크게 직선 섞기는 손목 165~177°). 시각도 같은 u 로 `marks` 를 섞는다. 비용: ≈40 채널 × 2 벌 × Hermite ≈ 0.01 ms/스텝(목표 ≤ 0.05).

**파일 위치**: 게임이 `docs/motion/clips` 를 직접 읽지 않게 `src/strike/clips/` 로 복사하고 `tools/motion/build_clips.mjs` 뒤에 `node tools/strike/sync_clips.mjs` 로 갱신(해시 기록). 브라우저는 `import.meta.url` 상대 fetch, node 는 fs.

### 2-3. `src/strike/drive.js` — ClipDrive (물리 추적)

**Export**
```js
export class ClipDrive {
  constructor(fighter, atlas)
  plan(dt)        // skill.update 뒤, updateBodyPose 앞: gesture 를 읽어 cmd 를 만든다 (S = 0 이면 active = false 로 끝)
  get active()    // S > 0 && fighter.armed && state ∈ {stand, kneel} && atlas.has(fam, side)
  cmd             // { S, phi, phiDot, pelvisYaw, pelvisYawDot, chestYaw, chestYawDot, xFactor, lean, sideBend, drop,
                  //   qChest (명령 가슴 틀, 월드), handS, handO, sword, poleS, girdleS, feet:{F,B:{yaw,lift}},
                  //   step: {want, fwd, liftPhi, landPhi}, warp[3] }
  trunkCmd(bp, bv, key, guardTarget)   // updateBodyPose 훅 (a)
  anchorYaw()                          // driveBalance 훅 (a): { theta, omega, kScale }
  spineTargets(J)                      // applyPose 훅 (a): 목표 + 목표속도 + τ_ff
  handFrame(q, out)                    // driveSword 훅 (b)
  ikParams()                           // armIK 훅 (b): { shoulder[3], pole[3] }
  jointRates(j)                        // driveJoints/manualMuscle 훅 (b): { omegaDes[3], alphaDes[3], coK, rateCap }
  footPivot(gait)                      // gait 훅 (d)
  debug                                // { S, phi, fam, tauFF: {abd, chest, sh}, anchorK, handErr, chestLag, pelvisLag } (chain.mjs 가 읽는다)
}
```

`fighter.step()` 순서에 `this.drive.plan(dt)` 를 `this.skill.update(dt)` 바로 뒤(`fighter.js:716` 다음 줄)에 넣는다. 모든 훅은 `if (D.active)` 분기이고 else 는 기존 줄이다.

#### (a) 골반–다리: 필터 대신 시간표, 닻은 추적 서보로

- **훅 `updateBodyPose` (`fighter.js:605-651`)**: 지금은
  ```js
  follow('pelvisYaw', this.pelvisTgt, sP);              // 637
  follow('chestYaw', -G.chestYaw * gw * amp * k, sC);   // 638
  … else { this.pelvisTgt = pT; follow('pelvisYaw', pT, SKILL_BODY.pelvis * spd); … }  // 645-649
  ```
  `D.active` 이면 follow() 를 거치지 않고 몸통 클립 몫을 직접 쓴다:
  `bp.pelvisYaw = lerp(pT, −C.pelvisYaw, S)`, `bv.pelvisYaw = −S·C.pelvisYawDot·φ̇` (부호: guards.js 규약 yaw + = 칼 쪽으로 감음, `updateBodyPose` 는 `−G.pelvisYaw` 를 쓰므로 클립도 같은 부호로 뒤집는다), chestYaw·pitch(=lean)·drop 도 같은 꼴. `COMMIT.pelvisRate` 클램프(`634`)와 `hipRoom`(`635`)은 S = 0 분기에만 남는다. S > 0 의 골반 한도는 `DRIVE.hipRoom` 1.1 (Q5) 를 **soft limit** 로만 건다(§2-3(a) 범위).
  - S 가 0→>0 으로 바뀌는 첫 스텝의 튐 방지: `lerp` 의 팔 베기 쪽 값이 지금 `bp` 값이므로(연속) 튀지 않는다. S 가 >0→0 으로 떨어질 땐 follow() 가 지금 `bp`, `bv` 에서 이어 간다(필터 상태를 그대로 쓴다).
- **훅 닻 (`fighter.js:1310`, `1321-1324`)**: `anchorQ = setFromAxisAngle(UP, heading + pelvisYawOffset)` 는 그대로(목표 각은 위에서 이미 시간표). 모터 루프를
  ```js
  for (const ax of MOTOR_AXES) {
    const r = this.uprightRelax(ax);
    if (D.active && ax === MOTOR_AXES[2]) {           // yaw 축만
      const a = D.anchorYaw();                        // { omega: −S·pelvisYawDot·φ̇ (닻 로컬 yaw 축 부호로), kScale: 1 − DRIVE.anchorYawRelax·S }
      raw.jointConfigureMotor(h, ax, 0, a.omega, K·assist·r·a.kScale, Dd·assist·r);
    } else raw.jointConfigureMotorPosition(h, ax, 0, K·assist·r, Dd·assist·r);
  }
  ```
  핵심은 목표 각속도다: 감쇠 330 이 브레이크에서 추적 항으로 바뀐다(지금은 골반 2.3 rad/s 에서 P = d·ω² ≈ 1.7 kW 를 버린다 — 설계서 §1-1 "몸통 회전 에너지 30~46 J 버림"의 물리적 실체). `anchorYawRelax` 첫 값 **0.5** (설계서 0.9). 까닭: hybrid 에서 골반 yaw 구동기는 닻뿐이라 0.9 면 k 250 N·m/rad — 속도 항이 있어 따라가긴 하지만 정상 지연이 커진다. R4 가 φ ∈ [0.5, 1.6] 관성 남기기 창에서 0.7~0.9 로 올린다(설계서 §4-1). 이것은 조정 손잡이지 한도가 아니다(§6).
  - 골반이 내야 할 토크: 클립 크게 Zornhau `w.pelvis` −5.3 rad/s 를 0.16 s 에 → α 평균 33, 최고 ≈ 65 rad/s²; I_pelvis 0.13 + 발 비틀림 마찰(발당 ≈ pinMu·N·0.05 + 엔진 접촉 ≈ 20~40 N·m) → 닻이 ≈ 90 N·m 를 내면 된다. k 1250·err → err 0.07 rad. 충분.
- **엉덩이 관절**: 목표는 `legIK` 가 실제 골반 기준으로 매 스텝 다시 만든다(변경 없음). 한계 y ±`GAIT.hipTwist` 0.9 유지. hipRoom 1.1 > 0.9 이지만 골반이 발에 대해 1.1 rad 비틀리기 전에 **발이 돈다**(마찰 한계 ≈ 40 N·m ↔ 엉덩이 모터 1800 N·m/rad × 0.02 rad) — 그래서 (d) 발 돌림이 곧 골반 범위다. 관절 한계에 걸리는 경우를 위해 y 한계 0.9 → `DRIVE.hipTwist` 1.1 로 넓히고 0.15 rad 앞부터 soft limit(아래).
- **범위와 soft limit**: 만들 때(`fighter.js:349`, `353`) 한계를 `DRIVE.on ? 넓힌 값 : 기존` 으로 넣는다 — abdomen y ±0.55, chest y ±0.7, thigh y ±1.1(hybrid). 넓힌 관절에는 명시적 되밀기 τ_soft = −k_s·(|θ| − (θ_lim − 0.15))₊·sign(θ) − d_s·ω·[θ 가 띠 안] (k_s 400, d_s 20 N·m·s/rad) 를 `driveJoints` 에서 `addTorque` 쌍으로 건다. 한계 자체는 hard 그대로라 튐 없이 서고, 띠 안에서 부드럽다. (S = 0 에서도 이 띠는 옛 한계 밖이라 팔 베기 동작은 건드리지 않는다: 옛 한계 0.5 < 새 띠 시작 0.4? — 아니다: 0.55 − 0.15 = 0.40 < 0.5. 그래서 S = 0 이면 τ_soft 를 걸지 않는다: `if (D.active)`. S = 0 은 hard 한계가 0.55 로 넓어진 채로 남지만 팔 베기 목표는 ±0.8 자르기 × 0.45/0.55 = ±0.36/±0.44 라 옛 한계 0.5/0.6 에도 닿지 않았다 → 궤적 동일. 이것이 S = 0 ±2 cm 의 근거 중 하나.)

#### (b) 척추: 시간표 + 목표속도 + 앞먹임

- **훅 `applyPose` (`fighter.js:1540-1546`)**:
  ```js
  const chestYaw = bp.chestYaw + (1 - gw) * -sk.aim.x * 0.35;
  const twist = THREE.MathUtils.clamp(chestYaw - (this.state === 'stand' ? bp.pelvisYaw : 0), -0.8, 0.8);
  spine('abdomen', bend * 0.5, twist * 0.45);
  spine('chest', bend * 0.5, twist * 0.55);
  ```
  `D.active`: 자르기 ±0.8 → ±`DRIVE.spineTwist` 0.95; `twist` 는 `lerp(twist_arm, −C.xFactor, S)` (클립 `chest.xFactor` = 가슴−골반), `bend` 에 `−S·C.lean` 몫과 옆굽힘 `C.sideBend`(x 축, 첫 구현은 0.5 배)을 더한다. 배분 0.45/0.55 유지. 목표 각속도 `J.abdomen.rateDes = [sideDot·0.45, −xFactorDot·φ̇·0.45, leanDot·0.5]` 을 두고 `driveJoints` 가 `prevRV` 차분 대신 이것을 쓴다.
- **훅 `driveJoints` (`fighter.js:1591`, `1596`)**: `clamp((_rv − prev)·inv, −15, 15)` → `D.active ? clamp(rateDes ?? 차분, −DRIVE.motorRate, DRIVE.motorRate) : clamp(…, −15, 15)`. 엔진 모터의 damping 항이 목표속도를 향하므로 이것이 척추·팔꿈치·빈팔의 앞먹임 1차 항이다.
- **앞먹임 토크**: `τ_ff = ffGain·I_seg·α_cmd` 를 `addTorque` 쌍(child +, parent −)으로: 배 관절에는 I_up(가슴+머리+두 팔+칼, 배 관절 수직축 둘레, 스텝마다 Σ m·r⊥² + I_own 으로 셈, 8몸체) × α_chestYaw; 가슴 관절에는 같은 것에서 배를 뺀 값. α_cmd = `C.dd.chestYaw·φ̇² + C.d.chestYaw·φ̈` (φ̈ 는 φ 필터가 준다). 크기 감: 큰 Zornhau 가슴 −11.2 rad/s 를 0.21 s 에 → α 최고 ≈ 100 rad/s², I_up 1.5 → τ_ff ≈ 120 N·m(배 max 500 의 24%). 감속(φ 0.6~1.0, α +66) 도 앞먹임이라 "의도적 감속"이 된다(설계서 §2-3). τ_ff 는 `maxErr`(근력 max) 와 별도로 `|τ_ff| ≤ j.max·mus` 로 자른다(같은 생리 한도, Q4).
- 골반 자체에는 τ_ff 를 걸지 않는다(닻 속도 항이 이미 있음; 골반에 토크를 걸면 닻과 싸운다).

#### (c) 어깨(manualMuscle)와 팔꿈치: IK 미분, 공동수축, 40 rad/s

- **훅 `manualMuscle` (`fighter.js:1658-1660`)**: `wT` 는 `j.prevTarget` 차분이고 `if (wT.length() > 20) wT.setLength(20)`. `D.active` 이면 `wT = j.omegaDes`(아래) 로 바꾸고 클램프를 `DRIVE.motorRate` 40 으로. 그 다음 줄(`1664-1665`)의 `_mT = k·e_swing − d·(ω − wT)_swing` 은 그대로, 여기에 `+ ffGain·I_arm·α_des` 를 더한다(I_arm = 어깨점 둘레 [uarmS, farmS, sword] Σ m·r⊥² + swordIhand). 힘-속도 cap(`1676-1677`)은 **그 뒤**라 생리 한도가 유지된다. 비틀기 축 줄(`1680`)은 건드리지 않는다.
- **ω_des, α_des (드라이브가 계산)**: 스텝마다 클립 손 목표를 φ, φ+Δφ, φ−Δφ 에서 IK 로 풀어(`armIK` 를 순수 함수 `solveArmIK(T, S_sh, pole, out)` 로 빼서 부작용 없이 세 번 호출) 어깨 쿼터니언·팔꿈치 각의 1·2차 차분 → ω_des(월드), α_des. 비용 3×IK ≈ 0.005 ms.
- **공동수축**: `k·(1 + coContract·S)`, `d·(1 + coContract·S)` (coContract 0.5) 를 어깨 휘두름 성분과 팔꿈치 모터 k·d 에. 비틀기 축(k 25 d 0.8)에는 곱하지 않는다(§2-6).
- **팔꿈치 (`1580-1592`)**: 목표속도 = IK 미분(elbow flex rate), 클램프 40; `hill(wRel, elbowVmax)` 그대로.
- 어깨 max 80 N·m 은 큰 클립 손 가속(가슴 틀 8 m/s 를 0.12 s → 65 m/s², 아래팔+칼 3.25 kg × 0.5 m ≈ 105 N·m)에 모자랄 수 있다. 설계서대로 클립 시계를 늦추지 않고 물리가 늦게 따라가게 둔다(Q4). 늦은 만큼은 `debug.handErr` 로 잰다.

#### (d) 발: 앞꿈치 돌림 (골반 큰 회전의 실제 공급원)

- `gait.js` 에 `l.pivot = { yaw: null, lift: 0 }` 를 두고 `D.footPivot(gait)` 가 스텝마다 채운다: 딛은 발 F(칼 쪽)←클립 `feet.R`(오른손잡이; 왼쪽 무리·왼손잡이는 거울), B←`feet.L`; `yawWant = heading + S·C.feet[k].yaw`, `liftWant = S·C.feet[k].lift·GAIT.heelMax`.
- **훅 `pinFeet` (`gait.js:1039-1047`)**: 지금은 `ye = wrap(l.yaw − l.footYaw)` 로 딛은 yaw 를 지킨다. `D.active && l.pivot.yaw != null` 이면 먼저 `l.yaw += clamp(wrap(l.pivot.yaw − l.yaw), ±DRIVE.footYawRate·dt)` (8 rad/s) → 붙잡는 힘이 돌림을 **돕는다**. 토크 한계 `lt = pinMu·N·0.05` 는 그대로(마찰이다). 뒤꿈치: `poseLegs` 의 `heel = max(0, heelOff(...) − heelDead)` (`gait.js:798-801`) 에 `max(heel, l.pivot.lift)` → `toePivot` 로 축이 발끝(`pinT`)으로 옮겨 N 이 앞꿈치에 실린다. 발 yaw 가 골반과 함께 돌면 엉덩이 y 축 오차가 작게 유지되어 hipRoom·hipTwist 는 안전판이 된다.
- 내딛는 발: `target()` 의 `swingTwist` 클램프(`711-714`) 0.6 → `DRIVE.swingTwist` 1.0 (Q5) — `D.active` 일 때만.

#### (e) 손: 명령된 가슴 틀, IK 어깨띠·pole(이력), 겨냥 휘기

- **훅 `driveSword` (`fighter.js:1696-1721`)**: 팔 몫 `handLocal_arm` 은 기존 그대로(깊이 매핑, `guardAt`, thrust, `closeReach` 1719). 그 다음
  ```js
  // 기존: const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(c);
  if (D.active) { D.handFrame(handLocal_arm, target) } else { 기존 줄 }
  ```
  `handFrame`: `hand = lerp(handLocal_arm, C.handS + warp, S)` 를 **명령 가슴 틀** `qChest = R_y(heading + chestYawCmd)·R_lean(−leanCmd)·R_side(sideCmd)` 로 돌린다(`qHand = slerp(this.yaw, qChest, S)`; 클립의 가슴 틀 정의 `clip_format.md §2`: 원점 가슴 가운데, 축은 가슴 상자와 함께 돈다). 잰 가슴 대신 명령값을 쓰는 까닭: 잰 값이면 손 목표 → 팔 토크 → 가슴 반작용 → 손 목표의 되먹임 고리가 생긴다(설계서 §2-2(3)(b)).
  - `aim` (`1733-1746`): `aim = slerp(aim_arm, C.sword, S)` 를 같은 `qHand` 로 돌린다(`1746` 의 `applyQuaternion(this.yaw)` 대체). `wAim`(`1748-1752`)은 클립 미분 `C.d.sword·φ̇` 를 회전시켜 쓴다(차분 대신). 손목 PD·cap 은 R2 에서 그대로(늦은 풀기·지렛대는 R3). 클립 `sword` 는 φ < φr 에서 이미 어깨 뒤로 누워 있어(크게 tw: [−0.69, −0.46, 0.56]) 운동학적으로 늦은 풀기 모양이 나온다; 손목 22 N·m 이 못 따라가는 만큼은 물리가 늦춘다.
  - `RIGHT_LOCAL.applyQuaternion(this.yaw)` (`1771`, 날 면 기본 방향) 도 `qHand` 로.
- **훅 `armIK` (`fighter.js:1931`, `1938`)**: `S_sh = (0, 0.1, side·0.2) + S·(C.girdleS[1]·x̂ + C.girdleS[0]·ŷ)` (최대 0.06/0.04 m, 클립 값), `pole = poleUsed`. pole 이력: 기본 pole p0 = (−0.25, −1, side·0.5), 클립 pole p1 = C.poleS(가슴 틀→가슴 틀 그대로, IK 가 가슴 틀에서 푼다). 후보 `pc = slerp(p0, p1, S)`; `poleUsed` 는 `pc` 를 최대 `poleRate` 6 rad/s 로 따라가되, `angle(poleUsed, pc) > poleAdopt 60°` 이면 60 ms min-jerk 로 넘어가고, 넘어간 뒤에는 `angle < poleRevert 30°` 가 될 때까지 되돌리지 않는다(90° 근처 뒤집힘 방지). 팔 길이 0.30 + 0.27 그대로.
- **겨냥 휘기(aim warping)**: φ ∈ [φr, φc] 동안 `warp = env(φ, φr, φc, φf)·clampLen(target_zone − handS_clip@φc, warpMax 0.25)`; target_zone = `cutPlane` 이 쓰는 상대 가슴+(머리−가슴)·pk 를 가슴 틀로 옮긴 것. 칼 방향에도 같은 회전을 준다. 상대가 없으면 0.
- **훅 `offHand` (`fighter.js:1981`)**: `gripAim = aimDirW·along + st` 는 그대로(빈손 지렛대는 R3, Q6). 단 빈팔 IK 의 pole 은 `C.poleO` 를 같은 이력으로(팔꿈치가 몸통을 뚫지 않게). `offArmIK` 어깨점도 `girdleO`.

#### (f) 지나는 걸음 (Q7 기본 예)

- `D.plan` 이 `cutting && S > DRIVE.stepMinS(0.3)` 이고 φ 가 `step.liftPhi`(클립, 큰 Zornhau 0.14; 없으면 0.55)를 지나면 한 번 `gait.requestStep({ kind: 'strike', fwd: S·|step.to − step.from|·cos + (1−S)·0? , side, duration: (landPhi − liftPhi)/φ̇, hold: 0.1 })`. `fwd` 첫 값은 `lerp(0, 클립 보폭 0.78, S)` 인데 설계서 첫 보폭 0.5 → `DRIVE.stepFwd` 0.5·S 로 시작하고 클립 값은 R6 에서. `requestStep` (`gait.js:222-228`) 은 `duration` 을 `clamp(0.28, 0.7)` 한다 — 클립 걸음 0.24 s 보다 길다. 'strike' 종류에는 아래 한도를 `DRIVE.stepDurMin` 0.2 로 낮춘다(기존 한도를 푸는 것, §6). `touchdown` 은 `onTouchdown(k, strength, 'strike')` (`gait.js:742-750`) 로 이미 알린다 — 연출(L6a)과 chain.mjs 가 딛는 때(φc ±50 ms 목표)를 잰다.
- S > 0.3 이면 `COMMIT.armLunge` 경로(`skill.js:529`, `beginAutoCut` 의 `this.lunge`)는 켜지 않는다(둘이 겹치면 두 걸음).
- `GAIT.maxReach` 0.5 는 `target()` 의 walk 분기에만 걸린다(req 분기는 안 걸림, `gait.js:674-718`). `GAIT.swingVmax` 6 m/s 는 걸린다: 0.78 m/0.24 s = 3.3 m/s 라 아직 안이다.

#### (g) 화면 (`syncMeshes`, `fighter.js:2069-2081`)
R0 `RENDER.interp` 가 물리 누산기 비율로 보간한다. R2 는 꼭두각시 모드에서 `syncMeshes` 가 kinematic 몸체를 그대로 그리므로 추가 변경 없음.

### 2-4. 훅 목록 (인용한 줄, 모두 `if (D.active)` 분기)

| 파일:줄 | 지금 코드 | R2 |
|---|---|---|
| `fighter.js:716` | `this.skill.update(dt);` | 다음 줄에 `this.drive?.plan(dt);` |
| `fighter.js:637-649` | `follow('pelvisYaw', …)` ×2, `follow('chestYaw', …)`, `follow('pitch', …)`, `follow('drop', …)` | `D.trunkCmd(bp, bv, key, target)` 로 대체(활성 시) |
| `fighter.js:634-635` | `const lim = COMMIT.pelvisRate * (Math.PI / 180) * dt; const hr = COMMIT.hipRoom;` | S = 0 분기에만 |
| `fighter.js:1321-1324` | `raw.jointConfigureMotorPosition(this.uprightJoint.handle, ax, 0, BODY.uprightStiffness * assist * r, BODY.uprightDamping * assist * r);` | yaw 축(`MOTOR_AXES[2]`)만 `jointConfigureMotor(…, θ 0, ω_cmd, k·(1−relax·S), d)` |
| `fighter.js:1542` | `const twist = THREE.MathUtils.clamp(chestYaw - (this.state === 'stand' ? bp.pelvisYaw : 0), -0.8, 0.8);` | 자르기 ±0.95, twist = lerp(·, −xFactor, S), 옆굽힘 |
| `fighter.js:1544-1545` | `spine('abdomen', bend * 0.5, twist * 0.45); spine('chest', bend * 0.5, twist * 0.55);` | + `rateDes`, + τ_ff addTorque 쌍 |
| `fighter.js:1591`, `1596` | `clamp((_rv.z - prev.z) * inv, -15, 15)` / `clamp((_rv[ax] - prev[ax]) * inv, -15, 15)` | `D.active ? clamp(rateDes ?? diff, ±40) : 기존` |
| `fighter.js:1660` | `if (wT.length() > 20) wT.setLength(20);` | `wT = omegaDes`, 40 |
| `fighter.js:1664-1665` | `_mT.copy(_mE)…multiplyScalar(k); const wErr = _mW.sub(wT);` | k·d 에 공동수축, `+ ffGain·I_arm·α_des` (cap 1676-1677 앞) |
| `fighter.js:1719` | `handLocal.x = Math.min(handLocal.x, this.closeReach());` | 팔 몫에만(그대로), 클립 몫은 안 자름 |
| `fighter.js:1721` | `const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));` | `qHand = slerp(this.yaw, qChestCmd, S)`, hand = lerp(arm, clip+warp, S) |
| `fighter.js:1746`, `1751`, `1771` | `aim.applyQuaternion(this.yaw);` / `if (wAim.length() > 25) wAim.setLength(25);`(R0 가 바꿈) / `RIGHT_LOCAL.clone().applyQuaternion(this.yaw)` | `qHand`; wAim = 클립 미분 |
| `fighter.js:1931`, `1938` | `const S = _ik2.set(0, 0.1, this.side * 0.2);` / `const pole = _ik3.set(-0.25, -1, this.side * 0.5).normalize();` | `+ girdle·S`, `poleUsed` (이력) |
| `fighter.js:2012`, `2018` | 빈팔 어깨·pole | `girdleO`, `poleO` 이력 |
| `fighter.js:349`, `353` | `joint.setLimits(jd.lim[0], jd.lim[1]);` / `raw.jointSetLimits(joint.handle, MOTOR_AXES[i], jd.lim[ax][0], jd.lim[ax][1]);` | `DRIVE.on` 이면 넓힌 표(abdomen y ±0.55, chest y ±0.7, thigh y ±1.1) |
| `skill.js:405` | `if (WHOLE.on && WHOLE.commit && this.detect && this.trace) this.detectCommit(dt);` | `&& !GESTURE.on` 추가; 그 앞에 `this.gesture?.update(dt, tStep)` |
| `skill.js:399`, `462` | `if (off.length() > R) off.setLength(R);` / `if (this.aimRaw.length() > R) this.aimRaw.setLength(R);` | 그대로(팔 몫). gesture 는 trace 좌표 |
| `skill.js:529` | `if (f.move.y > -0.2 && !this.holdFeet && !(prog && !COMMIT.armLunge) && …) f.move.y = …` | `&& !(f.gesture?.S > 0.3)` |
| `gait.js:1039-1047` | `let ye = wrap(l.yaw - l.footYaw); … _f.y = clamp(GAIT.pinYawK * ye - GAIT.pinYawD * w.y, -lt, lt);` | 앞에 `l.yaw` 를 `pivot.yaw` 로 rate 이동 |
| `gait.js:798-801` | `const heel = Math.max(0, this.heelOff(l, _h, _a, legLen(l.phi)) - GAIT.heelDead); l.heel += (heel - l.heel) * 0.3;` | `max(heel, l.pivot.lift)` |
| `gait.js:711-714` | `l.yaw1 = pel + clamp(wrap(l.yaw1 - pel), -GAIT.swingTwist, GAIT.swingTwist);` | `D.active ? DRIVE.swingTwist : GAIT.swingTwist` |
| `gait.js:222-228` | `duration: clamp(o.duration ?? 0.4, 0.28, 0.7)` | kind 'strike' 면 아래 0.2 |
| `ai.js:1277-1280` | `off.x += (dx / dd) * step; … off.set(tx, ty);` | `GESTURE.ai` 면 `me.aiTrace.push(t, Δx, Δy)` (§2-9) |
| `main.js:1298-1300` | `ai.update(dt); player.step(dt); enemy.step(dt);` | 변경 없음(drive 는 `step` 안) |

### 2-5. 설정 손잡이와 첫 값 (`config.js` 새 블록; 값은 설계서 §9)

```js
export const GESTURE = {
  on: true, legacyCommit: false, ai: false,
  sL0: 0.12, sL1: 0.55, padExt: 1.0, restV: 0.25, restT: 0.04, vStrike: 1.5, reverseDot: -0.3,
  kStroke: 0.4 /* Q3 */, strokeL0: 0.35, strokeL1: 0.9, lateSelect: 0.07, predictMs: 8,
  T0: { longsword: 0.30, zweihander: 0.38, saber: 0.24, default: 0.30 }, kv: 0.35, phiW: 60, leadMs: 40, fallTau: 0.25,
};
export const ATLAS = {
  dir: 'src/strike/clips', format: 'stillness-motion-clip/2', dPhi: 0.01, sizeMid: 0.5, startPoseTol: 0.02,
  families: { diagR: ['zornhau', 'right'], diagL: ['zornhau', 'left'], vert: ['oberhau', 'right'], vertL: ['oberhau', 'left'],
              horizR: ['mittelhau', 'right'], horizL: ['mittelhau', 'left'], riseR: ['unterhau', 'right'], riseL: ['unterhau', 'left'] },
};
export const DRIVE = {
  on: true, trunk: true, hands: true, ff: true, feet: true, step: true /* Q7 */, puppet: false,
  ffGain: 0.8, motorRate: 40, coContract: 0.5, anchorYawRelax: 0.5 /* R4: 0.7~0.9 창 */,
  spineTwist: 0.95, limAbdomen: 0.55, limChest: 0.7, hipTwist: 1.1, hipRoom: 1.1 /* Q5 */, swingTwist: 1.0 /* Q5 */,
  softLimit: 0.15, softK: 400, softD: 20, girdleMax: 0.06,
  poleAdopt: 60 * D2R, poleRevert: 30 * D2R, poleRate: 6, poleBlendMs: 60,
  warpMax: 0.25, stepMinS: 0.3, stepFwd: 0.5, stepDurMin: 0.2, footYawRate: 8,
};
```
R0 와 겹치는 것(`STRIKE.wristRel` 60, `INPUT.coalesce`, `RENDER.interp`)은 R0 값을 쓴다. `COMMIT.*` 는 `GESTURE.legacyCommit` 일 때만 읽힌다.

### 2-6. 안정성 (60 Hz / 120 Hz)

**엔진 모터(암시적)**: Rapier 0.19.3 `ImpulseJoint` 모터(모델 1 = ForceBased)는 속도 솔버 안에서 constraint 로 풀린다 → k, d, dt 에 대해 무조건 안정. 척추·엉덩이·팔꿈치·빈팔·닻이 여기 속한다. 이득을 올려도 폭주하지 않고, 반복 횟수(코드 주석 6회) 안에서 **수렴이 덜 될** 뿐이다(배에 관성 0.4 를 더한 까닭). 목표속도 클램프 15→40 은 안정성과 무관(추적 항의 크기만). 넓힌 hard 한계도 constraint 라 안정.

**명시적 항** (반암시적 Euler: 토크 → 속도 → 위치). 조건: ω_n·dt ≤ 1 (권장 ≤ 0.5), c·dt/I < 2 (권장 ≤ 1).

| 항 | k, c, I | 60 Hz: ω_n·dt / c·dt/I | 120 Hz |
|---|---|---|---|
| 어깨 manualMuscle 휘두름 (지금) | 320, 26, I_arm 1.3 (칼 있음) | 0.26 / 0.33 | 0.13 / 0.17 |
| 어깨 공동수축 S = 1 | 480, 39, 1.3 | 0.32 / 0.50 | 0.16 / 0.25 |
| 어깨 칼 없이 (S 는 armed 필수라 공동수축 없음) | 320, 26, 0.39 | 0.48 / **1.1** (지금도 그렇다; 부호 번갈이지만 감쇠) | 0.24 / 0.55 |
| 어깨 비틀기 축 | 25, 0.8, 0.007 | **1.0** / 1.9 (지금도 한계 — 그래서 공동수축 제외) | 0.5 / 0.95 |
| 손목 aim PD (R2 변경 없음) | 60, 11, swordIhand 0.27 | 0.25 / 0.68 | 0.12 / 0.34 |
| 빈손 스프링 (R2 변경 없음) | 1500 N/m, 50, μ 0.81 kg | 0.72 / 1.03 | 0.36 / 0.51 |
| soft limit (새) | 400, 20, abdomen 0.51 | 0.47 / 0.65 | 0.23 / 0.33 |
| follow() 2차 필터 (S = 0 만) | w 34 → 2w·dt | 1.13 (부호 번갈이, 지금과 같음) | 0.57 |
| φ 필터 ω 60 (새) | explicit 라면 2ω·dt = 2.0 → 불안정 경계 | **정확 이산화**로 무조건 안정 | — |

- τ_ff 는 되먹임이 없어 안정성에 들어가지 않는다. 크기는 클립 스플라인 2차 도함수 × φ̇² 로 매끄럽고, φ̈ 는 φ 필터의 ω²·(φ_f − φ_b) 로 유계, 최종 `|τ_ff| ≤ j.max·mus` 로 잘린다.
- 되먹임 고리 하나: 명령 가슴 틀을 **명령값**으로 쓰는 것이 유일한 방벽이다. 잰 가슴을 쓰면 손 → 어깨 반작용 → 가슴 → 손 고리가 60 Hz 에서 한 스텝 지연으로 진동한다(설계서 §2-2(3)(b)).
- 60 대 120: φ 는 이벤트 시각으로 적분되고(R0 `at(t)`), 표본은 스텝 시각에서 스플라인 값이라 두 Hz 에서 같은 명령이 나온다. 차이는 물리 적분뿐 → 칼끝 ±3% 관문(§3-3)을 chain.mjs 로 매번 잰다. 30 fps 낙하(한 프레임 4 스텝)도 φ 가 시각 기반이라 빠르기가 유지된다.

### 2-7. 에너지 길 — R2 에서 이미 몸통 각운동량이 칼로 가는 경로

1. **가슴 틀 손**: v_hand(월드) = v_chest + ω_chest × r_hand/chest + v_hand/chest. 큰 Zornhau 가슴 −11 rad/s, r ≈ 0.5 m → 5.5 m/s 가 실린다. 클립 가슴 틀 손 4~9 m/s 를 팔이 그대로 내면 손은 월드 10~14 m/s(지금 4~6). 설계서 §1-1 이 잰 1.17~1.38배는 이 항이다.
2. **골반→가슴**: 닻 목표속도 덕에 골반이 5 rad/s 에 이르고(지금 2.3), 척추 모터 목표속도+τ_ff 로 가슴이 골반 위에 X-factor 를 얹는다(감기 끝 xFactor 45° 가 풀리며 골반보다 늦게 최고: 클립 −129 → −79 ms). 지금 버려지던 닻 감쇠 손실 P = d·ω² 이 사라진다.
3. **가슴→팔**: φ 0.6~1.0 에서 클립이 가슴을 감속(α ≈ +66 rad/s²)하고 τ_ff 가 이를 앞먹임한다. 어깨 근육은 작용·반작용이라(`manualMuscle` 마지막 두 줄: child +τ, parent −τ) 가슴을 세우는 토크가 곧 팔·칼을 앞으로 미는 토크다: ΔL_trunk = −ΔL_arm. I_up·Δω ≈ 1.5 × 5 = 7.5 kg·m²/s 가 팔+칼(I ≈ 1.3)로 넘어가면 팔 각속도 +5.8 rad/s. R2 는 이 넘김을 클립 시간표와 τ_ff 로 **명령**하고, 손목은 아직 PD 라 칼은 손을 따라오는 진자다.
4. **팔→칼(R3)**: 늦은 손목 풀기·지렛대·몸 결합 항은 R3. R2 가 남기는 것은 계측: `drive.debug` 에 `L_trunk = I_up·ω_chest`, `L_arm`, `P_anchor = d·ω_rel²`(닻이 버린 일률), 사슬 최고 시각(골반·가슴·어깨·손·칼끝) — chain.mjs 가 record/1 에 적는다. R3 의 운동량 지키기(J = √(2·mEff·E) 를 `takeJolt` 경로로, `combat.js:155-159`) 는 이 값을 기준으로 맞춘다.

### 2-8. 넘어짐 위험과 R4 로 넘기는 것

- **R2 가 손대지 않는 것**: `updateFooting` capture point·`offBalance`·`stumble`·`fallRange/fallDelay` (`fighter.js:1334-1402`), 닻 pitch/roll 축, `driveBalance` 이동 서보 `maxAccel`, `updateSupport`. 넘어짐은 지금 균형 물리로만 생긴다(Q24).
- **새로 생기는 위험과 R2 안의 완화**
  1. 골반·가슴 각가속의 반작용이 발 마찰로 간다 → 발 미끄러짐. 완화: 발 pin yaw 목표가 클립을 따라 돌아 마찰이 회전을 돕고, 뒤꿈치 들림이 축을 앞꿈치로 옮긴다. 남는 미끄러짐은 `plantAt` 이 다시 딛는다(`gait.js:349-352` slipReset).
  2. 무게중심 이동: 클립 `com` 이 지나는 걸음과 함께 0.3 m 앞으로 간다. 걸음이 없으면(Q7 아니오) 숙임 20° 만으로 ≈ 0.1 m → capture point 가 지탱면 밖이면 기존 stumble 걸음. 이것이 곧 헛침의 쏠림이고 R4 가 `capturePad` 0.04 로 조정.
  3. 닻 yaw 강성 풀림(0.5·S)으로 골반 yaw 가 목표를 지나칠 수 있다 → 이것은 의도(반동)이며 기울기 축은 그대로라 넘어짐으로 직결되지 않는다.
  4. hipTwist 1.1 · 발 돌림 1.0 → 크게 돈 순간 지탱도가 낮다(Q5 허점).
- **켜는 순서와 측정**: `DRIVE.trunk → hands → ff → feet → step` 을 하나씩 켜며 AI 대 AI 10분(60/120 Hz, 세 무기)에서 넘어짐 비율·NaN·튐(R0 glitchFilter 카운트)을 기록한다. 관문은 "기준선 대비 보고"이지 한도가 아니다.

### 2-9. AI 훅 (R5 `planStrike` 를 위한 자리)

- `Gesture` 는 어떤 `FingerTrace` 든 읽는다. R2: `ai.js` 에 `me.aiTrace = new FingerTrace()`; `GESTURE.ai` 가 켜지면 `moveHand` (`ai.js:1256-1281`) 가 `off` 를 옮긴 Δ를 `aiTrace.push(nowMs, Δx, Δy)` 하고 `me.gesture = new Gesture(me, { trace: me.aiTrace })`. 기본 false 라 AI 는 R2 에서 그대로 자세표 경로(`startStrike` `t.path`, `ai.js:865-904`)를 쓴다.
- R5 가 할 일은 `tech.path` 앞에 감기 점(원판 밖 padExt 까지)을 넣는 `planStrike`(새 함수; 지금 코드에 그 이름은 없다 — `startAttack`/`startStrike` 가 그 자리)와 `opportunity()` (`ai.js:666-704`) 의 windup/overrun 신호, `seize()` (`706-719`) 의 관성 거리다. R2 는 `fighter.gesture`·`drive.debug` 를 읽기 전용으로 노출만 한다(AI 는 S 를 훔쳐보지 않는다 — 설계서 §5-2).

---

## 3. S = 0 불변 논증

1. **분기 구조**: 모든 훅은 `if (D.active) … else <기존 줄 그대로>` 다. `D.active` 는 `gesture.S > 0` 이 필요조건이고, S = 0 이면 `plan()` 이 `active = false` 로 끝나 어떤 값도 쓰지 않는다. 클램프 15/20 → 40 도 활성 분기에만 있다.
2. **detectCommit 우회**: `GESTURE.on` 이면 플레이어의 `detectCommit` 이 불리지 않아 `cutPose.w = wBody = 0`, `commit.on = false` → `updateBodyPose` 는 `else` 분기(`fighter.js:645-649`), `driveSword` 는 `cp.w = 0` — 이것은 `WHOLE.commit = false` 팔 베기와 같은 경로다. 유일한 차이 `pf = 0.5 + allSwingPelvis·act` (`622`) 는 S 와 무관한 현재 동작이라 그대로다.
3. **관절 한계 넓힘의 영향 없음**: 팔 베기 척추 목표는 자르기 ±0.8 × 0.45/0.55 = 배 ±0.36 / 가슴 ±0.44 로 옛 hard 한계 ±0.5/±0.6 안이었다. 넓혀도 목표가 같으니 궤적이 같다. 엉덩이 y 한계 0.9→1.1 도 `limitTurn`(`GAIT.maxTwist` 0.9, 변경 없음)이 heading 회전을 먼저 막아 닿지 않는다. soft limit 토크는 활성 분기에서만 건다.
4. **입력**: `skill.js:399`, `462` 원판 클램프, 가죽끈, 24/14 rad/s 필터, `closeReach`, SIGMA2 — 모두 팔 몫에 그대로. gesture 는 trace 를 자기 좌표로 적분해 `handOffset` 을 건드리지 않는다.
5. **검증**: `tools/sim/r2_gates.mjs --s0` 가 R1 기준선(태그)과 같은 시드·입력(`harness_m.feedTrace`)으로 팔 베기 6종을 돌려 손·칼끝 궤적 차 max ≤ 0.02 m, 칼끝·에너지 ±2~3%(R0 관문과 같은 식)를 확인한다. `GESTURE.on = false && DRIVE.on = false` 면 바이트 단위 동일해야 하며, 이것은 diff 로 본다(새 파일 import 와 `if` 한 줄 외 변경 없음).
6. 바뀌는 것은 R1 의 의도된 지연 개선(aimLead, holdSpeed 0.6, SIGMA2 0.12² — Q17)뿐이며 그것은 R1 의 몫이다.

---

## 4. 꼭두각시 모드와 관문

**꼭두각시(`DRIVE.puppet = true`, 시뮬 전용)**: 물리로 따라가기 전에 옮기기가 맞는지 본다.
- `plan()` 뒤 `puppetPose()` 가 모든 부위를 `setBodyType(KinematicPositionBased)` 로 두고 순운동학으로 놓는다: 골반 = (heading + pelvisYawCmd, drop), 배·가슴 = 척추 목표(`spine()` 과 같은 식), 팔 = `solveArmIK` 결과 쿼터니언, 칼 = 손 + `sword` 방향, 빈팔 = `offArmIK`, 다리 = `legIK` 목표. 스텝마다 `world.step` 은 돈다(접촉·판정 없이).
- 측정: 손 = farmS 로컬 (0.13, 0, 0) 월드 자리 vs 클립 `handS` 를 명령 가슴 틀로 옮긴 자리; 칼 방향 각; 골반·가슴 yaw. 도구 `tools/sim/puppet.mjs` (harness_m `newRound`, 입력 없이 φ 를 −1→1.6, S ∈ {0, 0.5, 1}, 4 무리 × 좌우, 60/120 Hz).
- **관문(설계서 §8 R2 행, §2-6)**: 꼭두각시 손 오차 **≤ 0.03 m**(최대, 전 φ), 칼 방향 ≤ 5°. S = 0 에서는 작은 벌 = 자세표이므로 `startPose.handError` 0 과 일치해야 하고, 이것이 곧 S = 0 ±2 cm 의 운동학 반쪽이다.

**물리 추적 관문 (`tools/sim/r2_gates.mjs`, chain.mjs 위에)** — 모두 아래 문턱, 위 한도 없음
| 항목 | 관문 | 출처 |
|---|---|---|
| 꼭두각시 손 오차 | ≤ 0.03 m | §8 R2 |
| 추적 오차(시간 정렬 뒤 손 평균) / 칼 방향 | ≤ 0.08 m / ≤ 15° | §8 R2, §2-6 |
| S = 0 동작 | 지금 ±2 cm | §8 |
| 감기 반응: 끌기 시작 → 골반·가슴 5° | ≤ 33 ms (60 Hz) / 25 ms (120 Hz) | §3-3 |
| 감기 손 높이 / 앞뒤 / 어깨 들림 | ≥ 머리 +0.10 m (targets.md: 머리 위 베기 ≥ +0.05) / ≥ 0.08 m 뒤 / ≥ 100° | §2-6, targets.md |
| 지나가기 손 옆 거리 | −0.35 m 너머 (targets.md: 사선 −0.30, 가로 −0.33; 게임 팔 0.565 m) | §2-6 |
| 가슴 / 골반 회전 범위, X-factor | ≥ 130° (targets ≥ 120°) / ≥ 70° (≥ 65°) / 순서(감기 끝 xFactor > 0, 골반 먼저 풀림) | §2-6 |
| 손 이동 길이 | ≥ 1.8 m | §2-6 |
| 60 vs 120 Hz 칼끝 | ±3% | §3-3 |
| 떨림: 3 mm·8 Hz 손가락 | 손 떨림 ≤ 지금 | §3-3 |
| 쟁기 긋기 오분류 → 온몸 | ≤ 3% | §3-3 |
| 성능 | 추적 스텝 ≤ 0.05 ms, 보통 스텝 CPU ≤ +5~10% | §6-9 |
| 안정성 | AI 대 AI 10분 × 60/120 Hz × 세 무기: NaN 0, 튐(R0 glitch 카운트) 보고, 넘어짐 비율 보고 | §8 |
| 비교 뷰어 | `tools/motion/viewer.html` 에 게임 기록(record/1) 겹친 화면을 사장님께 | §8 R2 |

빠르기·에너지 비(≥ 1.45배, ≥ 2배)는 R3 관문이지만 R2 도 chain.mjs 로 매 라운드 **보고**한다(전진 확인).

---

## 5. 위험과 완화

| 위험 | 완화 |
|---|---|
| 골반 구동기가 닻뿐이라 yaw 강성 풀림이 추적을 약하게 함 | 목표속도 항이 주 구동. relax 0.5 로 시작, `debug.pelvisLag` 로 지연 측정, R4 창에서만 올림 |
| 어깨 80 N·m 포화로 손이 클립보다 늦음(큰 벌) | 설계 의도(물리가 정한다). `handErr`·지연을 재고 Q4 로 보고. 겨냥 휘기 0.25 m 가 헛나감을 줄임 |
| pole 뒤집힘(팔꿈치가 안→밖) | 이력(60°/30°)·60 ms 넘김. 꼭두각시에서 φ 전 구간 검사 |
| 크기 섞기 중간에서 손목 각 165° 넘음 | 두 구간 섞기(small↔medium↔large); `ang.wrist` 를 관찰로 기록 |
| 발 pin 이 돌림에 저항해 골반이 못 돎 | pin yaw 목표를 클립으로 이동(마찰이 돕는 쪽), 뒤꿈치 들림; 그래도 부족하면 관찰 보고(hipTwist 1.1 안전판) |
| 60 Hz 에서 φ 필터·soft limit 진동 | 정확 이산화, 표 §2-6 조건 준수, 두 Hz 항상 함께 시험 |
| 명령 가슴 틀과 실제 가슴이 크게 어긋나면 손이 몸을 뚫음 | `chestLag` > 25° 면 손 목표를 실제·명령 사이로 되돌리는 게 아니라 **팔꿈치 pole·어깨띠**만 실제 쪽으로(되먹임 고리 회피). 칼↔몸 판정은 R0 sweep |
| 지나는 걸음이 조이스틱과 겹침 | S > 0.3 이면 armLunge 끔; 물러나는 중(`move.y < −0.1`)엔 `requestStep` 이 거절(기존) → 걸음 없이 상체만 — 그 결과는 쏠림(R4) |
| 클립 형식이 바뀜 | 로더가 format 불일치에 throw; `sync_clips.mjs` 해시로 갱신 감지 |
| S = 0 회귀 | §3 의 gates --s0 를 CI 처럼 매 커밋 |
| CPU | 스텝당 표본 0.01 + IK×3 0.005 + 관성 합 0.005 ms; 목표 0.05 안. `perf_ab.mjs` 로 잰다 |

---

## 6. 한도처럼 작동할 수 있는 값 → 사장님 질문

| 값 | 어디 | 성격 | Q |
|---|---|---|---|
| `GESTURE.kStroke` 0.4 (감기 없는 큰 긋기의 S 상한) | gesture | S 의 위 한도 | **Q3** |
| `GESTURE.sL1` 0.55 (S_wind 가 1 이 되는 끌기 길이) | gesture | 그 너머 끌기는 더 커지지 않음 — 원판 밖 padExt 1.0 까지 끌 수 있지만 S 는 포화 | Q3·Q21 (끌기 길이·화면 가장자리) |
| `GESTURE.fallTau` 0.25 (감기 유지) | gesture | 감기를 공짜로 들고 거둠 | Q2 |
| 근력 한도 어깨·팔꿈치 80, 손목 22 N·m, hill Vmax (그대로) + τ_ff 를 같은 한도로 자름 | manualMuscle, driveJoints, driveSword | 빠르기의 생리 한도 | **Q4** |
| `DRIVE.hipTwist`·`hipRoom` 1.1, `swingTwist` 1.0, `spineTwist` 0.95, 배·가슴 ±0.55/±0.7, soft limit 0.15 | 관절 한계 | 크기 한도(사람 범위) | **Q5** |
| `DRIVE.anchorYawRelax` 0.5 | 닻 | 반동 크기 손잡이(한도 아님) | Q24 (R4) |
| `DRIVE.motorRate` 40 rad/s, `STRIKE.wristRel` 60 rad/s (R0) | 모터 목표속도·손목 | 물리 보호값; 앞먹임이 여기서 막히면 조용히 느려짐 | **Q22** (손목), 모터 40 은 클립 최대 관절 각속도(어깨 29.5, 손목 27.1 rad/s)의 1.4배 — 넘으면 `debug.rateClip` 카운트로 보고 |
| `GRIP` 빈손 스프링 브레이크 (R2 그대로) | offHand | −15~−60 J | Q6 (R3) |
| `DRIVE.step` 지나는 걸음, `stepFwd` 0.5, `requestStep` duration 아래 한도 0.28→0.2('strike'), `GAIT.swingVmax` 6 m/s(기존) | gait | 하체 몫·조이스틱 무관 전진 | **Q7** |
| `DRIVE.warpMax` 0.25 m | 손 | 겨냥 조정 손잡이(한도 아님) | — (설계서 §2-2(3)(b)) |
| `DRIVE.poleRate` 6 rad/s, `footYawRate` 8 rad/s | IK pole, 발 pin | 시각·마찰 목표의 부드러움; 칼 빠르기와 무관. 클립 발 돌림 최고 ≈ 3 rad/s 라 닿지 않음 | 보고만 |
| `GESTURE.T0` 0.30/0.38/0.24, `kv` 0.35 | φ̇ | 아래 한도(최소 빠르기), 위 한도 없음 | — |
| `GESTURE.leadMs` 40·S | φ_body | 몸이 손가락을 앞서는 정도 | Q1 (그만두기와 맞물림, R4) |
| φ 가 손가락을 멈춰도 1/T0 로 계속 감 | gesture | 그만두기 대가 | **Q1** (R4 제동 brake0/brakeK) |
| `COMMIT.tcFloorOn/tipMax` | 삭제 대상(설계서 §0-1) | 위 한도 — R2 에서 제거 | — |
| 지탱도로 S 줄이기 | 넣지 않음 | | Q25 |
| 한손 무기 클립 크기 | R6 | | Q26 |
| AI 최소 감기 시간 | R5 | | Q8 |

새 질문은 필요 없다. 다만 Q7 아래에 "'strike' 걸음의 발 드는 시간 아래 한도를 0.28 → 0.2 s 로 낮춘다(클립 0.24 s)"를 덧붙여 알린다.

---

## 7. 작업 나누기 (워크트리 5개, 파일 경계)

| # | 작업 | 파일(쓰기) | 읽기만 | 산출·관문 |
|---|---|---|---|---|
| **W1 atlas** | `src/strike/atlas.js`(로더·검증·표본·미분), `tools/strike/sync_clips.mjs`, `src/strike/clips/*`, `config.js` ATLAS, `tools/sim/atlas_check.mjs` | `docs/motion/clip_format.md`, clips | 형식 불일치 throw 시험; 48 벌 검증 통과; 표본 0.01 ms; S=0 startPose 0 |
| **W2 gesture** | `src/strike/gesture.js`, `config.js` GESTURE, `skill.js` 2줄(`405` 앞 update·조건), `tools/sim/gesture_probe.mjs` | `input.js` FingerTrace, R0 `at(t)` | 감기 반응 ≤ 33/25 ms(φ 기준), 쟁기 오분류 ≤ 3%, 떨림 시험, lateSelect 정확도 |
| **W3 drive-trunk** | `src/strike/drive.js`(plan·trunkCmd·anchorYaw·spineTargets·soft limit·footPivot·puppetPose), `fighter.js` {`605-651`, `1310-1324`, `1540-1546`, `1591/1596`, `349/353`, `716`}, `gait.js` {`798-801`, `1039-1047`, `711-714`}, `config.js` DRIVE, `tools/sim/puppet.mjs` | W1 API | 꼭두각시 ≤ 0.03 m(몸통·다리 부분), 골반 5° ≤ 33 ms, 가슴·골반 범위, 60/120 안정 |
| **W4 drive-hands** | `drive.js`(handFrame·ikParams·jointRates·warp), `fighter.js` {`1658-1665`, `1696-1721`, `1733-1751`, `1771`, `1925-1957`, `2006-2035`} (`armIK` 를 `solveArmIK` 로 분리) | W3 의 `cmd` 인터페이스(§2-3 Export) | 꼭두각시 손 ≤ 0.03 m(전 φ), 추적 ≤ 0.08 m, 감기 높이·뒤·어깨 들림, 지나가기 옆 거리, 손 길 |
| **W5 step·AI·gates** | `gait.js` {`222-228`}, `skill.js:529`, `ai.js`(aiTrace, `1277-1280`), `tools/sim/chain.mjs` 확장(debug 채널·사슬 시각), `tools/sim/r2_gates.mjs`, 비교 뷰어용 record 내보내기 | W3·W4 | 딛기 φc ±50 ms, S=0 --s0 회귀, AI 대 AI 10분 표, 뷰어 화면 |

**순서**: W1 ‖ W2 (독립, 1~2일) → W3 (W1 의 `sample` 만 필요; W2 는 `fighter.gesture` 스텁으로 대체 가능) → W4 (W3 가 `cmd` 를 채운 뒤; `fighter.js` 안에서 함수가 겹치지 않아 병합 충돌 없음) → W5. 각 워크트리는 자기 `tools/sim/*` 관문을 통과한 뒤 `wbs-impl` 에 합치고, 합친 뒤 W5 의 `r2_gates.mjs` 전체와 `--s0` 를 60/120 Hz 로 다시 돈다.
