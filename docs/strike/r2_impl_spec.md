> 한국어 요약: 온몸 타격 R2(손짓 층·클립 아틀라스·클립 추적)의 구현 명세. 세 관점(조작·물리·동작) 설계를 심사·통합·비판해 만든 최종본이며, 사장님 결정(docs/decisions.md 9/29: Q1 물리로만, Q3 상한 없음·시작 자세 호 길이 + 손가락 긋기 길이·빠르기, 입력 방식 (A) 손가락 위치 감기 / (B) 긋기만, Q5 허용, Q26 물리)을 반영했다. 기준 코드는 wbs-impl bcf1fb1. 작업 항목은 r2_workitems.json (W1 아틀라스 → W2 손짓 → W3 몸통·다리·꼭두각시 → W4 팔 → W5 관문·시험판). 10장은 상한처럼 작동할 수 있는 모든 값과 사장님 질문의 대응표, 11장은 동작 연구 PM에게 확인을 부탁할 것이다.

# R2 implementation spec — gesture layer, clip atlas, clip tracking (final synthesis)

- Baseline code: worktree `/home/user/hs-wbs`, branch `wbs-impl` @ `bcf1fb1`. Every `file:line` below was re-read at that commit and the quoted code string is given next to it so the hook can be found again after R0/R1 shift the lines.
- Built on R0 (assumed merged before R2 starts): `STRIKE.gripMu`, `STRIKE.glitchFilter` (30 m/s discard gone), `STRIKE.sweep`, `STRIKE.wristRel` (forearm-relative 60 rad/s replaces `fighter.js:1751 if (wAim.length() > 25) wAim.setLength(25);`), `RENDER.interp`, `FEEL.logScale`, `INPUT.coalesce` + `fingerTrace.at(t)`, `tools/sim/chain.mjs` emitting `stillness-motion-record/1`. If R0's `at(t)` signature differs from §3.2, only `readFinger()` in gesture.js changes.
- Reference: `docs/whole_body_redesign.md` §0–§5, §7-2, §8 (R2 row), §9, §10; `docs/motion/clip_format.md` (clip/2), `README.md`, `targets.md`, `spec_table.md` §7; clips `docs/motion/clips/*.json` + `index.json` (52 clips, `stillness-motion-index/1`).
- Skeleton = design_control (winner). Grafted: motion's coordinate table, packed atlas, cut-start carry-over, recoverTo→homePad, step-data blend, puppet FK/IK gate, S-linear limit forms, toe-pivot lever; physics' controller inventory, stability table, `solveArmIK` refactor for ω/α feed-forward, τ_ff sizing and capping, staged enable order, minimal AI seam, exact discretisation of the φ filter. Every judge mustFix is resolved in §1.
- Hard rules: no new cap/limit/floor on speed, power, size, frequency or time. Everything that could act as one is in §10 against Q1–Q26 (no new Q). No difficulty tuning. Wrist late release, off-hand lever, body-coupling energy, momentum bookkeeping = R3; recoil = R4; openings/AI behaviour = R5.
- **Owner answers already given** (`docs/decisions.md` 2026-09-29 13:00) override the doc's pending defaults wherever they differ: **Q1** stopping costs are physics only, no separate time/brake values; **Q3** no cap on no-wind strokes, S from the start pose's arc plus stroke length *and* speed, and the R2 test build carries two input modes behind a switch, (A) wind by finger position (default) and (B) big cut from stroke length/speed only with a short automatic body wind; **Q5** allow; **Q26** physics decides. §1.1 lists how this revision applies them.

---

## 1. Decisions (judge mustFix → resolution)

| # | Issue | Resolution in this spec |
|---|---|---|
| 1 | Anchor yaw semantics | Keep `jointConfigureMotorPosition` (position motor; the kinematic anchor already rotates with `pelvisYawOffset`, so its damping is a rate servo toward the commanded pelvis rate — probe `judge2/anchor_probe.mjs`: body tracks a 3 rad/s anchor with no brake). R2 relaxes **stiffness only** on the yaw axis: `k × (1 − anchorRelaxYawK·S)`, `anchorRelaxYawK 0.9` (doc §2-2 (3)(a)); damping untouched (`anchorRelaxYawD 0`, R4 owns `trunkDampRelax`). No `targetVel` on the anchor (would double-count). Yaw axis = `MOTOR_AXES[2]` (AngZ) — verified by `judge2/axis_probe.mjs` (probe-based); `fighter.js:1201 const min = ax === MOTOR_AXES[2] ? RECOIL.anchorYaw : RECOIL.anchorPitch;` uses the same slot, `MOTOR_AXES = [3, 4, 5]` is defined at `fighter.js:2293`. |
| 2 | Girdle applied to IK root only (≤ 0.06 m hand miss) | **R2 default `DRIVE.girdle: 'off'`**: IK root stays at the physical shoulder `(0, 0.1, ±0.2)`, hand target = full clip hand in the commanded chest frame. Justified by the reach report (§4.6): every medium/large `handS` is within the game arm 0.565 m of the fixed shoulder except scheitelhau tc (+0.5 cm, reserved cut). Girdle channels are loaded, reported (`stats.girdleMax`) and available behind `DRIVE.girdle: 'anchor'` (moves `uarmS` joint anchor with `ImpulseJoint.setAnchor1` + IK root by the same vector, rate 0.5 m/s, only while S > 0, restored once) — an experiment after the puppet gate passes, never the R2 default. Puppet gate measures the hand from the **physical** wrist point (`farmS` local `(0.13, 0, 0)` = `game_joints.mjs ANCHORS.hS`). |
| 3 | Passing step data | `fwd = step.to[0] − step.from[0]` (zornhau large 0.78, medium 0.39), `side = step.to[1] − step.from[1]` (−0.03 / −0.015); blended by the two-segment rule with small = `{fwd 0, side 0, liftPhi 0.178, landPhi 0.833}` so fwd(S) rises from 0. `kind:'strike'` gets the lateral `guardWidth` offset like `'pass'` (`gait.js:687`), uses `x = r.fwd` exactly (no `Math.max(0.3, r.fwd − 0.1)`, `gait.js:686`), and has **no duration floor** (`gait.js:226` clamp skipped for `'strike'`; §1.1-M — the earlier `stepDurMin 0.15` bound above ≈ 4 m/s finger). The pre-existing floors are listed under Q7 (§10). The rear foot passes (`gait.js:411`); clip foot channels are mapped by **role** (stance/swing), not by anatomical side (§5.6). |
| 4 | Bundle size (raw clips ≈ 6 MB) | `tools/motion/pack_atlas.mjs` → `src/strike/clips/atlas_v0.json` (`stillness-atlas-pack/1`): 4 families × 2 sides × 3 sizes, driven channels only, resampled on the φ grid, Float32 base64 ≈ 1.4 MB; derivatives computed at load. Raw-clip loader for node tools. Both paths end in one `buildAtlas()`. |
| 5 | Size blend of directions | `sword`, `elbowPoleS/O` are **slerped** between sizes and between families (clip_format §4; small↔medium sword differs 75–90° at tw). Positions/angles lerp (yaw on unwrapped degrees). |
| 6 | φ jump at cut start | Motion's carry-over on the clip share: `clipEff(φ) = clip(φ,S) + [clip(φ_rev,S) − clip(0,S)]·(1 − sj(φ/carryPhi))`, `carryPhi 0.3` (directions: the residual rotation scaled by the same weight, `R(k·r)`, §5.2). No hand hitch; φ filter unchanged. |
| 7 | Hip τ_ff vs anchor, no pelvisLag plan | Feed-forward chain (§5.4) is complementary to the anchor: anchor `d 330` acts on relative rate to the commanded target, so with exact τ_ff the anchor torque is ≈ 0; too little → anchor supplies it, too much → anchor damps it. `drive.debug` records `pelvisLag`, `chestLag`, `tauAnchor`, `P_anchor` every step; W3 acceptance stages `ffGain 0 → 0.8` and `anchorRelaxYawK 0 → 0.9` against those channels and the fall counter. |
| 8 | Citation slips | Fixed: touch trace push `input.js:149` (mouse 138, lift 167); drop `fighter.js:649`; `gravityTorque` `fighter.js:1607`; `sj` `skill.js:53`; heel `gait.js:809-811`; req step lines `gait.js:685-687`; Rapier `dynamics/impulse_joint.d.ts:109`; no `this.f.now` exists → `fighter.stepT` (§2.3). |
| — | Additive delta rule (motion) rejected | Keep control's `lerp(guard(finger), clip(φ,S), S)`; the additive `guard + Δ` desynchronises whenever the finger leaves the small clip's timeline (judge example: hand never reaches the strike line). |
| — | Constructor-time limit widening (physics) rejected | Limits widened per step with `jointSetLimits` as `base + (wide − base)·S` only while S > 0, restored once when S → 0 (S = 0 never touches the engine). |
| — | No-wind stroke with hand channels (physics/motion) rejected → **superseded** by §1.1-B (Q3 answered) | The trunk-only rule is gone: hands join a no-wind stroke; the yank it guarded against is removed by starting the clip at `φ_align` (A) / `−autoWindPhi` (B) with the cut-start carry-over (§3.5). `handOnStroke false` remains only as a fallback behind W4's hand-hitch gate. |
| — | Node wheel on absolute pad angle (motion) rejected | Origin-relative bearing to the chamber pads with two neighbours (control). |
| — | Foot pivot additive to `l.yaw` (control) fixed | `l.yaw` is persistent slip state (`gait.js:769`, `1041-1044`); the drive moves it toward an absolute target `yawTD + Δclip·S`, re-based on every plant so there is no jump and no rate limit (§5.6). |

### 1.1 Second critique → resolution (all verified against `bcf1fb1`)

| # | Issue | Resolution |
|---|---|---|
| A | Q3 input modes (A)/(B) missing (`decisions.md` Q3 부연 13:40) | `GESTURE.input: 'wind' | 'stroke'` (§3.10). (A) `'wind'` = this spec's finger-position wind. (B) `'stroke'` = finger winds are ignored, S comes from the start-pose arc × stroke length × speed, the body performs a short automatic wind (clip φ starts at `−autoWindPhi`, finger-clocked). Both modes ship in the test build; `film_wholebody.cjs` and the gesture gate run both. |
| B | Q3 S for no-wind strokes had a 40 % ceiling and length only | `kStroke` removed. `Sstroke = arc0 · (strokeLen / Lref_f) · (v̄ / vRef)`, unclamped (`over` beyond 1), with `arc0` = the arc the start pose already has toward the family's end pad (§3.4). `handOnStroke` default **true** (hands join through `φ_align` + carry-over); `false` kept only as a fallback if W4's hand-hitch gate fails. |
| C | Q1 answered "physics only" but the command carried time values (1/T0 floor, S lock, FOLLOW input ignored) | `GESTURE.clock: 'finger'` (default): `φ̇ = kφ·max(0, v·dirC)`, `kφ = 1/sL1`, no floor; S holds while the finger moves along the stroke and decays (τ `tauRelease`, Q2's value) the moment it stops, lifts or reverses; no input is ignored (the 0.15 s ring is origin bookkeeping only); RECOVER freezes φ. The doc's `1/T0 + kv·v` law survives as `clock: 'floor'` for sims only (chain.mjs A/B), never in the build (§3.6, §10 Q1). `T0` loses its 1.3 inertia-class threshold. |
| D | S never reaches exact 0 (exponential decay) so restore / busy / identity never re-enter | `sSnap 0.02`: a decaying S below 0.02 is set to 0 exactly (a 2 % size-blend tail, invisible); every consumer keys on `S === 0`. `busy = state ∈ {CUT, FOLLOW}` (not S). Listed in §10 transparency. |
| E | S = 0 baseline `WHOLE.commit=false` differs by construction (`pf`, fighter.js:622, `COMMIT.allSwingPelvis` 0.15); stage A sets `cm.on` (skill.js:858) | Baseline = today's config (`GESTURE.on=false`, `WHOLE.commit=true`) for the `pf` identity, plus `COMMIT.minLevel=2` (canCommit false → `commit()` returns false → stage A never entered, `cm.on` never true) for the bit-identical run. §7 lists the three live `cm.on` consumers of stage A (combat.js:343/467/565) and shows `cutPlane` is not one (`cp.plane = 0` in stage A, skill.js:1047). |
| F | Elbow ω_des not wired | `vz = lerp((_rv.z − prev.z)·inv, ω_des_flex, S)` at fighter.js:1591 while S > 0, α_flex pair stays (§6.6). |
| G | `edge` channel dropped | `edge` kept in the pack and compared in the puppet report, **not driven** with a stated reason (§4.3): clip_format §3-6 says `edge` is derived from the tip velocity, i.e. the same quantity the game already forms from its own `hitPointVel` (fighter.js:1765-1783), and the game's measured value is the truer source; at slow wind the static `RIGHT_LOCAL` flat is correct for zornhut / vom Tag (flat sideways). `DRIVE.edgeFromClip false` is the hook if the motion PM ever authors `edge`. |
| H | `wAim` missed the commanded chest-frame rate | `wAim = lerp(diff, R(yaw·Qc_cmd)·(swordDot·φ̇) + ω_chestCmd, S)` with `ω_chestCmd` = yaw·(chestYawDot·ŷ + pitchDot·ẑ_lean + sideDot·x̂_side) in world (§6.2). |
| I | Puppet sign checks incomplete | `chest.side` (shoulder-line height sign vs clip `J shS/shO`) and `feet.*.yaw` (stance-foot Δ sign = pelvis Δ sign over tr→tc; rear-foot toe-out sign vs `GAIT.rearToe`) added to the gate; gate runs with `DRIVE.girdle` `'off'` **and** `'anchor'` (§8.1). |
| J | Atlas load timing | Pack decoded at module top in `main.js` right after `await RAPIER.init()` (`main.js:30`); `beginFight()` awaits it; `stats.atlasMissing` counts any S > 0 step without a drive (§3.8-9). Vite bundles the JSON, so the fetch is part of the initial load, not the fight path. |
| K | Kneel | `Gesture.bodyOk` requires `state === 'stand'` (anchor follows the pelvis command only when standing, fighter.js:1310; `requestStep` refuses kneel, gait.js:223); at kneel S folds to 0 and the arm cut is unchanged (§3.1, §10). |
| L | Hit-stop divergence | `main.js` publishes `player.inputScale = inScale` (0.25 during hit-stop) before the step loop; gesture integrates the trace with the same scale, skips `TRACE_REPLAY` pieces, and re-syncs `p := handOffset` when the scale returns to 1 (§3.2). |
| M | Passing step could not land on tc at real finger speeds (`stepDurMin` 0.15, `swingVmax` 6) and `footYawRate` 8 binds | Step requested at cut start with the clip's swing duration scaled to the current φ̇, **no floor** (`'strike'` skips the 0.28 clamp entirely); `GAIT.swingVmax` (pre-existing, Q7) is the only thing that decides the landing; landing − tc is a reported distribution, PASS/FAIL only at scripted clip pace. `footYawRate` dropped (re-basing removed the jump it hid) (§5.6). |
| N | Stroke-mode step unstated | A no-wind stroke with S > `stepS` issues the same joystick-independent step (0.23–0.78 m by S); stated under Q7 (§10) and §11. |
| O | `balanceAssist` seam for R4 | `cmd.balanceAssist` = `DRIVE.balanceAssist(φ)` table, identity (1.0) in R2, multiplied into `anchorYawRelax()`; R4 fills 0.5 release→follow / 1.0 recover (§5.3, §5.9). |
| P | AI seam labelling | `f.strike.openness / guardGap / nearGuards / S / phi / state` are **viewer, validation and R3/R4 physics-layer** fields; `ai.js` never reads `f.strike` or `f.ges` (doc §5-2: visible body signals only) — `r2_gates.mjs` greps for it (§5.7, §9). |
| Q | Gold "cannot stop" trail lost | Gesture calls the existing `f.onCommit('B', S, fam)` once per cut when `c(S)` first reaches 1, so `trail.confirm` + haptic (`main.js:346-348`) still fire in the test build; R5 replaces it with the φr→φf window signal. Stated in the §8.2 owner row. |
| R | Double S weighting (guard↔clip and size both by S) | `c(S) = smoothstep(0, mixX 0.25, S)` is the guard↔clip crossfade; S alone drives the size blend (doc §2-2 (2)). At S 0.5 the pose is 100 % medium clip, not half guard (§5.3, §6.1). |
| S | `overWindGain 0.15`, hands/poles frozen beyond `sL1` | Linear continuation: `over = (|w| − sL1) / (0.5·(sL1 − sL0))`, `out += over·(large − medium)` on **every** clip channel (directions by scaled rotation vector), gain 1; soft limits and physics are the walls (§4.4). |
| T | `ffGain` / `anchorRelaxYawK` "shipped values keep falls at R1 level" | Staging is a debugging order only; the shipped values are the doc's 0.8 / 0.9. If falls rise at those values the cause is fixed or, when it is the physics of a big cut, reported under Q24 — never down-tuned silently (§5.4). |
| U | Old commit path | `decisions.md` (director defaults): the old commit path and its two unasked limits (`COMMIT.overLight` config.js:616 / skill.js:1023; level-scaled program values skill.js:902/987/1230) are deleted in R2. W5 does it as the last commit after `s0_diff` passes, keeping `pf`'s value by changing its condition to `sk.detect && WHOLE.on` (§7-8, §9). Until then `GESTURE.on=false` is the sim comparison flag. |

---

## 2. Architecture and step order

### 2.1 Files

```
src/strike/gesture.js    Gesture, SyntheticFinger, GES_* states           (W2)
src/strike/atlas.js      validate*, buildAtlas, loadAtlasPacked, loadAtlasFromClips, Atlas   (W1)
src/strike/clips/atlas_v0.json   packed atlas (generated, checked in)     (W1)
src/strike/drive.js      ClipDrive: trunk, anchor, ranges, τ_ff chain, feet, step, script(), debug   (W3)
src/strike/drive_arm.js  hand frame, aim, warp, pole hysteresis, solveArmIK use, rate limits, co-contraction, armFF   (W4)
src/strike/puppet.js     kinematic retarget check + ragdoll puppet          (W3)
tools/motion/pack_atlas.mjs, tools/sim/{atlas_check,gesture_eval,puppet,s0_diff,r2_gates}.mjs, chain.mjs extension   (W1/W2/W3/W5)
config.js                CONFIG.GESTURE, CONFIG.ATLAS, CONFIG.DRIVE
```

Fighter fields created once: `fighter.ges` (Gesture output object), `fighter.drive` (ClipDrive), `fighter.stepT` (ms), `fighter.inputScale` (1; main.js sets 0.25 during hit-stop, §3.2), `fighter.strike` (public read-only view: `{ S, phi, state, fam, side, homePad, openness, guardGap, nearGuards, stats }` for R3/R4 physics layers, the viewer and validation — **never read by `ai.js`**, doc §5-2). `bodyPose`/`bodyPoseVel` gain `side: 0`.

### 2.2 Per-step order (`fighter.js:698 step(dt)`), hooks marked `+`

```
714  this.updateHeading(dt);
716  this.skill.update(dt);            → inside Skill.update (skill.js:405): gesture.update (§3) replaces detectCommit when GESTURE.on
   + if (this.drive) this.drive.update(dt);        // ges → (fam, side, phiB, S) → atlas.sample → this.cmd (S = 0: w = 0, return)
717  this.updateBodyPose(dt);          → before fighter.js:651 `this.pelvisYawOffset = bp.pelvisYaw;`: + if (this.drive?.w > 0) this.drive.mixBody(bp, bv, dt);
718  this.driveBalance(dt);            → fighter.js:1322 `const r = this.uprightRelax(ax);` yaw-axis stiffness relax (§5.3)
719  if (this.gait?.active) this.gait.pinFeet();   → gait.js:1038-1046 foot pivot target + toe lever (§5.6)
720  this.applyPose(dt);               → fighter.js:1542 twist clamp, 1544-1545 side bend (§5.5)
   + if (this.drive?.w > 0) this.drive.applyTorques();   // τ_ff chain, soft limits, jointSetLimits (§5.4, §5.5)
722  this.driveSword();                → fighter.js:1719/1746/1931/1938 (§6)
723  this.offHand();                   → unchanged (lever is R3); offArmIK pole/shoulder hooks 2012/2018 (§6.5)
724  this.driveJoints();               → fighter.js:1564-1565/1591/1596/1660 (§6.6)
```

`drive.update` runs after `skill.update` so `skill.aimRaw` (the finger) and `ges` are current; `mixBody` runs before line 651 so the anchor (`fighter.js:1310 anchorQ = _qt.setFromAxisAngle(UP, this.heading + this.pelvisYawOffset)`) and gait (`limitTurn`, `target()`) see the commanded pelvis yaw.

### 2.3 Step clock

- main.js loop (`main.js:1293 while (acc >= PHYSICS.timestep && steps < PHYSICS.maxStepsPerFrame)`): before `player.step(PHYSICS.timestep)` (`main.js:1299`) add `player.stepT = now - (acc - PHYSICS.timestep) * 1000;` (wall ms of this step's end; same clock as `input.fingerTrace.tick(now)` at `main.js:1254`).
- headless (`tools/sim/harness_m.mjs:211 G.step = () => { P.tick(); step0(); }`): after `P.tick()` set `P.f.stepT = P.wall - P.budget * DT * 1000;` (deterministic; `P.wall` is the pump's frame clock). `newRound` without a pump leaves `stepT` at 0 and gesture idle (no source).
- `PHYSICS.timestep` is fixed `1/120` (config.js:13); "60/120 Hz" everywhere below means finger input rate (`HZ` env of `wholebody.mjs`), not the physics dt.

---

## 3. `src/strike/gesture.js` — finger → S, dir, φ (per physics step)

### 3.1 API

```js
export const GES_IDLE = 0, GES_WIND = 1, GES_CUT = 2, GES_FOLLOW = 3, GES_RECOVER = 4;
export class Gesture {
  constructor(fighter)              // fighter.ges = this.out (preallocated numbers / small typed arrays)
  attachTrace(fingerTrace)          // player: input.fingerTrace (main.js:344)
  attachSource(src)                 // anything with at(tMs, out) → { x, y, vx, vy, held } (SyntheticFinger, tools)
  update(dt, tStepMs)               // called from Skill.update; returns immediately when no source or !bodyOk
  reset()                           // round start, revive, weapon drop
  static bodyOk(f)                  // f.alive && f.armed && !f.weapon?.gun && f.state==='stand' && !f.skill.tap && !(f.finish?.amt > 0.5)  (skill.js:547 canCommit body part minus kneel: the anchor follows the pelvis command only when standing (fighter.js:1310) and requestStep refuses kneel (gait.js:223); at kneel S folds to 0 and the arm cut is unchanged)
}
export class SyntheticFinger { push(tMs, x, y, held = true); at(tMs, out); clear(); }   // absolute pad coordinates, linear interpolation, holds last sample
```

Output `fighter.ges`:

| field | meaning |
|---|---|
| `state` | IDLE / WIND / CUT / FOLLOW / RECOVER |
| `S`, `Swind`, `Sstroke`, `Scut` | load 0–1; `S = max(Scut, Sstroke)` after cut start, `Swind` before; **exactly 0** below `sSnap` while decaying (§3.7) |
| `over` | size continuation beyond S = 1, counted in medium→large steps (one unit adds one `(large − medium)`, §4.4) (wind: `(|w| − sL1)/(0.5·(sL1 − sL0))`; stroke: `Sstroke − 1`), ≥ 0, never clamped (§3.4, §4.4) |
| `c` | guard↔clip crossfade `smoothstep(0, mixX, S)` (§5.3) |
| `input` | `'wind'` (A) / `'stroke'` (B) — `GESTURE.input`, the owner's switch (§3.10) |
| `mode` | `'wind'` (clip started from the finger wind at φ_rev) / `'stroke'` (no finger wind: clip started at `φ_align` in (A), at `−autoWindPhi` in (B)); hands join in both (`DRIVE.handOnStroke true`) |
| `arc0` | start-pose arc toward the family's end pad (§3.4) |
| `phiF`, `phiDotF` | finger phase and rate |
| `phi`, `phiDot`, `phiDDot` | body phase (filter output) and derivatives — drive uses these |
| `famA`, `famB`, `famMix` | neighbour families and mix (0 = all A); after lateSelect `famB = famA`, `famMix = 0` |
| `side` | `'right'` / `'left'` (clip side) |
| `dirC[2]` | stroke direction (pad unit vector), fixed at lateSelect |
| `w[2]`, `o[2]`, `p[2]`, `v[2]` | wind vector, origin, unclamped finger position, velocity (pad m, m/s) |
| `phiRev` | φ_wind at the reversal (for carry-over) |
| `tCut`, `tRecover` | step-clock ms |
| `busy` | `state === CUT || state === FOLLOW` (the stroke itself; Skill's auto-return waits on it — RECOVER *is* the return, so it must not wait on S) |

### 3.2 Input adapter `readFinger(src, t)`

- Contract with R0: `fingerTrace.at(tMs, out)` gives the finger at physics time `t` (event-time interpolation, `predictMs 8` look-ahead allowed for **position only**). If R0's `at` returns integrated positions, gesture uses them directly; if it returns only per-step deltas/velocities, gesture integrates. Either way:
  1. **p is never clamped.** Touch input is relative (`input.js:149 this.fingerTrace.push(e.timeStamp || performance.now(), tdx, -tdy)`; the same deltas go to `handOffset`, which `skill.js:399 if (off.length() > R) off.setLength(R);` clamps at 0.62 m). Gesture sets `p := f.handOffset` on each touch-down (first piece after `TRACE_LIFT`) and while not held (auto-return moves the pad), and during a held touch integrates the unclamped pieces itself. A wind dragged to 0.62–1.0 m (or beyond) counts in full.
  2. **Reversal is judged on real samples.** `v` and the reversal test use the last two real samples; the 8 ms prediction is never used for `v`. (구현 9/29: after the last real sample `readFinger` carries that velocity over `max(span, COMMIT.stillGap, COMMIT.stillFrames·frameDt)` — a gap-tolerance window, not a limit; event times run ahead of the rAF step, so carrying it only one sample span read a running stroke as `v = 0`, `93b25ac`. W5's deletion of the old commit path must keep these two `COMMIT` values.)
  3. Lift (`TRACE_LIFT`, `input.js:167`) arrives as `held = false`; `v` survives one more step (flick = reversal on lift), then 0.
  4. **Hit-stop.** `main.js:1259 const inScale = hitStop > 0 ? 0.25 : 1;` scales the `handOffset` deltas (`:1261-1262`) while `input.fingerTrace` is unscaled. `main.js` publishes `player.inputScale = inScale` before the physics loop (`:1293`); gesture multiplies every integrated piece by `f.inputScale ?? 1` (harness: 1), so `p` and `handOffset` stay in step; pieces flagged `TRACE_REPLAY` (`input.js:11`, no producer yet) are skipped as detectCommit does; when `inputScale` returns to 1 gesture re-syncs `p := handOffset + (p − handOffset)·0` (a guard; with the same scale the drift is 0). `v` for the reversal test uses the unscaled trace (the finger's real motion), so a reversal during hit-stop is still recognised on its step.

### 3.3 Per-step state machine

```
update(dt, t):
  if (!source) { if (state === IDLE && S === 0) return; decayToIdle(tau 0.08); return }   // AI fighters without a source cost nothing
  if (!Gesture.bodyOk(f)) { decayToIdle(tau 0.08); return }
  F = readFinger(src, t)                            // p, v, held (v along the stroke: vC = max(0, dot(v, dirC)))
  updateRest(F)                                     // |v| < restV for ≥ restDwell → o := p   (IDLE, RECOVER, WIND with Swind = 0; also on touch-down)
  switch (state):
    IDLE:    w = p − o; computeWind(w)              // (A) only: Swind, famA/B/mix, side, phiF = −1 + min(1, |w|/sL1), over
             if (Swind > 0) state = WIND            // continue in the same step
             else if (input === 'stroke' && |v| > vStrike) startCut(t, 'auto')     // (B): stroke start from rest, §3.10
             else if (input === 'wind' && held && gap && |v| > vStrike) startCut(t, 'auto')   // (A): gap = computeWind gave 0 because the neighbour gap > sectorMax (§3.4); 구현 9/29: 499a9b7
    WIND:    w = p − o; computeWind(w)
             if (reversal(F, w)) startCut(t)        // §3.5
             else if (|v| < vStrike && dot(v, ŵ) < 0) Swind → smoothstep(sL0, sL1, |w|) with τ tauRelease   // slow return (Q2)
             S = max(Swind, Sres); over = max(overWind, oRes)   // Sres/oRes: the previous stroke's load after a rewind (RECOVER below), ×e^(−dt/tauRelease) per step, 0 below sSnap; never enters Swind/Scut, cleared at startCut/toIdle/reset (구현 9/29: 499a9b7)
             if (Swind == 0 && Sres == 0 && dwell ≥ restDwell) state = IDLE
    CUT:     phiDotF = kφ·vC; phiF += phiDotF·dt    // finger clock, no floor (Q1, §3.6); 'floor' sim mode: 1/T0 + kv·vC
             strokeLen += |Δp|; v̄ = strokeLen / (t − tCut); Sstroke = arc0·(strokeLen/Lref)·(v̄/vRef)   // §3.4, unclamped
             S = max(Scut, min(1, Sstroke)); over = max(overWind, Sstroke − 1)          // monotone while the finger moves
             if (t − tCut ≤ lateSelect || strokeLen ≤ lateSelectLen) lateSelect(F)    // §3.4
             if (stopped(F)) startRecover(t)        // |v| < restV, lift, or dot(v, dirC) < 0: the command stops with the finger (Q1)
             if (phiF ≥ 1) state = FOLLOW
    FOLLOW:  same clock and stop rule as CUT (label only: φ ≥ 1 = follow-through, R5's signal window)
             ring.push(t, p)                        // 0.15 s, 24 slots × 3 Float64, preallocated — origin bookkeeping, no input is ignored
             // no φ end: FOLLOW ends only by the stop rule (구현 9/29: the `phiF ≥ followEnd → startRecover` line is gone — a hidden length limit; followEnd/recoverEnd are reserved for R4, 93b25ac)
    RECOVER: phiF frozen                            // the command stays where the finger left it; the body's inertia is physics (Q1). R4 may drive 1.6 → 2.2 with its recovery clip
             if (input === 'wind' && held && !restedSinceRecover && dot(p − o, dirC) > 0) o := p   // (A) origin rule, §3.7 (구현 9/29: 499a9b7)
             w = p − o; computeWind(w); if (Swind > 0) { state = WIND; Sres = S·e^(−dt/tauRelease); oRes = over·e^(−dt/tauRelease) }   // (A): rewind recognised at once (Q18); S does not drop to Swind in one step (구현 9/29: 499a9b7)
             if (input === 'stroke' && |v| > vStrike && dot(v, dirC_prev) < 0) startCut(t, 'auto')   // (B): the next stroke
             S → 0 with τ tauRelease; if (S < sSnap) S = 0    // snap: exact 0 re-enters the S = 0 identity (§7); after the rewind / next-stroke checks, as in the code
             if (S === 0 && dwell ≥ restDwell) state = IDLE
  phiFilter(dt)                                      // §3.6
  write out
```

- S = 0 steps: every consumer is gated by `w > 0` (`w = S`), so IDLE, small winds (|w| < 0.12) and strokes whose `Sstroke` is 0 (no travel along `dirC` from rest below `vStrike`) are **arm cuts** (§7). `sL0 0.12` is a deadband: the first 0.12 m of any drag (20 ms at 6 m/s, 40 ms at 3 m/s) moves nothing whole-body and the S = 0 `follow()` path carries the 33 ms pelvis gate through it; it is the doc's value (§10 Q21) and the ≤ 3 % misclassification / 3 mm-jitter gate depends on it.
- `S` decays only through `sSnap`: `S < 0.02 → 0` (a 2 % size-blend tail; below the size crossfade resolution and any physical effect). Consumers test `S === 0`, never `S <= ε`.
- `reset()` on fall / disarm / thrust / finish / kneel: S folds to 0 with τ 0.08 s (then snaps), state IDLE, ring cleared.

### 3.4 Wind vector, S, family

- Origin `o`: last place where `|v| < restV 0.25 m/s` for ≥ `restDwell 40 ms`; touch-down position; at `startRecover` the last dwell inside the ring (else the ring's oldest sample). **Held wind**: while `state === WIND && Swind > 0` a dwell does *not* move `o` (the wind is held at the chamber, Q2 — `w`, `ŵ` and the family keep their values, so a fast move against `ŵ` from the held chamber is the reversal); `o` follows dwells only in IDLE, in RECOVER (§3.7) or once `Swind` has decayed to 0. **Finger only**: `computeWind` and the (B) stroke start run only while `held`; a lift in WIND decays `Swind` with `tauRelease` (a re-touch within the decay can still stroke from it), and Skill's auto-return moving `handOffset` at `recoverSpeed 1.2 m/s` while the finger is up is never a gesture (p is re-synced to `handOffset` without winding).
- `w = p − o`, `|w|` unclamped. `Swind = smoothstep(sL0 0.12, sL1 0.55, |w|)`: rises instantly; falls only while the finger returns slowly (τ 0.25 s, Q2). `overWind = max(0, (|w| − sL1) / (0.5·(sL1 − sL0)))` = how many more medium→large size steps the finger has dragged beyond the large wind (0.215 m each, the same pad distance that carries S 0.5 → 1); the atlas continues **every** clip channel linearly by it (§4.4). Doc §2-2 (1): extra drag is a bigger wind — no gain below 1, no channel frozen.
- Wind phase `phiF = −1 + min(1, |w| / sL1)`; beyond `sL1` φ stays 0 (the chamber) and the pose keeps growing through `overWind`. The wind pose is 1:1 with the finger from the first frame.
- **Stroke load (Q3, both modes).** `arc0 = |o_pad − end_f| / |ch_f − end_f|` (the arc the start pose already has toward the family's end pad; pflug→zornhau 0.39, vom Tag→oberhau ≈ 1.0, unclamped so a start beyond the chamber gives > 1), `Lref_f = |ch_f − end_f|` (family geometry from `STROKE.path`, config.js:664-670), `vRef 6 m/s` (= today's `COMMIT.bSpeed`, the speed the game already calls a fast stroke), `v̄` = stroke length / time since cut start. `Sstroke = arc0 · (strokeLen / Lref_f) · (v̄ / vRef)`; `S = min(1, Sstroke)`, the excess is `over`. From a high guard a long fast stroke is the biggest cut; from pflug the same finger gives ≈ 0.39 at 6 m/s, 0.78 at 12 m/s, 1.0+ at 15 m/s — geometry and the owner's two inputs, no number that stops it. A fast reposition (0.3 m at 3 m/s from pflug) gives 0.06: continuous, no cliff.
- **Family: two neighbours by origin-relative bearing.** Chamber pads `ch_f` from `config.js STROKE.path[fam].ch` (diagR [0.42,0.42], diagL [−0.4,0.42], vert [0.02,0.52], horizR [0.52,0.03], horizL [−0.52,0.03], riseR [0.38,−0.44], riseL [−0.4,−0.42]). Each step: `b_f = atan2(ch_f − o)`, sorted circularly; the finger bearing `atan2(w)` selects the two enclosing families `f_A, f_B` with `famMix` = angular fraction. Reason: from pflug (0.18,−0.28) the pull toward the right shoulder is 71°; an axis-bearing wheel would put it half-way between diagR (46°) and vert (89°) — origin-relative it is pure diagR. If the enclosing gap exceeds `sectorMax 80°` (straight down, between riseL and riseR = guard change to Alber), it is not a wind: `Swind = 0`.
- Sides: diagL/horizL/riseL → `side='left'` clips; vert → side by the sign of `w.x` with the previous value kept near 0.
- Family → clip: `GESTURE.famClip = { diag:'zornhau', vert:'oberhau', horiz:'mittelhau', rise:'unterhau' }` (zwerch/schiel/scheitel/krump are reserved; a later round changes only this map and `ATLAS.families`).
- **lateSelect**: within `lateSelect 70 ms` after the reversal or until `strokeLen ≥ lateSelectLen 0.10 m` (whichever first), `dirC = unit(p − p_cut)` re-picks the family with the largest `dot(dirC, unit(end_f − ch_f))` over all families; if it differs from the wind pick, `famA → new` with a `famBlendT 40 ms` crossfade (`famMix` 1 → 0), then locked for the rest of the stroke. (Real releases move pelvis and feet first; hands are still for 60–80 ms.) The lock is a **shape** choice, not a time value: a released zornhau cannot become a mittelhau mid-stroke in a human either; the finger still steers through the guard share, `cutPlane` and the warp (§10 Q1).

### 3.5 Cut start: velocity reversal (kinematic, every step)

`reversal(F, w): |v| > vStrike 1.5 m/s && dot(v, ŵ) < revDot(−0.3)·|v|`. On the first true step: `tCut = t`, `p_cut = p`, `phiRev = phiF`, `Scut = Swind` (the wind's load; it is held while the finger keeps moving along the stroke and decays when it stops, §3.7), `phiF = 0`, `dirC = −ŵ` (lateSelect corrects), `strokeLen = 0`, `state = CUT`; the rest of this step's CUT work runs immediately. No second stage. Flick on lift counts. A reversal with `Swind = 0` still enters CUT (to measure `Sstroke`); nothing moves while S stays 0.

**No-wind stroke** (`Scut == 0 && Sstroke > 0`, `mode = 'stroke'`), Q3 answered: S is uncapped (§3.4) and the hands join (`DRIVE.handOnStroke true`). The yank the old trunk-only rule avoided (clip hand over the head at φ 0 vs a hand already moving from pflug) is removed by where the clip starts, not by leaving the hands out: in (A) the clip phase starts at `φ_align ∈ [0, 0.85]` where `clip.chest.yaw(φ_align, S)` equals the current commanded chest yaw (monotone decreasing there; clamp to the ends) — there the clip hand is mid-stroke like the finger's — and the cut-start carry-over (§5.2, `carryPhi 0.3`) removes the residual offset smoothly; in (B) the clip starts at `−autoWindPhi` (the short automatic wind, §3.10) with the same carry-over. W4's hand-hitch gate (hand speed toward the chamber after `tCut` < 0.5 m/s) covers both; `handOnStroke false` (trunk only) is the fallback if it fails, never the default.

### 3.6 Phase rate and body-phase filter

- CUT/FOLLOW, `GESTURE.clock: 'finger'` (default, Q1 as answered): `phiDotF = kφ·max(0, dot(v, dirC))`, `kφ = 1/sL1` (the stroke φ 0→1 is the same 0.55 m of pad as the wind −1→0; geometry, not a knob). Finger 6 / 12 / 20 m/s → φ̇ 10.9 / 21.8 / 36.4 /s → φ 0→0.85 in 78 / 39 / 23 ms of finger travel; when the finger stops, lifts or reverses the command stops **there** (RECOVER, φ frozen) and only the body's momentum continues — the stopping cost is muscle limits and inertia, no time value, no brake value. No upper clamp; when muscles cannot follow, the clip clock is not slowed — physics lags (Q4). A short flick therefore plays a short piece of the clip, exactly as today's arm cut stops where the finger stops (doc §3-3).
- `GESTURE.clock: 'floor'` (**sims only**, never in the build): the doc's `1/T0 + kv·max(0, dot(v, dirC))`, `T0 = f.weaponCfg.gestureT0 ?? 0.30`, `kv 0.35 /m` (6 / 12 / 20 m/s → 5.4 / 7.5 / 10.3 /s). chain.mjs runs both so the owner's Q1 answer can be shown against the doc's law; the inertia-class threshold (1.3 × `COMMIT.iLongsword`) is gone — weapon differences are physics (Q26).
- WIND: `phiDotF = dot(v, ŵ)/sL1` (same 1:1 law).
- Body phase: critically damped 2nd order, ω = `phiW 60`, with ramp-lag compensation and load-scaled lead:
  ```
  u    = phiF + phiDotF·(2/ω + leadMs·S/1000)        // 2/ω = 33 ms cancels the steady ramp lag exactly; body may lead by 40 ms·S
  exact discretisation (E = e^{−ω dt}, e = phi − u):
    phi'    = u + (e + (phiDot + ω e) dt)·E
    phiDot' = (phiDot − ω(phiDot + ω e) dt)·E
  phiDDot = ω²(u − phi) − 2ω·phiDot                    // used by the τ_ff chain
  bound = phiF + phiDotF·leadMs·S/1000                 // lead bound: the command never runs ahead of the finger by more than 40 ms·S (Q22)
  if (phiDotF ≥ 0 ? phi > bound : phi < bound)         // in the direction of motion only; never pulls φ back behind its previous value
    phi = phiDotF ≥ 0 ? max(bound, min(phi, phiPrev)) : min(bound, max(phi, phiPrev)); phiDot = (phi − phiPrev)/dt
  ```
  (구현 9/29: the lead bound `φ ≤ φF + φ̇F·leadMs·S/1000` applies in the direction of motion and never pulls φ back behind its previous value — the earlier `phi = min(phi, bound)` made φ jump back on the step the finger stopped and forced a lead when φ̇F < 0, `93b25ac`.)
  Constant-speed drags are tracked with zero steady lag; a jump (new touch) is 59 % followed within 33 ms. Exact discretisation is unconditionally stable (dt is fixed 1/120 anyway). With the finger clock `u` freezes when the finger stops, so the filter settles onto the frozen command within ≈ 3/ω = 50 ms (this is the filter's own settling, not a continuation).

### 3.7 FOLLOW buffer and recovery

- During FOLLOW (φ ≥ 1, no upper end; 구현 9/29: `followEnd`/`recoverEnd` are reserved for R4 and no longer end a cut — FOLLOW has no length limit and ends only by the stop rule below, `93b25ac`) the finger still drives φ (same clock); `(t, p)` goes to the 0.15 s ring for origin bookkeeping. The guard share `(1 − c)` still follows the finger. No input is discarded or delayed.
- **S after the reversal**: held at `max(Scut, Sstroke)` while the finger keeps moving along `dirC`; the first step the finger stops (`|v| < restV`), lifts, or moves against `dirC` → `startRecover(t)`: φ freezes, S decays with `tauRelease` (Q2's value; no second constant) and snaps to 0 below `sSnap`. As S falls, `c(S)` hands the pose back to `guardAt(finger)` and Skill's auto-return (`SKILL.recoverSpeed`, Q17); the body's angular momentum is what physics keeps (R4 relaxes the servos that erase it).
- `startRecover(t)`: `o :=` last dwell in the ring (or its oldest sample), then `w = p − o` → a wind begun during follow-through is recognised on the first recovery step (Q18, no cooldown). The trunk share keeps its momentum physically; a deep follow-through has to be re-wound. (A) In RECOVER, until the first dwell, `(p − o)·dirC > 0 ⇒ o := p` (continuing the same way after a hitch is not a wind); after a dwell, the dwell point is `o` (구현 9/29: `499a9b7`). The cost of this rule: a +dirC rewind right after a 10–30 ms hitch (shorter than `restDwell`) still reads as the stroke's continuation (`gesture_eval` reports it, `vi_rewind_curve_hitch_report`); dropping the rule fixes that but turns a same-side continuation after a 20 ms hitch into a wind — the director's/owner's choice (Q18 vs Q1).
- Skill auto-return (`skill.js:504`) does not start while `ges.busy` (`CUT`/`FOLLOW` only); RECOVER releases it at once, so the pad goes home while S decays.

### 3.8 Hooks

1. `skill.js:405` `if (WHOLE.on && WHOLE.commit && this.detect && this.trace) this.detectCommit(dt);` → `if (GESTURE.on && f.ges) f.ges.update(dt, f.stepT); else if (WHOLE.on && WHOLE.commit && this.detect && this.trace) this.detectCommit(dt);`. With `GESTURE.on` the player never runs detectCommit; `f.commit.on` stays false, so `skill.js:406 if (cm.on) this.updateCut(dt);`, the autoChamber aim override `:481` (`prog && cm.start === 'auto' && cm.u < 0`), `:504` (`prog && !cm.ended`) and `:529` (`prog && !COMMIT.armLunge`) are dead (comparison flag `GESTURE.on=false`; W5 deletes the path per §1.1-U). `fighter.js:622 pf` keeps `sk.detect && WHOLE.on && WHOLE.commit` (unchanged value; on deletion the condition becomes `sk.detect && WHOLE.on`).
2. `fighter.js:233` `this.skill = new Skill(this);` → next line `this.ges = GESTURE.on ? new Gesture(this) : null; this.drive = null;` (drive attached in main/harness after the atlas loads: `f.attachDrive(atlas)`).
3. `main.js:342-344` `input.fingerTrace.clear(); player.skill.detect = true; player.skill.trace = input.fingerTrace;` → add `player.ges?.attachTrace(input.fingerTrace); player.ges?.reset();`. `stepT` per §2.3.
4. `skill.js:504` `if (canRecover && this.cutPending && !swinging && !f.handHeld && this.idle > SKILL.recoverDelay && !(prog && !cm.ended))` → append `&& !(f.ges?.busy)`.
5. `skill.js:529` `if (f.move.y > -0.2 && !this.holdFeet && !(prog && !COMMIT.armLunge) && f.foeDistance() > SKILL.lungeMin) f.move.y = …` → append `&& !(f.drive?.stepping)` (§5.6).
6. `skill.js:510-511` `const hx = SKILL.homeGuard[0] - off.x;` → `const home = f.strike?.homePad ?? SKILL.homeGuard;` and use `home` in 510, 511, 516 (§5.7).
7. AI seam (§9 W2): `ai.js:1256 moveHand(dt)` — when `GESTURE.ai` (default false) push `(nowMs, off.x, off.y)` into `me.aiSynth` (SyntheticFinger) **before** `ai.js:1309 if (off.length() > 0.62) off.setLength(0.62);`; `me.ges.attachSource(me.aiSynth)`. No `planStrike` exists today (`startAttack` `ai.js:767`, `startStrike` `ai.js:865` are the seam; `opportunity` `:666`, `seize` `:706`); R2 adds `planStrike(tech, S, windT)` **definition only** (returns a synthetic path: wind leg toward the family chamber beyond the disc, reversal, stroke leg along `tech.path`), not called. `ai.js` never reads `f.strike` / `f.ges` (doc §5-2); the enemy's `Gesture` has no source and returns on its first line (no per-step cost, §3.3).
8. **Signal hook kept** (`main.js:346-348 player.onCommit = (stage) => { if (stage !== 'B') return; trail.confirm(...); hapticPulse(8); }`): gesture calls `f.onCommit('B', S, fam)` once per cut at the first step where `c(S) === 1` (the body is fully on the clip; `fighter.js:1435` default is a no-op for the AI). The gold trail and the 8 ms pulse therefore still exist in the R2 test build; R5 replaces the trigger with the φr→φf "cannot stop" window (doc §5-3).
9. **Atlas preload** (`main.js:30 await RAPIER.init();`): next line `const atlasReady = import('./strike/atlas.js').then((m) => m.loadAtlasPacked());` (Vite bundles `src/strike/clips/atlas_v0.json` into that chunk; the base64 → Float32 decode and the SG derivative pass run inside the promise, before any round). `beginFight()` (`main.js:949 state = 'fight'`) becomes `async` and `await atlasReady` precedes `state = 'fight'`; `newRound` attaches `player.attachDrive(atlas)` / `enemy.attachDrive(atlas)` when resolved. If a wind ever runs with `f.drive == null`, `f.strike.stats.atlasMissing++` and the stroke is an arm cut (counted in the S = 0 report, never silent). Headless: `harness_m.mjs` loads the atlas before `newRound`.
10. **Hit-stop scale** (`main.js:1259`): `player.inputScale = inScale;` added right after the `inScale` line (§3.2-4).

### 3.9 `CONFIG.GESTURE` (first values, §9 of the doc)

```js
export const GESTURE = {
  on: true, ai: false,
  input: 'wind',                         // owner's switch (Q3 부연): 'wind' (A) finger-position wind | 'stroke' (B) stroke length/speed only, short automatic body wind
  clock: 'finger',                       // Q1 as answered: φ̇ = v_along / sL1, no floor. 'floor' = doc law 1/T0 + kv·v, sims only
  sL0: 0.12, sL1: 0.55,                  // Q21; overWind = (|w| − sL1)/(0.5·(sL1 − sL0)), linear continuation, no gain; no pad-drag end (구현 9/29: the 1.0 m pad-extension value is deleted — nothing read it and it would have been a size ceiling, Q3; b9b1c4a)
  restV: 0.25, restDwell: 0.04, vStrike: 1.5, revDot: -0.3, tauRelease: 0.25,     // Q2 (tauRelease is also the post-stroke S decay)
  vRef: 6.0,                             // Q3: stroke speed that counts as 1 (= today's COMMIT.bSpeed); Lref and arc0 are family geometry
  autoWindPhi: 0.3,                      // Q3 (B): the automatic wind = clip φ −0.3 → 0, finger-clocked (0.165 m of pad)
  sSnap: 0.02,                           // decaying S below this is exactly 0 (transparency row, §10)
  lateSelect: 0.07, lateSelectLen: 0.10, famBlendT: 0.04, sectorMax: 80,
  predictMs: 8, phiW: 60, leadMs: 40,    // Q22
  T0: 0.30, kv: 0.35,                    // 'floor' clock only (sims); weaponCfg.gestureT0 may override; no inertia-class threshold (Q26)
  followEnd: 1.6, recoverEnd: 2.2, buffer: 0.15,   // followEnd/recoverEnd: reserved for R4's recovery clip; the gesture never ends a cut by φ (구현 9/29: 93b25ac)
  famClip: { diag: 'zornhau', vert: 'oberhau', horiz: 'mittelhau', rise: 'unterhau' },
};
```

### 3.10 Input modes (A)/(B) — the owner's switch (`decisions.md` Q3 부연 13:40)

| | (A) `input: 'wind'` (default) | (B) `input: 'stroke'` |
|---|---|---|
| wind | finger position: `w = p − o`, `Swind`, φ −1→0 at 1:1 (§3.4) | finger winds ignored (`Swind ≡ 0`); IDLE stays IDLE while the finger positions |
| cut start | velocity reversal (§3.5; with `Swind = 0` too, to measure `Sstroke`); from rest, a stroke toward a `sectorMax` gap (no wind exists there, §3.4) with `|v| > vStrike` also enters CUT (`'auto'`, `dirC = v̂`) (구현 9/29: `499a9b7`) | first step with `|v| > vStrike` from rest (`startCut(t, 'auto')`): `dirC = v̂`, family by `dirC` (the lateSelect rule from step 0, `famBlendT` crossfade if it changes within `lateSelect`), side by family / `dirC.x` |
| S | `max(Scut, Sstroke)` (§3.4) | `Sstroke` only: `arc0 · (strokeLen/Lref) · (v̄/vRef)`, rising from 0 during the stroke (continuous, no cliff) |
| clip phase at start | wind: `φ_rev` carry-over; no-wind: `φ_align` | `−autoWindPhi`: the body performs the wind itself while the finger is already stroking; the wind portion consumes `autoWindPhi·sL1 = 0.165 m` of finger travel at the finger clock (no time value); hands join from the start scaled by the rising S, so the up-swing is proportional to the load, never a yank |
| hands | join (`handOnStroke true`) | join |
| step | §5.6 | §5.6 (same `stepS`) |
| what the owner feels | the wind is the drag; big cuts need a visible wind gesture | no wind gesture; a long fast stroke *is* the big cut, and the body shows a short wind before it |

Both modes ship in the test build (settings toggle mirroring `GESTURE.input`, `?input=stroke` URL param next to `main.js:1241`); `film_wholebody.cjs` renders `zornhau-wind` (A) and `zornhau-stroke` (B) for the same finger file; the gesture gate (§8.2) runs the detect set in both. The owner's play chooses; the loser is deleted afterwards, not kept as a hidden path.

---

## 4. `src/strike/atlas.js` — clip/2 loader, validation, sampling

### 4.1 Files and loaders

| what | where |
|---|---|
| Source of truth | `docs/motion/clips/<cut>_<right\|left>_<small\|medium\|large>.json` + `index.json` (motion PM; never edited by the game) |
| Pack | `src/strike/clips/atlas_v0.json` built by `node tools/motion/pack_atlas.mjs [--families=zornhau,oberhau,mittelhau,unterhau] [--out=src/strike/clips/atlas_v0.json]`: `{ format:'stillness-atlas-pack/1', sourceFormat:'stillness-motion-clip/2', indexFormat:'stillness-motion-index/1', generated:'sha1:<sha1 over the sorted source id:sha1 set>', tool, sourceIndexGenerated, phiGrid:{from:-1,to:2.2,step:0.01}, channels:[…], clips:[{ id, cut, side, size, sha1, marks, phiMarks, step, startFrom, recoverTo, endPose, summary:{time, checks}, data: base64 Float32 [321 × width] }] }`. Strips `J`, `ang.*`, `w.*`, `speed.*`, `com`. Keeps `edge` (3 floats, compared, not driven — §4.3). 37 floats × 321 × 24 clips ≈ 1.14 MB Float32 (≈ 1.5 MB base64). Derivatives are computed at load (5-tap Savitzky–Golay on the grid), not stored. `generated` carries no date: repacking identical clips is byte-identical; `sourceIndexGenerated` keeps the index date (구현 9/29: `2e299eb`). (구현 9/29: 34 floats per grid point — `t` (piecewise-linear on the marks), `phi` (the grid) and `chest.xFactor` (= chest − pelvis yaw) are recomputed at load; pack 1.445 MB, `8d03a34`, regenerated `ed59e34`.) |
| Loaders | `loadAtlasPacked(json)` (browser: `import pack from './clips/atlas_v0.json'` inside `strike/atlas.js`, which `main.js` dynamic-imports at module top right after `await RAPIER.init()` and awaits in `beginFight()` — §3.8-9; the decode never runs during a fight; node sims default) and `loadAtlasFromClips(dir)` (node fs, raw clips: `atlas_check.mjs`, `puppet.mjs`, `pack_atlas.mjs`; sims with `ATLAS.source='clips'`). Both call `buildAtlas(clips, opts)`. |

### 4.2 Validation — throw, never warn

`validateIndex`, `validateClip`, `validatePack` throw `AtlasError(id, reason)` on:
- `index.format !== 'stillness-motion-index/1'`, `clip.format !== 'stillness-motion-clip/2'` (clip/1 refused: no `girdle*`, `elbowPoleO`, `step`, `recoverTo`), pack `format`/`sourceFormat` mismatch, pack sha1 ≠ source clip when both are on disk (node; 구현 9/29: `checkPackSources(pack, dir)` in atlas.js — `loadPack(src, { clipsDir })` calls it when `<clipsDir>/index.json` exists, `pack_atlas.mjs` re-reads its output that way and `atlas_check.mjs` calls it directly; node sims pass `clipsDir: await defaultClipsDir(ROOT, argv)`, `2e299eb`).
- `hz !== 120`, `data.n !== round(marks.tg·hz) + 1` (small 121, medium 151, large 181), any `cols[ch].length !== n·width[ch]`, NaN/Infinity, non-monotone `t`, marks not `t0 < tw < tr < tc < tf < tg`, `phiMarks !== {t0:−1,tw:0,tr:0.55,tc:0.85,tf:1.6,tg:2.2}`, `cols.phi` off the piecewise-linear map by > 1e−3.
- Required channels: `t phi pelvis.yaw pelvis.pitch pelvis.drop chest.yaw chest.xFactor chest.lean chest.side handS handO sword elbowPoleS elbowPoleO girdleS girdleO guardGap openness feet.L.yaw feet.L.lift feet.R.yaw feet.R.lift` (+ `J`, `ang.*` for tools). Unit channels `sword`, `edge`, `elbowPole*`: |len − 1| ≤ 0.02 (`edge`: length only, no flip report — the same check as `validatePack`; 구현 9/29: `f559793`); adjacent-sample angle ≤ `vecStepMaxDeg 20` (구현 9/29: `sword` only — the v0 poles flip 60–180° between frames, so they go to the flip report below instead of throwing, `8d03a34`).
- Family completeness: all three sizes for a (cut, side) or the family is refused; `size !== 'small'` without `step`; `recoverTo`/`startFrom` not in the guard id set (the 14 ids of `guards.js` / `atlas.js GUARD_IDS`: `tag, tagR, ochs, langort, side, pflug, wechsel, neben, alber, tagL, ochsL, sideL, pflugL, wechselL`).
- Small clips: `startPose.handError`, `endPose.handError` ≤ `smallTol 0.02`; at load, `guardAt(pad(startFrom))` and `guardAt(pad(recoverTo))` recomputed with `src/guards.js` vs `handS[0]`, `handS[n−1]` (facing frame, §4.3) ≤ 0.02 m (spec_table §7: all 48 are 0). A guards.js change trips here.
- `handedness === 'right'`; `pelvis.pitch` must be |·| < 1e−6 in v0 (else `report.warn`).
- Report (never silent, printed once by tools, exposed as `atlas.report`): `checks.wristOver160 > 0` (medium zornhau 0.06 s), reach from the fixed shoulder (§4.6), elbow-pole flips (> 57°/frame), max cross-size direction angle at the same φ.

### 4.3 Coordinates and signs → game (verified against `tools/motion/lib/body.mjs frame()` and fighter.js)

Clip world `[x fwd, y up, z sword side]` = game facing-local frame (`fighter.js:551-559 forward = (cos h, 0, −sin h), right = (sin h, 0, cos h)`; `fighter.js:1721 target = handLocal.applyQuaternion(this.yaw).add(chest)`). Chest-frame origin = `bodies.chest.translation()` = guards.js hand origin.

| clip | game | conversion |
|---|---|---|
| `pelvis.yaw` (deg, + = sword shoulder back) | `bodyPose.pelvisYaw` (rad) | `−deg·D2R` (matches `fighter.js:623 const pT = -G.pelvisYaw * pf * gw * amp;`; small clip t0 = 12.5° = pflug 25° × pf 0.5 already) |
| `chest.yaw` | `bodyPose.chestYaw` | `−deg·D2R` (`fighter.js:647 follow('chestYaw', -G.chestYaw * gw * amp, …)`) |
| `chest.lean` (total lean, + fwd) | `bodyPose.pitch` | `+deg·D2R` (small t0 5° = pflug pitch 5°) |
| `chest.side` (+ toward sword side) | new `bodyPose.side` | `+deg·D2R`, applied on the spine Euler x slot (§5.5) |
| `pelvis.drop` (m) | `bodyPose.drop` | `drop − 0.06` (`fighter.js:649 follow('drop', (G.drop - 0.06) * gw, …)`; small t0 0.07 = pflug drop 0.07) |
| `chest.xFactor` | not driven (= chest − pelvis; reports only) | — |
| chest frame `Qc` | facing-local quaternion | `Qc = qY(−chest.yaw·D2R) · qZ(−chest.lean·D2R) · qX(+chest.side·D2R)` (= `body.mjs frame(yaw, pitch, roll) = ry·rz·rx`). Check: small tw `handS [0.219,0.152,0.057]` → facing `[0.120,0.140,0.201]` = 어깨 지붕 `[0.12,0.14,0.20]`; t0 `[0.343,−0.281,0.018]` → pflug `[0.28,−0.31,0.15]` |
| `handS`, `handO` (chest m) | facing-local hand | `Qc_cmd · h` where `Qc_cmd` uses the **commanded** trunk (§6.1) |
| `sword` | facing-local aim (`fighter.js:1746 aim.applyQuaternion(this.yaw)`) | `Qc_cmd · sword` |
| `elbowPoleS/O` | armIK pole | `Qc_cmd · pole` to facing → world via `this.yaw`; armIK's own `_q1⁻¹` brings it into the actual chest frame (`fighter.js:1927-1930`) |
| `girdleS/O` = `[lift, prot]` | shoulder root offset `(prot, lift, 0)` | loaded, reported; applied only with `DRIVE.girdle:'anchor'` |
| `feet.L/R.yaw` (deg) | gait `l.yaw` (rad, `atan2(−fx.z, fx.x)`) | `−deg·D2R`, mapped by **role** (§5.6) |
| `feet.*.lift` (0–1) | `l.heel` (rad) | `lift · GAIT.heelMax` (0.5) |
| `step {foot, from, to, liftPhi, landPhi}` | `gait.requestStep` | `fwd = to[0] − from[0]`, `side = to[1] − from[1]` (§5.6) |
| `edge` (chest frame) | **not driven** (`DRIVE.edgeFromClip false`) | clip_format §3-6: `edge` "is not an authored value but derived from the tip velocity" — the same definition as the game's `edgeDir` from `hitPointVel` (`fighter.js:1765-1783`), and the game's is measured from the actual blade, so it is the truer source; at slow wind (`moving ≈ 0`) the static `RIGHT_LOCAL` flat (`:1769`, flat sideways) is right for zornhut and vom Tag. Kept in the pack; the puppet report prints the angle between the game's flat target and `Qc·edge` per φ so the motion PM can see where they disagree (§8.1). If `edge` is ever authored, `edgeFromClip` mixes `Qc_cmd·edge` (world via `this.yaw`) into `flatTarget` before the `moving` blend, weight `c(S)`. |
| `openness`, `guardGap` | `f.strike.openness/guardGap` | pass-through for the viewer and validation (R5's AI reads body signals, not these — doc §5-2) |
| `recoverTo`, `endPose.next` | `f.strike.homePad`, `f.strike.nearGuards` | §5.7 |

Left clips are already mirrored by the motion PM; `fighter.side` is always +1 (`fighter.js:157`), so no runtime mirroring.

### 4.4 Grid, interpolation, derivatives, blending

`buildAtlas`:
1. Per clip invert `t(φ)` (piecewise linear on marks) and resample every driven channel onto `PHI_GRID = −1 … 2.2 step 0.01` (321 points) with PCHIP in `t`; directions by slerp between neighbouring 120 Hz samples; yaw channels unwrapped.
2. Per grid point compute `v′ = dv/dφ`, `v″` (5-tap SG); directions: angular velocity/acceleration vectors from the slerp derivative.
3. Store `T(φ)` per size and `dT/dφ`.

`atlas.sample(out, req)` with `req = { cut, side, phi, S, cutB, wAB }` (no allocation; `out` is a preallocated struct of Float64 fields):
- **Size blend, two segments** (clip_format §4): `S ≤ sizeMid 0.5 → u = S/0.5, small↔medium`; `S > 0.5 → u = (S−0.5)/0.5, medium↔large`. Scalars/positions lerp, yaw on unwrapped degrees, **directions slerp**.
- **Family blend** (`cutB`, `wAB`, same φ and S): same rules. Format guarantee: same φ marks across cuts.
- **Cell interpolation**: quintic Hermite from `(v, v′, v″)` at both grid ends → C² positions/angles; returns `v`, `dv/dφ`, `d²v/dφ²` per channel so the drive forms `ẋ = v′·φ̇`, `ẍ = v″·φ̇² + v′·φ̈`.
- **Size continuation beyond large** (`over > 0`, any φ; wind `overWind` or stroke `Sstroke − 1`, §3.4): `out.ch += over·(large − medium)` for **every** driven channel (scalars, positions, angles; directions `sword`, `elbowPole*` by scaling the medium→large rotation vector by `1 + over` — slerp with t > 1). Gain 1 = the size axis simply continues; nothing is frozen at the large pose. Unclamped; the soft limits (§5.5), the reach clamp (counted, §4.6) and the muscles are the only walls. Doc §2-2 (1): extra drag is a bigger wind.
  - **What `over` counts**: medium→large steps — one unit adds one `(large − medium)`. The wind gives it as pad distance beyond `sL1` (one unit per 0.215 m, §3.4), the stroke as `Sstroke − 1`, and `sample()` adds any `S > 1` it is handed (`over += S − 1`). One unit of S beyond 1 therefore adds one step, half the per-unit-S slope of the medium→large segment (there 0.5 S is one step); gain 1, no cap (구현 9/29: gesture.js `over = max(overCut, Sstroke − 1)`, atlas.js `sample()`/`sizeU`, `4025ed7`).
  - **Time, marks, step past large**: `t(φ)`, `dT/dφ`, the marks, `step()` and `timing()` continue with the same rule as the channels, `large + over·(large − medium)`, gain 1, no hold; direction ω under `over` is the closed-form slerp rate (구현 9/29: `4025ed7`, `b8e84b2`). A mark interval that is shorter at large than at medium reaches 0 at a large `over` (tr→tc at over 5.00 in v0): `atlas_check` reports it, nothing clamps it.
- Cost: 4 grid lookups × 37 channels × 3 quantities ≈ 450 multiply-adds → target ≤ 0.02 ms (gate ≤ 0.05; `atlas_check.mjs` prints the measured time and allocation count — the 0.02 ms is an estimate until it does).
- `atlas.timing(cut, side, S)` → `summary.time` blended; `atlas.step(cut, side, S)` → `{fwd, side, liftPhi, landPhi}` with small = `{0, 0, 0.178, 0.833}`; `atlas.recoverTo/startFrom/nearGuards(cut, side)`; `atlas.has(cut, side)`; `atlas.report`; `atlas.meta[id]` (sources, provenance, sha1).

`squad`/min-jerk from the doc are not needed: frames come from the yaw/lean/side scalar splines; sword/poles are directions (no roll) → slerp. Deliberate deviation, noted.

### 4.5 `CONFIG.ATLAS`

```js
export const ATLAS = { source: 'pack', pack: 'v0', format: 'stillness-motion-clip/2', indexFormat: 'stillness-motion-index/1', packFormat: 'stillness-atlas-pack/1',
  families: ['zornhau', 'oberhau', 'mittelhau', 'unterhau'], reserved: ['zwerchhau', 'schielhau', 'scheitelhau', 'krumphau'],
  hz: 120, phiStep: 0.01, sgWindow: 5, sizeMid: 0.5, smallTol: 0.02, vecStepMaxDeg: 20, strict: true };
```

### 4.6 Reach report (from the fixed shoulder; the numbers below are the spec author's one-off computation — `atlas_check.mjs` prints them and W3 relies on the printed table, not on this paragraph)

`|handS − (0,0.1,0.2)| − 0.565`, worst frame: zornhau L/M −0.1/−2.1 cm, oberhau −0.4/−0.4, mittelhau −2.1, unterhau −2.1 (all reachable); small (= game guards) +1.7…+3.9 cm at langort-like poses is today's own saturation. Off hand +2.4 cm at pflug is today's behaviour. Elbow-pole flips: mittelhau_large at 0.88 s and 1.07 s (hysteresis §6.4). Runtime: `f.strike.stats.reachClamp++` and `reachClampMax` whenever `fighter.js:1935 const d = THREE.MathUtils.clamp(D.length(), 0.08, a + b - 0.005);` clamps while S > 0 (never silent scaling).

---

## 5. `src/strike/drive.js` — ClipDrive: trunk, anchor, feed-forward, ranges, feet, step

### 5.1 API

```js
export class ClipDrive {
  constructor(fighter, atlas)
  update(dt)                 // ges → cmd (sample at (fam, side, phiB, S); carry-over; no-wind start φ_align / −autoWindPhi; size continuation; warp; step request). S === 0 → w = 0, return
  get w()                    // = ges.S (0 ⇒ every hook below is inert); exact 0 guaranteed by the gesture snap (§3.3)
  get c()                    // = smoothstep(0, DRIVE.mixX, S): guard↔clip crossfade (doc §2-2 (2): S blends sizes, not guard vs clip)
  get stepping()             // requestStep issued and not yet landed
  mixBody(bp, bv, dt)        // updateBodyPose end
  anchorYawRelax()           // 1 − DRIVE.anchorRelaxYawK·S·cmd.balanceAssist  (balanceAssist ≡ 1 in R2; R4's φ-table, doc §4-1)
  twistLim()                 // 0.8 + (DRIVE.spineTwist − 0.8)·S
  applyTorques()             // after applyPose: τ_ff chain, soft limits, jointSetLimits
  footPivot(l, dt)           // gait.pinFeet: l.yaw = yawTD + Δclip·S (re-based per plant, no rate limit); heel floor
  requestStepIfDue()         // inside update()
  script(phi, S, fam, side)  // tests: bypass gesture (puppet, gates)
  // drive_arm.js (mixin)
  mixHand(handLocal), mixAim(aim), shoulder(S), pole(pole, Dn, flex), rateLim(base), cocontract(), armFF(j), onResult(kind, info)
  debug                      // §5.8
}
```

`cmd` (preallocated): `S, c, over, mode, phi, phiDot, phiDDot, pelvisYaw, pelvisYawDot, pelvisYawDDot, chestYaw, chestYawDot, chestYawDDot, pitch, pitchDot, drop, dropDot, side, sideDot, qChestCmd (facing-local), wChestCmd[3] (world angular velocity of the commanded chest frame, §6.2), handS[3], handO[3], sword[3], swordDot[3], edge[3] (report only), poleS[3], poleO[3], girdleS[2], balanceAssist (1), foot{stance,swing}{yaw,lift}, step{fwd,side,liftPhi,landPhi}, warp[3]`.

### 5.2 Sampling and carry-over (`update`)

```
g = f.ges; S = g.S; if (S === 0) { w = 0; if (wasActive) restoreOnce(); return }     // exact 0 (snap, §3.3)
phiB = g.mode === 'stroke' ? (g.input === 'stroke' ? −autoWindPhi : phiAlign) + g.phi : g.phi   // §3.5 / §3.10
atlas.sample(A, { cut: clipOf(g.famA), side: g.side, phi: phiB, S, cutB: clipOf(g.famB), wAB: g.famMix })
phiStart = g.mode === 'wind' ? 0 : phiB at the cut start                 // φ_align (A) / −autoWindPhi (B), §3.5 / §3.10
if (g.state >= CUT && phiB − phiStart < carryPhi):                      // cut-start carry-over (mustFix 6), both modes (§3.5)
   k = 1 − sj((phiB − phiStart) / carryPhi)                             // fade coordinate = phase since the cut start
   every linear channel X (handS, handO, girdle*, pelvisYaw, chestYaw, pitch, drop, side, feet, …): A.X += (Arev.X − A0.X)·k
   directions d (sword, edge, poleS, poleO): A.d = R(k·r)·A.d, ω = R(k·r)·ω + r·k′   where r = rotation vector A0.d → Arev.d
   (Arev = sample at phiRev, A0 = sample at phiStart, both taken once at cut start with the locked S)
apply size continuation: A.X += g.over·(large.X − medium.X) (§4.4)
convert to game units/signs (§4.3) → cmd; qChestCmd = Qc(cmd.chestYaw, cmd.pitch, cmd.side); wChestCmd from the three rates; cmd.balanceAssist = DRIVE.balanceAssist(phiB) (= 1)
aimWarp(); requestStepIfDue(); fill debug
```
(구현 9/29: atlas.js `carryOver(out, rev, base, phi, carryPhi)` rotates directions by `R(k·r)` with the closed-form rate `ω = R(k·r)·ω + r·k′`; the earlier `slerp(A.sword, q_res·A.sword, k)` differs by up to 6.7° on the sword and 26° on `elbowPoleO` near anti-parallel, `39c7e94`. The helper takes the fade coordinate from its caller: for the φ_align / −autoWindPhi starts W3 passes `phiB − phiStart` and `base = sample(phiStart)`. The earlier `g.mode === 'wind'` gate contradicted §3.5, §3.10 and W4's hitch gate, which carry over in both modes; which sample stands for `Arev` at a stroke start (§3.5's residual offset) is W3's to fix. The direction α under carry-over is a linear approximation — W3/W4 must not consume it.)

### 5.3 Trunk and pelvis: timetable instead of filters; anchor

Hook — `fighter.js:605 updateBodyPose(dt)` unchanged except one line before `651 this.pelvisYawOffset = bp.pelvisYaw;`:
```js
if (this.drive?.w > 0) this.drive.mixBody(bp, bv, dt);
```
`mixBody` (c = `smoothstep(0, mixX 0.25, S)`, the guard↔clip crossfade; the size inside `cmd` is already S):
```
for key of [pelvisYaw, chestYaw, pitch, drop, side]:     // side: guard share is 0 (no guard channel)
  bp[key] = bp[key] + (cmd[key] − bp[key])·c           // lerp(guard value through follow(), clip value, no filter)
  bv[key] = bv[key] + (cmd[key+'Dot'] − bv[key])·c     // derivative mixed too → follow() takes over continuously when S falls
```
Why two weights: with one weight the pose at S 0.5 was half guard-map, half medium clip — 50 % of the clip's excursion beyond the guard hull, the '자세표 손 ↔ 클립 손' blend doc §2-2 (2) rejects. With `c` the pose is 100 % clip from S 0.25 up (small↔medium at u 0.5 there) and S alone says how big; below 0.25 `c` keeps continuity with `guardAt(finger)` (c(0) = 0, so S = 0 is untouched). `mixX 0.25` is a crossfade width, listed under §10 transparency.
The guard share still passes `follow()` (`fighter.js:612-615`, w = `SKILL_BODY.pelvis 34`/`chest 26` × spd); the clip share bypasses `follow()`, `COMMIT.pelvisRate`, `holdSpeed` (doc §2-2 (3)(a)). `pelvisTgt` (commit branch, dead) is not touched.

Anchor — `fighter.js:1321-1324`:
```js
for (const ax of MOTOR_AXES) {
  const r = this.uprightRelax(ax) * (ax === MOTOR_AXES[2] && this.drive?.w > 0 ? this.drive.anchorYawRelax() : 1);   // yaw only; anchorYawRelax = 1 − 0.9·S·balanceAssist(φ) (R2: balanceAssist ≡ 1)
  raw.jointConfigureMotorPosition(this.uprightJoint.handle, ax, 0, BODY.uprightStiffness * assist * r, BODY.uprightDamping * assist * (ax === MOTOR_AXES[2] ? this.uprightRelax(ax) : r));
```
i.e. stiffness `2500 → 250` at S = 1 on yaw; damping stays `330` (rate servo toward the commanded anchor rate, since `anchorQ` at `fighter.js:1310` follows `pelvisYawOffset` = the commanded pelvis yaw after `mixBody`). Pitch/roll axes untouched (fall protection). `uprightJoint` is `JointData.generic(…, axis (1,0,0))` (`fighter.js:367-368`); yaw = AngZ = `MOTOR_AXES[2]` (probe).

### 5.4 Feed-forward torque chain (`applyTorques`, after `applyPose`)

Acceleration commands from the atlas: `α_chest = chestYawDDot = v″·φ̇² + v′·φ̈`, `α_pelvis` likewise, `φ̈ = ges.phiDDot`. Inertias per step (point-mass sums + own terms, no allocation; same style as `fighter.js:1607 gravityTorque(bodies, pivotBody, localX, out)`):
- `I_aboveChest` = Σ m·r⊥² + I_own over {chest, head, uarmS, farmS, uarmO, farmO, sword(if armed)} about the vertical through the chest joint (`fighter.js:81 at [0, 1.2, 0]`); `I_aboveAbd` adds abdomen (own 0.11 + 0.4 added at `fighter.js:289`) about the abdomen joint (`:80 at [0, 1.06, 0]`); `I_pelvis` 0.13.
- Pairs (child +, parent −), all × `ffGain 0.8 × S`, each capped `|τ| ≤ j.max·mus` (abdomen 500, chest 440, thighs 560 — the same physiological cap, Q4):
  - chest joint: `τ2 = I_aboveChest·α_chest` about the chest body's local y (world) → `chest +τ2`, `abdomen −τ2`
  - abdomen joint: `τ1 = I_aboveAbd·α_chest` → `abdomen +τ1`, `pelvis −τ1`
  - hips (`DRIVE.ffHip true`): `τh = I_pelvis·α_pelvis + τ1` → `pelvis +τh`, split onto stance thighs `−τh·share` by `gait.legs[k].stance` (equal split when both planted; all on one when one is swinging; levitate/no gait: reaction to the kinematic anchor = ground, i.e. `pelvis` only)
- Sizing (order of magnitude; `I_aboveAbd`, `I_arm` are computed per step from the bodies and printed by `chain.mjs` — the values here are the spec author's estimates): large Zornhau chest −11.2 rad/s (measured on the clip) in 0.21 s → α ≈ 100 rad/s²; `I_aboveAbd ≈ 1.5` → τ1 ≈ 120 N·m (24 % of 500). Under the finger clock φ̇ is larger and α scales with φ̇², so the `j.max·mus` cap engages earlier — counted in `debug.ffCap`, never widened. Deceleration φ 0.6–1.0 (α ≈ +66) is fed forward too = the intentional trunk brake that hands momentum to the arm (doc §2-3).
- Interaction with the anchor: exact τ_ff ⇒ relative rate ≈ 0 ⇒ anchor torque ≈ 0; residuals are corrected by k 250 + d 330. `debug.tauAnchor = k·err + d·(ω_anchor − ω_pelvis)` (recomputed from the same inputs) and `P_anchor = tauAnchor·(ω_anchor − ω_pelvis)` show what the invisible hand still does; `pelvisLag = wrap(pelvisYawAct − pelvisYawCmd)`.
- Staging (W3 debugging order, not a selection): `ffGain` 0 → 0.4 → 0.8 and `anchorRelaxYawK` 0 → 0.5 → 0.9, each stage run through `fights12.mjs` seeds 1/13/25 at 60/120 Hz with falls/NaN/glitch counted and `pelvisLag` at S = 1 (script φ, clip pace) ≤ 10°. **The shipped values are the doc's 0.8 / 0.9.** If falls rise at a stage, the cause is found (τ_ff sizing, anchor interplay, a sign) and fixed; if what remains is the physics of a big cut being easier to topple, that is an opening and is reported under Q24 with the fall numbers — a lower value is never chosen by the implementer (hard rule).

### 5.5 Ranges and soft limits (Q5 default allow)

- `fighter.js:1542 const twist = THREE.MathUtils.clamp(chestYaw - (this.state === 'stand' ? bp.pelvisYaw : 0), -0.8, 0.8);` → `const tl = this.drive?.twistLim() ?? 0.8;` … `clamp(…, -tl, tl)` (0.95 at S = 1).
- `fighter.js:1544-1545 spine('abdomen', bend * 0.5, twist * 0.45); spine('chest', bend * 0.5, twist * 0.55);` → the `spine` lambda (`:1543 J[name].target.setFromEuler(_eu.set(0, yaw, pitch, 'YXZ'))`) gets a third argument `roll = bp.side * DRIVE.sideShare` (0.5 each); `bp.side` is 0 unless the drive wrote it, so the S = 0 Euler is bit-identical.
- Joint limits per step in `applyTorques` while S > 0: `raw.jointSetLimits(handle, MOTOR_AXES[1], −L, L)` with `L = base + (wide − base)·S` for abdomen (0.5 → 0.55), chest (0.6 → 0.7), thighF/B y (`GAIT.hipTwist` 0.9 → 1.1 in hybrid; 0.6 → 0.8 in levitate); the raw call exists (`rapier_wasm3d.d.ts:599`, used at `fighter.js:353`). When S returns to 0: one restore to the constructor literals, then never touched again.
- Soft limit (S > 0 only): from `softLim 0.15 rad` inside the widened limit, `τ = −kSoft·S·(|q| − (L − 0.15))₊·sign(q) − dSoft·ω` about the joint's y axis as addTorque pairs; `kSoft` spine 400, hip 600, `dSoft 20` (ω_n·dt = 0.23 at 120 Hz, §Appendix B). Anti-bounce, not a speed limit.
- gait: `gait.js:713 l.yaw1 = pel + clamp(wrap(l.yaw1 - pel), -GAIT.swingTwist, GAIT.swingTwist);` → `±(GAIT.swingTwist + (DRIVE.swingTwist − GAIT.swingTwist)·S)` (0.6 → 1.0); `gait.js:252 lim = Math.min(lim, Math.max(0, GAIT.maxTwist - tw));` → `GAIT.maxTwist + (DRIVE.maxTwist − GAIT.maxTwist)·S` (0.9 → 1.1). `COMMIT.hipRoom` lives only in the dead commit branch; `DRIVE.hipRoom 1.1` is the soft-limit centre of the pelvis command.

### 5.6 Feet: pivot, heel, passing step (Q5, Q7)

**Role mapping.** Clip: sword foot `R` is rear at t0 (`step.from [−0.26, 0.15]`) and passes; `L` is the stance foot (yaw −10° → −45° at tf). Game guard (`gait.js:626 guardSpot`): `F` (sword foot) is front, `B` rear; `requestStep` passes the rear foot (`gait.js:411 next = this.req.kind === 'lunge' ? front : front === 'F' ? 'B' : 'F'`). So: **stance-role channels ← clip foot ≠ `step.foot`; swing-role channels ← clip `step.foot`**, assigned each step to whichever game leg is planted/swinging. The stance discrepancy is reported to the motion PM (§11), the gate checks landing time only.

**Pivot** (`gait.js:975 pinFeet`, before `1039 let ye = wrap(l.yaw - l.footYaw);`):
```js
if (dr?.w > 0 && l.stance) dr.footPivot(l, dt);
```
`footPivot`: the drive keeps per leg `{ yawTDSeen, phiRef, clipRef }`; when `l.yawTD` changed since last step (new plant / slip reset, `gait.js:770`), re-base `phiRef = phiB`, `clipRef = clipYaw(phiRef)`. `l.yaw = l.yawTD + (−D2R)·(clipYaw(phiB) − clipRef)·S` — written directly, **no rate limit**: the re-base makes the target continuous at every plant (Δ = 0 there), S is continuous, and a family change is crossfaded (`famBlendT`), so there is no jump to hide. (The earlier `footYawRate 8` would have bound: the clip's stance/swing foot rates are 2.9 / 4.7 rad/s at clip pace and scale with φ̇ — 6.6–14.6 rad/s at finger 12–20 m/s under the doc clock, more under the finger clock.) The existing friction torque limit `gait.js:1038 const lt = GAIT.pinMu * l.Nf * 0.05;` and the yaw clamp `:1040-1043` stay as the physics that decides whether the foot actually follows; `stats.footSlipMax` records the largest clamp. Toe pivot: `lever = 0.05 + (DRIVE.toeLever 0.02 − 0.05)·S` when `l.heel > 0.3` (ball-of-foot contact patch; S-scaled so S = 0 is the literal 0.05). When S → 0 the drive stops writing and `l.yaw` stays wherever friction left it (existing semantics).
Heel: after `gait.js:810 l.heel += (heel - l.heel) * 0.3;` add `if (dr?.w > 0) l.heel = Math.max(l.heel, dr.cmd.foot[role].lift * GAIT.heelMax * dr.w);` (identity at S = 0 since `l.heel ≥ 0`). `toePivot` (`:811`) then moves the pin to the toe.

**Passing step** (`requestStepIfDue`, inside `update`): once per cut, on the first step where `state === CUT && S > stepS 0.3 && fam locked && f.gait?.active` (i.e. at cut start, or the moment S crosses `stepS` in a rising (B) stroke; not gated on `liftPhi` — the request itself takes a step to be picked up by `gait.js:409-413`, and at finger speed the clip's lift φ 0.14 is 6 ms after the reversal):
```js
Tclip = (step.landT − step.liftT)                       // the clip's own swing time (large 0.242 s), blended by S (small: 0.655 × 0.30 = the small clip's lift→land)
ok = f.gait.requestStep({ kind: 'strike', fwd: step.fwd * DRIVE.stepScale, side: step.side, duration: Tclip * (phiDotClip / max(phiDot, 1e-3)), hold: DRIVE.stepHold 0.25 });
if (!ok) stats.stepRefused++; else { stepping = true; debug.tStepReq = t; }
```
The requested duration is the clip's swing compressed by how much faster than the clip the finger is driving φ (`phiDotClip` = the clip's mean φ̇ over lift→land, 2.9 /s for large); **no floor**: `gait.js:226 duration: clamp(o.duration ?? 0.4, 0.28, 0.7)` → `o.kind === 'strike' ? Math.max(o.duration, 1e-3) : clamp(…)`. Physics then decides when the foot lands: `gait.js:818 u = clamp(l.t / l.T, 0, 1)` puts the target at the landing spot at once and `:834 const mv = GAIT.swingVmax * f.lastDt;` (pre-existing, 6 m/s, Q7) limits the ankle — 0.78 m needs ≥ 0.13 s, so at finger speeds (φ 0→0.85 in 23–78 ms under the finger clock) the foot lands **after** tc by construction; that is the human limit the doc's Q7 mentions (a real passing step takes 0.25–0.35 s), not a scripted delay, and the trunk/hand chain does not wait for it. `debug.tLand − t_tc` is recorded per stroke; the gate is PASS/FAIL only at scripted clip pace (`drive.script`, §8.1-3: landing within tc ± 50 ms in ≥ 80 %), and at finger speeds 4–20 m/s the distribution is **reported** (median, p90) with no threshold. Other gait.js changes (all `kind === 'strike'` only): `:686 const x = r.kind === 'lunge' ? r.fwd : Math.max(0.3, r.fwd - 0.1);` → `r.kind === 'strike' ? r.fwd : (…)`; `:687 const z = r.side + (r.kind === 'pass' ? l.side * GAIT.guardWidth : 0);` → `(r.kind === 'pass' || r.kind === 'strike')`. Refusals (`:223 !GAIT.requestSteps || !this.active || state !== 'stand'`, `:225 move.y < −0.1`) are counted, never retried silently. `gait.js:742 this.onTouchdown(l.k, strength, kind)` (empty at `:750`) → `if (kind === 'strike') this.f.drive?.onLanded(l.k)` → `landed = true`, `stepping = false`, `debug.tLand`. `skill.lunge` merge per §3.8-5. **Owner-visible:** this step is joystick-independent and fires for any stroke with S > 0.3, including a no-wind pflug stroke in (A) and every big stroke in (B) — 0.23 m at S 0.3 up to 0.78 m at S 1 (`stepScale 1.0`; the doc's Q7 quoted 0.5 m); stated under Q7 in §10 and in §11.

### 5.7 recoverTo → auto-return home

At cut start the drive publishes `f.strike.homePad = PAD_OF[atlas.recoverTo(cut, side)]` (pflugL `[−0.18,−0.28]`, pflug `[0.18,−0.28]`, ochsL `[−0.22,0.26]`, ochs `[0.22,0.26]`; table from guards.js pads) and `f.strike.nearGuards = endPose.next` (Skill's return and the viewer only — `ai.js` derives what it needs from the visible body through `ai_sense.js`, doc §5-2); cleared (`null`) when Skill's return finishes or the finger takes over (`skill.js:508 if (f.inputActive || !canRecover) this.recovering = false;`). Skill uses it via §3.8-6. Only ever set after S > 0, so the S = 0 path never sees it. The return speed itself (`SKILL.recoverSpeed 1.2`) is Q17.

### 5.8 `drive.debug` (preallocated Float64 fields; chain.mjs reads every step)

`t, state, S, mode, phiF, phiB, phiDot, fam, side, handCmdW[3], handActW[3], handErr, aimCmdW[3], aimErrDeg, pelvisYawCmd, pelvisYawAct, pelvisLag, chestYawCmd, chestYawAct, chestLag, ffAbd, ffChest, ffHip, tauAnchor, P_anchor, L_trunk (= I_aboveAbd·ω_chest), L_arm (I_arm·ω_arm about the shoulder), stepReq, landed, tLand, warp, reachClamp, poleFlip, rateClip` + gesture's `tCut, o, w`. Every §3-3 feel target of the doc maps to one recording (§8).

### 5.9 `CONFIG.DRIVE` (first values)

```js
export const DRIVE = {
  on: true, trunk: true, hands: true, ff: true, feet: true, step: true,          // staged enable (physics §2-8); all true when shipped
  ffGain: 0.8, ffHip: true, cocontract: 0.5, motorRate: 40, shoulderRate: 40, motorRateAll: false,   // Q4 (motorRateAll A/B → Q17); ffGain is the doc's value, never down-tuned for falls (§5.4)
  anchorRelaxYawK: 0.9, anchorRelaxYawD: 0.0,                                     // Q24 (R4 raises D relax)
  balanceAssist: { phi: [-1, 0.55, 1.6, 2.2], v: [1, 1, 1, 1] },                  // doc §4-1 seam: identity in R2; R4 sets [1, 0.5, 0.5, 1] (release→follow 0.5, recover 1)
  mixX: 0.25,                                                                     // guard↔clip crossfade width c(S) = smoothstep(0, mixX, S); S itself is the size (§5.3)
  spineTwist: 0.95, absTwist: 0.55, chestTwist: 0.7, hipTwist: 1.1, hipRoom: 1.1, swingTwist: 1.0, maxTwist: 1.1, softLim: 0.15, kSoft: { spine: 400, hip: 600 }, dSoft: 20, sideShare: 0.5,   // Q5
  girdle: 'off', girdleRate: 0.5,                                                 // 'anchor' = experiment; girdleRate is a shoulder travel rate (0.06 m in ≥ 120 ms) → Q5 if 'anchor' is enabled
  poleHystDeg: 120, poleHystT: 0.03, poleBlendT: 0.04, poleMinFlexDeg: 20,        // ≤ 70 ms elbow-shape lag on the fastest roof winds (§6.4)
  carryPhi: 0.3, warpMax: 0.25, warpFade: 0.03,                                   // warp = assistance knob, not a limit
  stepS: 0.3, stepScale: 1.0, stepHold: 0.25, toeLever: 0.02,                     // Q7 (no duration floor, no foot-yaw rate: §5.6)
  handOnStroke: true,                                                             // Q3 answered: hands join no-wind strokes (φ_align / autoWind + carry-over); false = fallback only
  edgeFromClip: false,                                                            // §4.3: edge is derived in the clip; the game's own hitPointVel is the truer source
  puppet: false,                                                                  // or clip id
};
```

---

## 6. `src/strike/drive_arm.js` — hand in the commanded chest frame, aim, IK

### 6.1 Hand target (`fighter.js:1688 driveSword`)

```
1694  const off = this.skill.aim;                       (guard share: filtered aim, unchanged)
1702  const G = guardAt(off.x, off.y, this.guardPose, this.finish);
1703…1718  guard/thrust/commit(dead) overlays           (unchanged)
1719  handLocal.x = Math.min(handLocal.x, this.closeReach());     ← guard share only; AFTER this line:
   +  if (this.drive?.w > 0 && this.drive.handOn) this.drive.mixHand(handLocal);
1721  const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));
1722  if (mus >= 0.12 && this.state !== 'dead') this.armIK(target);
```
`handOn = mode === 'wind' || DRIVE.handOnStroke` (true by default → always on while S > 0). `mixHand`: `hClip = qChestCmd · (cmd.handS + cmd.warp)` (facing-local, commanded trunk — measured chest would close a hand→shoulder-reaction→chest→hand loop, doc §2-2 (3)(b)); `handLocal += (hClip − handLocal)·c` with `c = drive.c` (the crossfade; the clip hand inside `cmd` is already the S-sized one, §5.3). World hand velocity = chest rotation × radius + arm-relative velocity. `closeReach` (`:1719`) and the pad-disc clamps (`skill.js:399`, `:462`) touch only the guard share.

### 6.2 Aim

After `fighter.js:1745 if (cp.plane > 0) this.cutPlane(aim, cp);` and before `1746 aim.applyQuaternion(this.yaw);`:
```js
if (this.drive?.w > 0 && this.drive.handOn) this.drive.mixAim(aim);   // slerp(aim, qChestCmd·cmd.sword, c)
```
`wAim` (`:1748-1752`) keeps R0's `STRIKE.wristRel` (forearm-relative 60 rad/s; the clip's sword rate at tr–tc is printed by `atlas_check.mjs` — the 26–27 rad/s quoted earlier is an estimate). When S > 0 the drive supplies the world rate of the commanded aim, **both terms**: `wAim = lerp(diff, R·(swordDot × φ̇) + wChestCmd, c)` where `R = this.yaw·qChestCmd` and `wChestCmd` is the world angular velocity of the commanded chest frame (`yaw·(chestYawDot·ŷ_facing + pitchDot·ẑ_lean + sideDot·x̂_side)`, built in `update()` from the three rates, §5.1). The frame term dominates on a large zornhau (chest −11 rad/s vs the sword's own rate in the chest frame), so omitting it would aim the wrist damping at the wrong rate. Explicit late wrist release, the off-hand lever and `RIGHT_LOCAL` flat target (`:1771`) are unchanged in R2 (R3).

### 6.3 Aim warping (≤ 0.25 m, assistance knob)

For φ ∈ [φr − 0.05, φg]: predicted hand at φc `hc = Qc_cmd(φc)·handS(φc)`; target zone by family (zornhau/oberhau → head–chest line at `COMMIT.planeK 0.5`, mittelhau → shoulder line, unterhau → abdomen/arms) from `foe.bodies.head|chest.translation()` in facing-local (reuses `fighter.js:1881 cutPlane` geometry); `warp = clampLen((zone − hc) ⊥ sword(φc), warpMax)`, envelope `env(φ; φr−0.05 → φc rise, hold to φf, fade to φg)` (`skill.js:55 env`); `onResult` (§6.7) fades it to 0 in `warpFade 30 ms`. No foe → 0.

### 6.4 Shoulder and elbow pole (`fighter.js:1925 armIK`)

Refactor: `armIK(target)` becomes a wrapper around a pure `solveArmIK(T_chest, S_sh, pole_chest, out)` (`out = { qUarm, flex, elbow[3], hand[3], d, clamped }`, no side effects) so the drive can call it three times per step (§6.6) and the puppet can call it kinematically.
```
1931  const S = _ik2.set(0, 0.1, this.side * 0.2);     → if (dr?.w > 0) dr.shoulder(S);   // 'off': no-op (default). 'anchor': S += (prot, lift, 0)·w and joint.setAnchor1 by the same vector
1938  const pole = _ik3.set(-0.25, -1, this.side * 0.5).normalize();  → if (dr?.w > 0) dr.pole(pole, Dn, flex);
```
`pole(pole, Dn, flex)`: `pNew = normalize(lerp(pole, R_actualChest⁻¹·yaw·Qc_cmd·cmd.poleS, w))`; projection `pDirNew = pNew − Dn(pNew·Dn)`. Hysteresis: flip candidate if `|pDirNew| < 0.25` or `angle(pDirNew, pDirPrev) > poleHystDeg 120°`; a candidate keeps `pDirPrev` until it persists `poleHystT 30 ms` **and** `flex > poleMinFlexDeg 20°` (pole is meaningless on a straight arm), then slerps over `poleBlendT 40 ms`. Roof-pose poles pass 90° (large tw `elbowPoleS [0.58, 0.47, 0.67]` vs small `[0.36, −0.93, 0.09]`), so the hysteresis is mandatory; `stats.poleFlip` counts adoptions. Cost stated: on the fastest roof winds the elbow shape can lag the hand by up to `poleHystT + poleBlendT` = 70 ms (the hand is already overhead while the elbow is still down/back) — a visible-shape delay, not a hand-speed limit; listed in §10 transparency with `poleFlip` reporting. Reach `a + b − 0.005 = 0.565` unchanged (`:1932-1935`); clamps counted (§4.6).

### 6.5 Off arm

`fighter.js:1981 gripAim = aimDirW·along + st` unchanged (lever = R3, Q6). `offArmIK` (`:2006`): pole `:2018` ← `cmd.poleO` with the same hysteresis; shoulder `:2012` ← `girdleO` only in `'anchor'` mode. With the clip aim the off hand already lands at `handO` (= `handS + sword·(−0.14)`, format §3-6).

### 6.6 Motor rates, co-contraction, arm feed-forward

- `fighter.js:1591 const vz = THREE.MathUtils.clamp((_rv.z - prev.z) * inv, -15, 15);` and `:1596 const v = THREE.MathUtils.clamp((_rv[ax] - prev[ax]) * inv, -15, 15);` → `const rl = dr?.w > 0 ? dr.rateLim(15) : 15;` … `clamp(…, -rl, rl)`; `rateLim(base) = base + (DRIVE.motorRate − base)·S` (15 → 40). `DRIVE.motorRateAll` (test only) applies 40 to everyone (A/B for Q4/Q17).
- `fighter.js:1660 if (wT.length() > 20) wT.setLength(20);` → `const wl = dr?.w > 0 ? dr.rateLim(20) : 20;`. When S > 0, `wT = lerp(wT_diff, ω_des, S)` where `ω_des` comes from `solveArmIK` at `phiB ± Δφ` (Δφ = 0.01; three solves — cost printed by `perf_ab.mjs`, the ≈ 0.005 ms is an estimate): shoulder quaternion differences → ω_des (world), α_des; elbow flex rate `ω_des_flex` and acceleration `α_flex`.
- **Elbow motor target velocity** (doc §2-2 (3)(b): `jointConfigureMotor(target, ω_des, k, d)`): `fighter.js:1591 const vz = THREE.MathUtils.clamp((_rv.z - prev.z) * inv, -15, 15);` → `let vz = (_rv.z - prev.z) * inv; if (dr?.w > 0) vz = vz + (dr.omegaFlex() - vz) * dr.w; vz = clamp(vz, -rl, rl);` so the hinge motor's damping pulls toward the clip's flex rate, not merely toward the finite difference of the target (which lags one step and is quantised by the IK). `rl` is the raised clamp above. At S = 0 the expression is the literal today's `vz`.
- Co-contraction (`fighter.js:1564-1565 const k = j.k * mus * (j.gain || 1); const d = j.d * Math.sqrt(Math.max(0.05, mus)) * (j.gain || 1);`): `uarmS` swing component and `farmS` × `dr.cocontract() = 1 + DRIVE.cocontract·S`; **never** the shoulder twist axis (`fighter.js:1680 clamp(eTw * 25 - wTw * 0.8, -20, 20)`, already at ω·dt ≈ 1 at 60 Hz input framing, Appendix B).
- Arm feed-forward (`fighter.js:1664-1666` `_mT` build): `+ ffGain·S·I_arm·α_des` (I_arm = Σ m·r⊥² of uarmS/farmS/sword about the shoulder + `swordIhand`, ≈ 1.3 kg·m² with a longsword) added **before** the Hill cap `:1676-1678 const cap = maxT * hill(…); if (tlen > cap) _mT.setLength(cap);` — the physiological cap (80 N·m shoulder/elbow, wrist 22) stays (Q4). Elbow: `I_fore·α_flex·ffGain·S` about the hinge axis as addTorque pair (farmS +, uarmS −), before the motor.
- `debug.rateClip` counts steps where the raised clamp still engaged.

### 6.7 Results

`combat.js:565 if (att.commit?.on) att.skill.strikeResult(r.pass ? 'through' : 'hit', r);` → add `att.drive?.onResult(r.pass ? 'through' : 'hit', r);`; `combat.js:467 … f.skill.strikeResult(vn >= 2 ? 'blocked' : 'glance', { vn, impulse: J });` → add `f.drive?.onResult(kind, info)`. R2: ends the warp, stamps `(phi, S)` into `stats.lastResult` for record/1; R3/R4 build on it.

---

## 7. S = 0 invariance

**Claim.** With `GESTURE.on = true, DRIVE.on = true`, for every input in which the finger never winds (`|w| < 0.12`) and never travels along a stroke direction at ≥ `vStrike` from rest (so `Sstroke` stays 0), every physics input (joint targets, motor rates, motor gains, joint limits, torques, foot targets, hand target) is **bit-identical** to today's build with stage A disabled: `GESTURE.on = false, COMMIT.minLevel = 2` (baseline B). Against today's exact config (`GESTURE.on = false`, baseline A) it is identical except inside stage-A windows, listed below.

**Why not `WHOLE.commit = false` (the earlier baseline):** `fighter.js:622 const pf = sk.detect && WHOLE.on && WHOLE.commit ? 0.5 + COMMIT.allSwingPelvis * act : 0.5;` with `COMMIT.allSwingPelvis = 0.15` (config.js:636) — turning `WHOLE.commit` off changes the pelvis target of **every** swing, so that comparison fails by construction. The new build leaves `WHOLE.commit = true`, so `pf` is unchanged versus today.

**Stage A is not physically inert** (correction): `beginCut → this.commit({stage:'A'})` (skill.js:809) sets `cm.on = true` (skill.js:858). `updateCut` then runs (skill.js:406) but its `!cm.padOn` branch keeps `cp.w = cp.wBody = 0` and `cp.plane = 0` (skill.js:1047-1055), so `cutAim`/`cutPlane`/`planeSteer` (fighter.js:1744-1745, 1919) are **not** live. What *is* live during a stage-A window (any arm stroke ≥ `COMMIT.aLen 0.12 m` at ≥ `aSpeed 3 m/s`, until `aTimeout 0.25 s`, a stop, or contact): `combat.js:343` stuck-grab share (`held = COMMIT.stuckHoldFree && (cm?.on || …)`), `combat.js:467` and `:565` `strikeResult` (which in stage A only calls `fadeCut(false)`, skill.js `strikeResult` `!cm.padOn` branch). So baseline A differs from the new build only when a stuck contact or a clash/wound falls inside a stage-A window; `s0_diff.mjs` classifies a first divergence with `baseline.commit.on === true` as **stage-A consumer** (reported, not a failure), and baseline B (no stage A: `commit()` returns false at `!this.canCommit()`, skill.js:547, when `level < minLevel`; detectCommit still runs and writes only `det.*`) must be byte-identical. Re-check after R0's grab rewrite retires `combat.js:343`. Inputs that today would confirm stage B (≥ 0.58 m at ≥ 6 m/s) intentionally become uncapped `Sstroke` strokes (Q3 as answered).

1. `S ≡ 0`: `smoothstep(0.12, 0.55, |w|)` is exactly 0 for |w| ≤ 0.12; `Sstroke = arc0·(strokeLen/Lref)·(v̄/vRef)` is exactly 0 while `strokeLen = 0`, i.e. until a CUT has started (reversal in (A), `|v| > vStrike` from rest in (B)); a decaying S snaps to exactly 0 below `sSnap`. Hence `drive.w = 0` on every step of an input that never starts a cut, and again after any cut has decayed.
2. Gesture writes only `fighter.ges.*` and its own buffers; it reads `handOffset`, `skill.*`, engine state.
3. Every consumer is either gated (`if (this.drive?.w > 0)`: mixBody, mixHand, mixAim, shoulder, pole, applyTorques, footPivot, heel floor, requestStepIfDue, onLanded, homePad) or an identity at S = 0: `rateLim(15) = 15 + 25·0`, `rateLim(20) = 20`, `twistLim() = 0.8 + 0.15·0`, `cocontract() = 1 + 0.5·0`, `anchorYawRelax() = 1 − 0.9·0`, swingTwist `0.6 + 0.4·0`, maxTwist `0.9 + 0.2·0`, toe lever `0.05 + (0.02 − 0.05)·0`, spine roll `bp.side = 0`. IEEE: `x + y·0 === x` and `x·1 === x` for finite y; atlas validation guarantees finite y.
4. `jointSetLimits`, `setAnchor1` are called only while S > 0, restored once on the step S becomes exactly 0 (the snap guarantees that step exists); a round without any wind never touches the engine.
5. `skill.recovering`'s `!(f.ges?.busy)` and `skill.lunge`'s `!(f.drive?.stepping)` are false-guards at S = 0; `homePad` is `null` until a cut ran.
6. After S was > 0 and returned to 0 the state differs (that is the recoil), no identity is claimed; the ±2 cm gate on the S = 0 path is therefore effectively 0 cm.
7. Once R1 lands, the baseline is R1's tip commit (intended latency changes only).
8. When W5 deletes the old commit path (§1.1-U), the flag comparison is replaced by a checkout comparison: the pre-deletion R2 commit (flag off) vs the post-deletion commit, same batteries, byte-identical; `pf`'s condition becomes `sk.detect && WHOLE.on` so its value is unchanged.

**Tests (`tools/sim/s0_diff.mjs`, W5, run at 60 and 120 Hz, three weapons):**
```
new:        node tools/sim/with_config.mjs GESTURE.on=true  DRIVE.on=true  hybrid.mjs wholebody.mjs cuts     (SHAPE=minjerk, arm inputs: no wind, no stroke ≥ vStrike from rest — the 'arm' subset of the detect set)
baseline B: node tools/sim/with_config.mjs GESTURE.on=false COMMIT.minLevel=2 hybrid.mjs wholebody.mjs cuts   → diff of OUT json (tip/hand series, rounds): expected byte-identical
baseline A: node tools/sim/with_config.mjs GESTURE.on=false                   hybrid.mjs wholebody.mjs cuts   → identical except stage-A-consumer steps (classified and listed)
same triple for: live_battery.mjs (default), dance.mjs (default), fights12.mjs seeds 1/13/25/37/49
gesture-flag-off build: node tools/sim/with_config.mjs GESTURE.on=false DRIVE.on=false … vs pre-R2 tip commit  → byte-identical (only imports + `if` lines added)
```
Any difference is investigated by dumping `drive.debug` at the first diverging step; a non-zero S there is a gesture-threshold misclassification (counted against the ≤ 3 % gate, measured as S ≥ `mixX` on the pflug-stroke set), `baseline.commit.on` there is a stage-A consumer (baseline A only), anything else is an S = 0 change and fails.

---

## 8. Puppet mode and R2 gates

### 8.1 Puppet (`src/strike/puppet.js`, `tools/sim/puppet.mjs`, `main.js ?puppet=<clipId>&S=1&loop=1` parsed next to `main.js:1241 params.get('fps')`)

1. **Kinematic retarget check (no physics).** For each grid φ (t0…tg) and S ∈ {0, 0.5, 1}: trunk frames from `pelvis.yaw/drop`, `chest.yaw/lean/side` on the game segment heights (`game_joints.mjs ANCHORS`: hipC 0.93, waist 1.06, chest 1.33, shoulder 1.43), shoulder `(0, 0.1, ±0.2)` (girdle off), `solveArmIK(a 0.3, b 0.27, clip pole with hysteresis)` → FK hand (`farmS` local `(0.13, 0, 0)` = `ANCHORS.hS`), elbow, tip = hand + `sword·(0.13 + 1.05)`; compare with `Qc·handS` and with the clip's own `J` (`hS`, `elS`, `tip`) in the clip frame. Records hand error mean/max (t0…tf and t0…tg), tip error, sword angle, pole flips, reach clamps, the angle between the game's flat target and `Qc·edge` (report only, §4.3), and the **sign checks**: (i) pelvis yaw sign vs the `J` hip line; (ii) drop convention; (iii) `chest.side` — `sign(FK.shS.y − FK.shO.y)` must equal `sign(J.shS.y − J.shO.y)` at the |side| peaks (zornhau_right_large tw +6°, tf −8°; `jointDefs` says only "x = 옆으로 벌리기", fighter.js:75, the direction is unproven) — a mismatch flips the spine-x sign in §5.5, never the clip; (iv) `feet.*.yaw` — over tr→tc the game-unit stance-foot Δ (`−deg·D2R`) must have the same sign as the game-unit pelvis Δ (both pivot toward the cut; clip L −10° → −45° while pelvis.yaw falls), and the clip's rear sword-foot toe-out at t0 (+40°) converted must be the mirror of the game's rear off-foot `−l.side·GAIT.rearToe` (gait.js `guardYaw`), which is the stance mismatch §11-2 predicts — the check confirms the convention, the mismatch itself is role-mapped (§5.6). Run twice: `DRIVE.girdle 'off'` (default) and `'anchor'` (shoulder root + `setAnchor1` offset, `girdleRate` off in the kinematic check), so the R2 row's 'IK 어깨띠' decision has data.
2. **Ragdoll puppet.** All fighter bodies + sword `setBodyType(KinematicPositionBased)` (`rigid_body.d.ts:361`), placed from the FK each step (`setNextKinematicTranslation/Rotation`), legs from `legIK` targets solved kinematically, enemy parked (`G.park()`); `game_joints.mjs jointsOf` → `stillness-motion-record/1` (`kind: 'puppet'`) → `tools/motion/compare.mjs`, `viewer.html` overlay. The camera is the game camera: the owner's first picture.
3. **Tracked.** Physics on, `drive.script(phi, S, fam, side)` replays the clip clock at T0 pace and at 1.5× → tracked record; puppet − tracked = the drive's error.

Gate: hand ≤ **0.03 m** (mean over t0…tf, max reported) for the 24 v0 clips, sword direction ≤ 5°, tip ≤ 0.05 m, all four sign checks pass, reach clamps = the report's known cases only (both girdle modes reported; the gate is on `'off'`). A failure here is a coordinate problem; physics tracking does not start before it passes. §4.3's Qc check (small tw `handS` → `[0.120,0.140,0.201]` vs the guard `[0.12,0.14,0.20]`, re-derived independently within 1 cm) is settled by this gate, not by the table.

### 8.2 Gates as commands (`node tools/sim/r2_gates.mjs [--hz=60,120] [--weapons=longsword,zweihander,saber]` runs all; PASS/FAIL only on minimum targets; speed/energy ratios reported without an upper gate)

| gate | number | command |
|---|---|---|
| Atlas | 24 clips validate; clip/1 fixture and mutated-width fixture throw; small vs guards ≤ 0.02 m; C⁰/C¹ continuity at Δφ 0.001; sample ≤ 0.05 ms | `node tools/sim/atlas_check.mjs` |
| Puppet | hand ≤ 0.03 m, sword ≤ 5°, tip ≤ 0.05 m | `node tools/sim/puppet.mjs --cuts=zornhau,oberhau,mittelhau,unterhau --sides=right,left --sizes=small,medium,large` |
| Gesture | detect set (`wholebody.mjs detect`, 29 inputs × speeds × 60/90/120 Hz), **both input modes**: pflug-stroke misclassification (S ≥ `mixX` on the arm subset) ≤ 3 %, reversal latency 0 steps (A) / stroke start on the first step ≥ `vStrike` (B), same φ̇ across Hz, jitter 3 mm/8 Hz → S = 0, S returns to exactly 0 (snap) after every input, `busy` clears within `restDwell` of the finger stopping | `node tools/sim/hybrid.mjs gesture_eval.mjs --input=wind` and `--input=stroke` |
| S = 0 | byte-identical | `node tools/sim/hybrid.mjs s0_diff.mjs` (§7) |
| Wind follows the finger | drag start → pelvis 5° ≤ 33 ms (60 Hz) / 25 ms (120 Hz); finger step 0.3 m in 50 ms | `HZ=60 node tools/sim/hybrid.mjs chain.mjs zornhau-wind` and `HZ=120 …` |
| Motion size (S = 1, longsword) | wind hand ≥ head top + 0.05 m (overhead cuts), ≥ 0.10 m behind torso front, shoulder elevation ≥ 130° (overhead), blade ≥ 1.0 m behind chest, follow-through hand side ≤ −0.30 m (diagonal) / −0.33 (horizontal, rising), chest range ≥ 120°, pelvis ≥ 65°, X-factor order, hand path ≥ 1.8 m | `chain.mjs` `mx` block (`shape_metrics.mjs` definitions) on the tracked record |
| Tracking | hand mean ≤ 0.08 m after alignment on tc, sword ≤ 15°, hand lag ≤ 40–60 ms (DTW) | `node tools/motion/compare.mjs` on the tracked record |
| Chain / step | pelvis ≤ chest ≤ hand ≤ tip peaks (10 ms tie); **scripted clip pace** (`drive.script`, S = 1, 1.6–2.0 m): landing within tc ± 50 ms in ≥ 80 %; **finger speeds 4 / 6 / 12 / 20 m/s along `dirC`**: `tLand − t_tc` median and p90 reported per speed with no threshold (physics: `GAIT.swingVmax`, §5.6); `stepRefused`, `footSlipMax` reported | `chain.mjs` (`PACE=script` and `SPEED=4,6,12,20`) |
| 60/120 Hz | tip ±3 %, also 24–45 fps jitter | `HZ=… chain.mjs`, `JITTER=1` |
| Stability | AI vs AI 10 min × 60/120 × 3 weapons: NaN 0, glitch 0 (R0 counter), falls not above R1 baseline; miss/hit/blocked | `node tools/sim/hybrid.mjs fights12.mjs`, `weapon_smoke.mjs` |
| Performance | tracking ≤ 0.05 ms/step, normal step CPU ≤ +5–10 %; atlas decode time at load printed (browser console + node), `atlasMissing` = 0 over the battery; enemy `Gesture.update` with no source ≤ 1 µs | `SWITCH=DRIVE.on node tools/sim/perf_ab.mjs` |
| Owner | viewer screenshots puppet ‖ clip and tracked ‖ clip for zornhau/oberhau/mittelhau/unterhau right; test build with the **(A)/(B) switch** in settings (`GESTURE.input`) and the gold trail + 8 ms pulse still firing at the first `c(S) = 1` step of a cut (§3.8-8; R5 moves it to the φr→φf window — the owner is told the trail now means "the body is on the clip", not "cannot stop", so the play verdict is not confounded); **owner play verdict is final** | `film_wholebody.cjs zornhau-wind zornhau-stroke mittelhau-wind pflug-drag pflug-stroke` (new scenes; `-stroke` = (B) for the same finger file), `viewer.html` |

Speed/energy ratio gates (≥ 1.45×, ≥ 2×) belong to R3; R2 records them.

---

## 9. Work breakdown (worktrees, file boundaries, order)

| key | item | files (write) | depends | done when |
|---|---|---|---|---|
| **W1** atlas + pack | `src/strike/atlas.js`, `tools/motion/pack_atlas.mjs`, `src/strike/clips/atlas_v0.json`, `tools/sim/atlas_check.mjs`, `config.js` ATLAS | clips on `main` (`git checkout main -- docs/motion/clips` or read `/home/user/halfsword`) | `atlas_check.mjs` report (§4.2/§4.6); fixtures throw; small vs guards ≤ 0.02 m; sample ≤ 0.02 ms; pack ≤ 1.5 MB |
| **W2** gesture + AI seam | `src/strike/gesture.js`, `config.js` GESTURE, `skill.js:405` (1 line), `fighter.js:233` (1 line), `main.js:344` + `stepT` (§2.3) + `inputScale` (§3.2-4) + `onCommit` call (§3.8-8) + `?input=` param, `harness_m.mjs:211` `stepT`, `ai.js` (`aiSynth`, moveHand push, `planStrike` definition), `tools/sim/gesture_eval.mjs` | R0 `fingerTrace.at` | gesture gate (§8.2) in both input modes; synthetic zornhau path → `famA = diag`, `S ≥ 0.9`, reversal in one step; S snaps to exact 0 after every input; AI rounds unchanged (`GESTURE.ai=false`, no per-step cost) |
| **W3** drive trunk/legs + puppet | `src/strike/drive.js`, `src/strike/puppet.js`, `config.js` DRIVE, `fighter.js` {651, 716-720, 1321-1324, 1542-1545, jointSetLimits in applyTorques}, `gait.js` {226, 252, 686-687, 713, 742/750, 810, 1038-1039}, `skill.js` {504, 510-511, 529}, `tools/sim/puppet.mjs`, `main.js ?puppet=` + atlas preload (§3.8-9) | W1 (`atlas.sample`); W2 replaceable by `script()` | puppet gate first (four sign checks, both girdle modes); then staged enable (§5.4) with `pelvisLag ≤ 10°` at S = 1 script pace, pelvis 5° ≤ 33 ms, falls at the doc's 0.8/0.9 reported (never down-tuned); step landing gate at script pace, distribution at finger speeds; S = 0 diff pass 1 against baselines A and B |
| **W4** drive arm | `src/strike/drive_arm.js`, `fighter.js` {1564-1565, 1591 (elbow `vz` ← `ω_des_flex`), 1596, 1660, 1664-1666, 1719, 1746, 1748-1752 (`wAim` with `wChestCmd`), 1925-1953 (`solveArmIK` split), 2012, 2018}, `combat.js` {467, 565} | W1, W3 `cmd` | tracking ≤ 0.08 m / 15°, hand lag ≤ 60 ms, `poleFlip` 0 unwanted, `reachClamp` = report only; no hand hitch at cut start for wind **and** no-wind strokes (`handOnStroke true`) in both input modes; S = 0 diff pass 2 |
| **W5** gates + owner build | `tools/sim/chain.mjs` (drive/gesture channels, latency, mx, chain, step, `PACE`/`SPEED`, `clock` A/B), `tools/sim/s0_diff.mjs` (baselines A/B, stage-A classifier), `tools/sim/r2_gates.mjs` (+ grep gate: `ai.js` reads no `f.strike`/`f.ges`), `film_wholebody.cjs` scenes (A and B), settings toggle for `GESTURE.input`, `tools/motion` record export for viewer, `docs/motion/records/*`, README table; **last commit**: delete the old commit path and its two unasked limits per `decisions.md` (§1.1-U) after `s0_diff` passes, then the checkout comparison of §7-8 | W2–W4 | §8.2 table at 60/120 Hz × 3 weapons × 2 input modes; screenshots delivered; S = 0 identity report (A/B baselines); old path removed with `pf` unchanged |

Order: **W1 ∥ W2 → W3 (puppet gate, then physics) → W4 → W5** (W5's chain.mjs extension can start with W3's first tracked record). W3 and W4 edit disjoint `fighter.js` regions (605–651/1321/1542 vs 1564–1666/1719–1752/1925–2018); W4 rebases after W3 merges. Seams for later rounds: R3 reads `f.strike.S/phi`, `cmd.swordDot`, `debug.L_trunk/L_arm/P_anchor`, `onResult`; R4 may drive RECOVER's φ 1.6 → 2.2 with its recovery clip, fills `DRIVE.balanceAssist`, scales `anchorRelaxYawD`, `BODY.maxAccel`, adds capture-point steps on `landed`; R5 adds `windup/overrun/thrown` to `ai.js:666 opportunity` **from `ai_sense.js` body measurements** (hand height vs head, chest yaw vs foe, support ratio — never `f.strike`), moves the gold-trail trigger to the φr→φf window, and feeds `SyntheticFinger` from `planStrike`.

---

## 10. Owner-question map (every value that could act as a cap/floor)

Every value in this table that no owner answer covers is an unapproved default until the owner answers; the owner's decision table is `docs/strike/owner_defaults_table.md` (9/29). Rows marked **decided** follow `docs/decisions.md`.

| Q | R2 default relied on | values |
|---|---|---|
| **Q3** — **decided** 9/29 13:00 (no cap; start arc + length *and* speed; (A)/(B) switch) | `Sstroke = arc0 · (strokeLen/Lref_f) · (v̄/vRef)`, unclamped (`over` beyond 1) | `vRef 6 m/s` (= today's `COMMIT.bSpeed`, the only number; `arc0`, `Lref_f` are pad geometry), `handOnStroke true`, `GESTURE.input 'wind'|'stroke'` in the test build, `autoWindPhi 0.3` (the short automatic wind of (B), finger-clocked: 0.165 m of pad), the same passing step for no-wind strokes (Q7) |
| **Q5** — **decided** 9/29 13:00 (allow) | foot pivot and wider ranges | `spineTwist 0.95`, abdomen/chest `0.55/0.7`, `hipTwist/hipRoom 1.1`, `swingTwist 1.0`, `maxTwist 1.1`, `softLim 0.15`, `kSoft 400/600`, toe lever 0.02; **no foot-yaw rate** (dropped: it would have bound above ≈ 1.7× clip pace for the swing-role foot); `girdleRate 0.5 m/s` only if `DRIVE.girdle 'anchor'` is ever enabled (a shoulder-travel rate, 0.06 m in ≥ 120 ms) |
| **Q10** — **decided** 9/29 13:00, done in R0 | the hit check's "discard above 30 m/s" becomes a physics-glitch check (NaN, abnormal acceleration) | R0 `STRIKE.glitchFilter` / `glitchAcc` (an R0 prerequisite, header); no R2 value |
| **Q7** | passing step on, joystick-independent — **also for no-wind strokes** (any stroke with S > 0.3 in (A), every big stroke in (B); 0.23 m at S 0.3 → 0.78 m at S 1) | `stepS 0.3` (below it the blended step < 0.23 m is not requested; the trunk still pivots on the feet), `stepScale 1.0` × clip fwd (large 0.78 m — larger than the 0.5 m quoted in Q7; `stepScale 0.64` gives 0.5), `stepHold 0.25`; **no duration floor** for `'strike'` (the earlier `stepDurMin 0.15` would have bound for finger > ≈ 4 m/s); pre-existing physics/floors: `GAIT.swingVmax 6` (0.78 m needs ≥ 0.13 s, so at finger speed the foot lands after tc — reported, §5.6), pass length `Math.max(0.3, fwd − 0.1)` (`:686`; `'strike'` exact), refusal while retreating `move.y < −0.1` (`:225`), `GAIT.requestSteps` |
| **Q17** (partial) | lighter arm cut is R1's; R2 touches only: auto-return destination `homePad` (recoverTo), `motorRateAll` A/B, `phiW 60` feel | — |
| **Q21** | pad drag beyond the 0.62 m disc, no end (구현 9/29: the 1.0 m pad-extension value is deleted, `b9b1c4a`) | `sL1 0.55` (S saturates; the pose continues linearly through `over` on every channel, gain 1 — no de-facto size ceiling), `sL0 0.12` deadband (nothing whole-body for the first 0.12 m of a drag = 20 ms at 6 m/s, 40 ms at 3 m/s; the doc's value; the ≤ 3 % / jitter gate depends on it), `sectorMax 80°` (straight-down pull is not a wind), `restV/restDwell`, `lateSelect` thresholds; pointer capture is R0/input |
| **Q4** | human strength stays | Hill, `maxAimTorque 22`, shoulder/elbow 80 unchanged; τ_ff capped by `j.max·mus`; motor target-rate `15/20 → 40·S` (not physiology) |
| **Q22** | protective values | R0 `STRIKE.wristRel 60`, `leadMs 40·S`, `phiW 60` |
| **Q1** — **decided** 9/29 13:00 (physics only, no time/brake values) | the command follows the finger; only the body's inertia continues | `clock 'finger'`: `φ̇ = v_along/sL1`, **no `1/T0` floor**; S held only while the finger moves along the stroke, decays with `tauRelease` (Q2's value, no second constant) when it stops/lifts/reverses; no input ignored (ring = origin bookkeeping); RECOVER freezes φ. Kept and declared: family lock after `lateSelect` (a shape choice, §3.4), `leadMs 40·S` (an upper bound on the command *leading* the finger, Q22). The doc's `1/T0 + kv·v` law is `clock 'floor'`, sims only. R4's `brake0/brakeK` must be re-read against this answer too |
| **Q2** | winds free to hold/withdraw | `tauRelease 0.25` (also the post-stroke S decay, §3.7), `vStrike 1.5`, `revDot −0.3` |
| **Q24** | anchor relax | `anchorRelaxYawK 0.9`, `anchorRelaxYawD 0` (R4: 0.7 carry / trunkDampRelax 0.5), `balanceAssist ≡ 1` (R4's φ-table); `ffGain 0.8` — if falls rise at 0.8 / 0.9 the numbers go to the owner here, not down (§5.4) |
| **Q18** | no cooldown | recovery = S decays (`tauRelease`) with φ frozen; a rewind or the next (B) stroke is recognised on the first RECOVER step; the clip's `summary.time.recover` (0.30–0.55 s) is reported for R4's recovery clip, not used as a clock in R2. Declared (구현 9/29: `499a9b7`): until the first RECOVER dwell a finger continuing along `dirC` moves `o` (§3.7), so a +dirC rewind right after a 10–30 ms hitch is not recognised (reported) |
| — | not limits, listed for transparency | `warpMax 0.25` (assistance), `ffGain 0.8`, `cocontract 0.5`, `closeReach` (guard share only), `PHYSICS.maxStepsPerFrame 6` (φ is event-time based), atlas data checks (`vecStepMaxDeg 20` on authored sword directions, v0 max 12.5°; non-finite `phi`/`S`/`over` throw in `sample()`/`sampleSize()`; S < 0 read as 0; the end pose held with zero derivatives outside φ ∈ [−1, 2.2], the clip's data extent), `readFinger`'s velocity gap window (§3.2-2), `sSnap 0.02` (a decaying S below 2 % is 0: truncates an invisible tail so restore/identity re-enter), `mixX 0.25` (guard↔clip crossfade width; above it the pose is 100 % clip), pole hysteresis `30 + 40 ms` (elbow-shape lag on the fastest roof winds, `poleFlip` reported), kneel excluded from S > 0 (clips are standing cuts; anchor fixed at kneel fighter.js:1310, `requestStep` refuses kneel gait.js:223 — the arm cut at kneel is unchanged) |
| Q8 / **Q26** — Q26 **decided** 9/29 13:00; light weapons **decided** 9/29 23:00 | later rounds | Q8 is not set (decisions.md: temperament only); Q26 (physics decides) — no inertia-class threshold anywhere in R2, one-hand sizes (R6); "가벼운 칼 하한 없음" (23:00): no floor for light weapons — the proposed `T0` floor is rejected (`T0` lives only in the sims-only `clock 'floor'`), a wrist flip is a control-law matter, never a floor |

No new owner question is added. Rows marked **decided** carry the owner's answers (`decisions.md` 9/29 13:00: Q1, Q3, Q5, Q10, Q26; 23:00: no light-weapon floor); the rest keep the doc's pending defaults, unapproved until the owner answers in `owner_defaults_table.md`.

---

## 11. What the motion PM must add or confirm in clip/2

1. **Confirm** `pelvis.drop` is in guards units (small t0 0.07 = pflug 0.07; the game subtracts 0.06) and `chest.lean` is total lean (small t0 5° = pflug pitch 5°). The puppet sign checks will verify; no format change expected.
2. **Stance mismatch**: clips start with the sword foot rear (`step.from [−0.26, 0.15]`), the game guard stance has the sword foot front. R2 passes the rear (off) foot and maps foot channels by role. Please confirm this reading is acceptable for v0, or add a `stance` note / a variant with the sword foot front in v1. Not blocking.
3. **Small ↔ medium chamber sword** differs by 75–90° at tw; slerp handles it, but S crossing ≈ 0.25 during a wind will show a fast blade swing. Please confirm the medium chamber is intended, or provide a medium whose `sword` at tw is closer to the small pose. Not blocking.
4. Medium `wristOver160` (zornhau 0.06 s) is reported, not hidden; a v1 medium is welcome, not required.
5. `com`, `J`, `ang.*`, `w.*`, `speed.*` are not driven (tools only). `edge` is packed and compared but not driven because §3-6 says it is derived from the tip velocity — the game already forms the same quantity from its measured blade; if you ever **author** the edge (true edge toward the foe during the wind, not the motion direction), say so in the channel note and `DRIVE.edgeFromClip` will drive it. `balanceAssist` is a game value (`DRIVE.balanceAssist`, R4). No other channel is missing for R2.
6. **Step data at speed**: the clip's swing (`liftT` 0.408 → `landT` 0.65, 0.242 s for 0.78 m) is played compressed by the finger; the game foot is limited to 6 m/s (`GAIT.swingVmax`) so at finger speed it lands after `tc`. If v1 can give a step that starts earlier relative to the release (lift during the wind's end), the landing at finger speed moves toward `tc`. Not blocking; the landing distribution is in the R2 report.

---

## Appendix A — current controllers touched by R2 (per joint group; values read from the code)

| group | bodies/joints | controller today | gains / limits / clamps (line) | R2 change |
|---|---|---|---|---|
| pelvis–anchor | pelvis ↔ kinematic anchor, `uprightJoint` generic axis (1,0,0) (`fighter.js:364-368`) | `jointConfigureMotorPosition(ax, 0, 2500·assist·r, 330·assist·r)` (`:1323`), anchorQ = heading + pelvisYawOffset (`:1310`) | yaw = MOTOR_AXES[2] | yaw k × (1 − 0.9 S); d unchanged |
| pelvis yaw target | `updateBodyPose` (`:605-652`) | follow() critically damped, w 34·spd; commit branch pelvisRate 600°/s, hipRoom 0.6 (dead) | — | mixBody lerp with clip + derivative |
| spine | pelvis→abdomen k 1800 d 180 max 500 lim y ±0.5; abdomen→chest k 1600 d 160 max 440 lim y ±0.6 (`:80-81`), abdomen +0.4 inertia (`:289`) | `applyPose` twist clamp ±0.8, split 0.45/0.55 (`:1542-1545`); engine motors, target-rate clamp ±15 (`:1596`) | hard limits via `jointSetLimits` (`:353`) | twist ±0.95·S, limits ±(0.55/0.7)·S, soft limit, τ_ff pairs, rate 40·S, side bend |
| sword shoulder | chest→uarmS ball `manual` k 320 d 26 max 80 (`:85`) | `manualMuscle` (`:1642-1683`): swing PD toward target rate, gravity FF, Hill cap (`:1676-1678`), wT clamp 20 (`:1660`), twist axis k 25 d 0.8 (`:1680`) | explicit torque | wT clamp 40·S, ω_des/α_des from IK, +I_arm·α_des·0.8·S before the cap, co-contraction on swing only |
| sword elbow | uarmS→farmS hinge k 400 d 38 max 80 lim [0, 2.5] (`:87`) | engine motor, Hill on maxErr (`:1580-1588`), rate clamp ±15 (`:1591`) | — | rate 40·S, co-contraction, elbow τ_ff |
| off arm | uarmO ball k 400 d 36 max 140; farmO hinge k 240 d 20 max 100 | `offArmIK` (`:2006-2035`), grip spring `GRIP` (`:1964-2004`) | — | pole from clip (hysteresis); lever R3 |
| wrist/sword | `gripJoint` spherical, aim PD 60/11, cap 22·Hill (`:1755-1760`) | `driveSword` aim, wAim (R0 wristRel) | — | aim slerp to clip, wAim from clip rate |
| hand target | `skill.update` → aimRaw disc 0.62 (`skill.js:399/462`) → filter 24/14 (`:467-476`) → `guardAt` SIGMA2 0.15² → closeReach (`fighter.js:1719`) → `this.yaw` frame (`:1721`) → armIK shoulder (0,0.1,±0.2), pole (−0.25,−1,±0.5) (`:1931/1938`) | — | clip share after closeReach in commanded chest frame; pole/shoulder hooks |
| feet | `pinFeet` pinK 20000, pinYawK 300, lever μN·0.05 (`gait.js:1038`), heel `:809-811`, swing yaw ±0.6 (`:713`) | — | pivot target, heel floor, lever 0.02·S, swingTwist 1.0·S |
| step | `requestStep` (`gait.js:222-228`), req foot `:411`, target `:683-688`, touchdown `:742/750`, swing `:818-840` (`swingVmax`) | duration clamp [0.28, 0.7], `move.y < −0.1` refusal | — | `'strike'` kind: exact fwd, lateral offset, no duration floor (physics `swingVmax` decides the landing), `onLanded` |

## Appendix B — stability of the explicit terms (semi-implicit Euler, dt = 1/120; rule ω_n·dt ≤ 0.5, c·dt/I ≤ 1)

| term | k, c, I | ω_n·dt / c·dt/I |
|---|---|---|
| shoulder swing today | 320, 26, 1.3 | 0.13 / 0.17 |
| shoulder swing co-contracted (S = 1) | 480, 39, 1.3 | 0.16 / 0.25 |
| shoulder without sword (no S: `armed` required) | 320, 26, 0.39 | 0.24 / 0.55 |
| shoulder twist axis (excluded from co-contraction) | 25, 0.8, 0.007 | 0.5 / 0.95 |
| soft limit (new) | 400, 20, 0.51 | 0.23 / 0.33 |
| φ filter ω 60 | exact discretisation | unconditionally stable |
| engine motors (spine, hips, elbow, anchor) | implicit constraints | unconditionally stable; gains only change convergence |

τ_ff has no feedback path (spline `I·q̈` × φ̇², φ̈ bounded by the φ filter, capped by `j.max·mus`). The only new loop risk is the hand frame: using the **commanded** chest frame (not the measured one) is the barrier; if `chestLag > 25°`, only the elbow pole and (in 'anchor' mode) the shoulder are pulled toward the measured chest, never the hand target.

## Appendix C — energy path already open in R2 and what R3 measures

1. Hand in the commanded chest frame: `v_hand = v_chest + ω_chest × r + v_arm/chest`; large Zornhau chest −11 rad/s at r ≈ 0.5 m adds ≈ 5.5 m/s.
2. Pelvis → chest: anchor rate servo + hip τ_ff bring the pelvis to ≈ 5 rad/s (today 2.3); spine τ_ff stacks the X-factor release (clip: pelvis peak −129 ms → chest −79 ms before tc).
3. Chest → arm: the clip decelerates the chest at φ 0.6–1.0 (α ≈ +66 rad/s²) and τ_ff feeds it forward; `manualMuscle`'s action–reaction pair (`fighter.js:1681-1682`) means the torque that stands the chest up pushes the arm and sword forward: `ΔL_trunk = −ΔL_arm` (≈ 7.5 kg·m²/s → +5.8 rad/s on I_arm 1.3).
4. Arm → sword (R3): late wrist release, off-hand lever, body coupling `mEff` (`combat.js:155-159`), momentum bookkeeping via `takeJolt` (`combat.js:462`, `:531`). R2 leaves the instrumentation: `debug.L_trunk`, `L_arm`, `P_anchor`, `tauAnchor`, chain peak times per segment in record/1.
