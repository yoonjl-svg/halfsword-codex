# R2 설계 — 동작 우선 (MOTION-FIRST): atlas → retarget → puppet → gesture/drive

- 기준 코드: worktree `/home/user/hs-wbs`, branch `wbs-impl` @ `bcf1fb1` (line numbers below verified there). Reference clips: `docs/motion/clips/*.json` (`stillness-motion-clip/2`, 52 files, `index.json` = `stillness-motion-index/1`) on `main`.
- 설계서: `docs/whole_body_redesign.md` §0–§5, §7-2, §8 (R2 row), §9, §10. Clip format: `docs/motion/clip_format.md`, `README.md`, `targets.md`, `spec_table.md` §7.
- R0 (running) is assumed present: `STRIKE.gripMu`, `STRIKE.glitchFilter` (30 m/s discard gone), `STRIKE.sweep`, `STRIKE.wristRel` (forearm-relative 60 rad/s), `RENDER.interp`, `FEEL.logScale`, `INPUT.coalesce` + `fingerTrace.at(t)`, `tools/sim/chain.mjs` emitting `stillness-motion-record/1`. Nothing below re-implements those.
- Hard rules honoured: no new cap/limit/floor on speed, power, size, frequency, time. Everything that could act as one is listed in §6 with its owner question. No difficulty tuning. R3 (wrist late release, off-hand lever, body-coupling energy, momentum bookkeeping), R4 (recoil), R5 (openings/AI) are out of scope; their hooks are named where R2 must leave a seam.

---

## 1. 요약 (10줄)

1. Start from the clips: `atlas.js` loads clip/2 through `index.json`, validates loudly, converts the clip's chest/world frames to the game's facing frame with one quaternion `Qc = qY(−yaw)·qZ(−lean)·qX(+side)`, and resamples every needed channel on a φ grid (Δφ 0.01, φ −1…2.2) with analytic dφ and d²φ.
2. Sampling is `sample(cutA, cutB, wAB, side, φ, S)`: size blend small↔medium (S 0…0.5) and medium↔large (S 0.5…1) of the SAME cut, then neighbour-family blend; positions lerp, directions slerp, yaw channels lerp on unwrapped degrees.
3. The game never "plays" the clip; it adds the **size delta** Δ(φ,S) = clip(φ,S) − small(φ) on top of the finger-driven guards pose. Small == guards (0 cm at start/end), so S = 0 is bit-identical (the addition is skipped) and S → 0⁺ is continuous.
4. Retarget is exact in reach: all medium/large clips stay within the game arm 0.30 + 0.265 m from the fixed shoulder (worst −0.1 cm zornhau_large, +0.5 cm scheitelhau_large at tc); the girdle (≤ 0.06 m) is realised by moving the shoulder joint anchor (`jointSetAnchor1`) and the IK root together; nothing is shrunk silently — a reach report is produced at load and a clamp counter at runtime.
5. Puppet mode is the first gate: pure-kinematic FK/IK retarget on the game skeleton vs the clip's own `J` (hand ≤ 0.03 m), then the ragdoll placed kinematically for eyes, recorded as record/1 for `compare.mjs`/viewer.
6. `gesture.js` reads the unclamped finger trace per physics step: origin o (dwell < 0.25 m/s ≥ 40 ms), wind vector w, S_wind = smoothstep(0.12, 0.55, |w|), φ_wind = −1 + |w|/0.55, cut start by velocity reversal (dot(v, ŵ) < −0.3|v|, |v| > 1.5 m/s), S_stroke = smoothstep(0.35, 0.9, L)·0.4, S = max.
7. Family/side come from a wheel over the wind-end position's pad angle θ_p (guard chambers as nodes), blending only two adjacent nodes; `lateSelect` 70 ms after the reversal re-picks by stroke direction, then locks. 8 cuts × 2 sides are in the table; R2 v0 activates zornhau, oberhau, mittelhau, unterhau (both sides); zwerch/schiel/scheitel/krump are reserved nodes.
8. `drive.js` (ClipDrive) applies Δ to trunk targets (bypassing `follow()` for the clip share), relaxes only the upright anchor's yaw stiffness by (1 − 0.9·S), feeds I·α feed-forward torque, widens spine/hip ranges with soft limits (Q5 default allow), raises motor target-rate clamps 15 → 40 rad/s and 20 → 40 rad/s **as a function of S**, uses clip elbow poles with hysteresis, pivots the stance foot, and requests the passing step through `gait.requestStep` (Q7 default yes).
9. Aim warping ≤ 0.25 m moves the φc hand toward the target zone; it is a steering knob on assistance, not a limit on the player.
10. Six work items with disjoint file sets (atlas+pack, puppet, gesture, drive-upper, drive-legs, measurement) in order 1 → (2 ∥ 3) → 4 → 5 → 6.

---

## 2. 모듈별 설계

### 2-1. `src/strike/atlas.js` — 참고 동작 모음

#### 파일과 불러오기

| what | where | note |
|---|---|---|
| Source of truth | `docs/motion/clips/<cut>_<right\|left>_<small\|medium\|large>.json` + `index.json` | motion PM owns; never edited by the game |
| Packed atlas for the game | `src/strike/clips/atlas_v0.json` (new) built by `tools/motion/pack_atlas.mjs` (new) | strips `J`, `ang.*`, `w.*`, `speed.*`, `edge`, `com`; keeps the driven channels; resamples onto the φ grid; stores `sourceFormat: 'stillness-motion-clip/2'`, `indexFormat`, clip ids, `generated`, sha1 of each source. ~33 floats × 321 φ × 24 clips ≈ 250 k floats (Float32, base64 ≈ 1.3 MB; float16 optional) |
| Node loaders | `loadAtlasFromClips(dir)` (fs, raw clips — used by sims, puppet, pack) and `loadAtlasPacked(json)` (browser via `import atlasPack from './clips/atlas_v0.json'`) | both end in the same `buildAtlas(clips, opts)` |

Loading rule (director decision in `clip_format.md` head): the game reads the three sizes through `index.json` — `index.clips` filtered by `cut`/`side`/`size`; a family is complete only when all three sizes exist (`flow_*`, `lunge_*` are skipped by `cut` prefix).

#### 검증 — 버전이 다르면 시끄럽게 실패

`validateClip(c)` / `validateIndex(idx)` throw (never warn) on:

- `idx.format !== 'stillness-motion-index/1'`, `c.format !== 'stillness-motion-clip/2'` (message names the file, found format, expected format; clip/1 files are refused even though they would parse — the drive needs `girdleS/O`, `elbowPoleO`, `step`, `recoverTo`).
- missing channel in `REQUIRED = ['t','phi','pelvis.yaw','pelvis.pitch','pelvis.drop','chest.yaw','chest.xFactor','chest.lean','chest.side','handS','handO','sword','elbowPoleS','elbowPoleO','girdleS','girdleO','guardGap','openness','feet.L.yaw','feet.L.lift','feet.R.yaw','feet.R.lift']`, or `data.width[ch]` ≠ expected width, or `cols[ch].length !== n·width`.
- `hz !== 120`, `n !== round(marks.tg·hz)+1` (small 121, medium 151, large 181 — verified), non-monotone `t`, marks not ordered `t0<tw<tr<tc<tf<tg`, `phiMarks` ≠ `{t0:-1,tw:0,tr:0.55,tc:0.85,tf:1.6,tg:2.2}`.
- `cols.phi` deviating from the piecewise-linear map of `marks`/`phiMarks` by > 1e-3.
- non-unit `sword`/`elbowPole*` (|len−1| > 1e-3).
- `size !== 'small'` without `step`, `recoverTo` not in the guard id set (the 14 ids of `guards.js` / `atlas.js GUARD_IDS`: `tag, tagR, ochs, langort, side, pflug, wechsel, neben, alber, tagL, ochsL, sideL, pflugL, wechselL`), or `startPose.handError`/`endPose.handError` > 0.02 (format promises 0: "16벌 모두 끝 자세 = 목표 자세 (손 오차 0 cm)").
- packed file: `sourceFormat` mismatch, or a source sha1 that differs from the clip on disk when both are present (sims).

Content warnings (collected in `atlas.report`, printed once by sims, never silent): `summary.checks.wristOver160 > 0` (medium zwerch 0.13 s, krump 0.16 s, zorn 0.06 s, schiel 0.07 s), reach report (§2-2), elbow-pole flips (§2-2), cross-size hand jump at any mark > 0.35 m.

#### 좌표·부호·단위 → 게임 틀 (verified against `body.mjs` `frame()`/`m3` and `fighter.js`)

Clip world `[x fwd, y up, z sword side]` **is** the game's facing-local frame: `fighter.js:1721 const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));` — `this.yaw` = `setFromAxisAngle(UP, heading)`, forward `(cos h, 0, −sin h)`, right `(sin h, 0, cos h)` (`fighter.js:551-559`). Chest centre = `bodies.chest.translation()` (partDefs `chest` at `[0, 1.33, 0]`), which is the clip chest-frame origin and `body.mjs` `C`.

| clip channel | game quantity | conversion |
|---|---|---|
| `pelvis.yaw` (deg, + = sword shoulder back) | `bodyPose.pelvisYaw` (rad, game sign) | `−deg·D2R` — matches `fighter.js:623 const pT = -G.pelvisYaw * pf * gw * amp;` and `body.mjs m3.ry(deg) = R_y(−deg)` |
| `chest.yaw` (deg, world) | `bodyPose.chestYaw` (rad) | `−deg·D2R` (fighter.js:647 `follow('chestYaw', -G.chestYaw * gw * amp, …)`) |
| `chest.xFactor` | not driven (`= chest − pelvis`, used only for reports) | — |
| `chest.lean` (deg, + fwd; total lean) | `bodyPose.pitch` (rad, + fwd; `applyPose` `bend = … − bp.pitch`, joint z + = lean back) | `+deg·D2R` |
| `chest.side` (deg, + toward sword side) | **new** `bodyPose.side` (rad) → spine x-axis | `+deg·D2R`, applied as `_eu.set(side·share, yaw, pitch)` in the two `spine()` calls (fighter.js:1544-1545), shares 0.5/0.5 |
| `pelvis.drop` (m) | `bodyPose.drop` | `drop − 0.06` (fighter.js:649 `follow('drop', (G.drop - 0.06) * gw, …)`); pflug 0.07 ↔ guards `drop: 0.07` |
| `pelvis.pitch` | 0 in all v0 clips; validated `|pitch| < 1e-6` else warn | — |
| chest frame `Qc` | facing-local quaternion | `Qc = qY(−chest.yaw·D2R) · qZ(−chest.lean·D2R) · qX(+chest.side·D2R)` (= `body.mjs frame(yaw, pitch, roll) = ry·rz·rx`) |
| `handS`, `handO` (m, chest) | facing-local hand | `Qc·h` (small clip at t0 → `[0.343,−0.281,0.018]` chest → guards pflug hand `[0.28,−0.31,0.15]` after `Qc(25°,5°,0)`, as `clip.mjs fromGameGuard` built it) |
| `sword` (unit, chest) | facing-local aim (`fighter.js:1746 aim.applyQuaternion(this.yaw)`) | `Qc·sword` |
| `elbowPoleS/O` (unit, chest) | armIK pole, **actual**-chest local | `Qc·pole` then into `armIK` after its own `_q1` inverse (armIK works in the actual chest frame: 1927-1930) → pass world pole = `yaw⊗(Qc·pole)`; armIK rotates it by `rot(chest)⁻¹` |
| `girdleS/O` = `[lift, prot]` (m) | shoulder root offset in chest frame `[prot, lift, 0]` | `(0, 0.1, ±0.2) + (prot, lift, 0)` — see §2-2 |
| `feet.L/R.yaw` (deg, guards sign) | gait leg `l.yaw` (rad, `atan2(−fx.z, fx.x)`, + = CCW) | `−deg·D2R`; anatomical L/R → game `B`/`F` for `side = +1` (`game_joints.mjs`: `hipR: ['thighF', …]`) |
| `feet.*.lift` (0…1) | heel raise angle `l.heel` (rad) | `lift · GAIT.heelMax` (0.5) — see §2-4 foot pivot |
| `step {foot, from, to, liftPhi, landPhi, liftT, landT}` (world m) | `gait.requestStep({kind:'pass', fwd, side, duration})` | `fwd = to.x − from.x` (large 0.78, medium 0.39, small: null), `side = to.z − from.z` (zornhau −0.03, zwerch +0.23, krump +0.40), duration from φ rate (§2-4) |
| `phi`, `marks` | φ grid and `T(φ,S)` | piecewise-linear `t(φ)` per size, blended by S |
| `openness`, `guardGap` | pass-through `f.strike.openness` for R5/viewer | — |
| `sources`, `provenance` | kept in `atlas.meta[clipId]` | shown by `atlas_check.mjs` |

Left-side clips are already mirrored by the motion PM (`side: 'left'`, same right-hander); the game has `this.side = 1` only, so no runtime mirroring.

#### 표본화 — φ 격자, 크기 섞기, 이웃 무리 섞기, 해석적 미분

At `buildAtlas`:

1. For each clip, invert `t(φ)` (piecewise linear on marks) and resample every driven channel onto `PHI_GRID = −1 … 2.2 step 0.01` (321 points) with monotone cubic (PCHIP) in `t`; directions resampled by slerp between neighbouring 120 Hz samples.
2. Precompute per grid point `v`, `v' = dv/dφ`, `v'' = d²v/dφ²` (5-tap Savitzky–Golay on the grid; directions: angular velocity/acceleration vectors from the slerp derivative).
3. Store `T(φ)` per size and `dT/dφ`.

At runtime `atlas.sample(out, req)` with `req = { cutA, cutB, wAB, side, phi, S }`:

- size blend per `clip_format.md §4` (two segments through medium to avoid the 165–177° wrist of a straight small↔large lerp): `S ≤ 0.5 → u = 2S, A = small, B = medium`; `S > 0.5 → u = 2S−1, A = medium, B = large`.
- per channel: scalars `lerp`; positions `lerp`; unit directions `slerp` (arc angle eased linearly in u; the great-circle rule from the format §4 — "성분마다 섞지 말고 큰 원을 따라"); yaw channels lerp on unwrapped degrees.
- neighbour families: the same operations with weight `wAB` between `cutA` and `cutB` sampled at the **same φ and S** (the format guarantees common φ marks: "크기가 달라도 같은 φ 는 같은 동작 단계").
- interpolation inside a grid cell: quintic Hermite using `(v, v', v'')` at both ends → C² positions/angles; `sample` returns `v`, `dv/dφ`, `d²v/dφ²` for every channel so the drive can form `ẋ = v'·φ̇`, `ẍ = v''·φ̇² + v'·φ̈`.
- also returns `small(φ)` (S=0 sample of the same family blend) so the drive can build Δ; and `T(φ,S)`, `dT/dφ(φ,S)`, `phiDotNatural = 1/(dT/dφ)`.
- cost: 4 grid lookups × ~33 channels × 3 quantities ≈ 400 multiply-adds per step; target ≤ 0.02 ms (gate ≤ 0.05 ms).

`squad` from the redesign is not needed: frames are built analytically from the yaw/lean/side scalar splines (exact angular velocity), and sword/pole are directions (no roll) → slerp. Noted as a deliberate deviation.

#### `recoverTo` / `endPose` → 복귀에 쓰는 법

- At φ ≥ 1.6 the atlas keeps sampling to 2.2; Δ(φ,S) → 0 at 2.2 by construction because all three sizes end in the same guard (`recovery.to`, `endPose.handError 0`). The physical recovery of the clip share is therefore "the size delta fading along the clip's own recovery timing" (large 0.55 s, medium 0.425 s, small 0.30 s, blended by S). R4 replaces the φ clock in this segment with the brake dynamics; R2 uses the natural rate.
- `recoverTo` sets the auto-return pad for the player's guard recovery: `Skill.update` (skill.js:504-520) walks `handOffset` to `SKILL.homeGuard` (pflug); the drive publishes `f.strike.homePad = PAD_OF[recoverTo]` (pflugL `[-0.18,-0.28]`, ochsL `[-0.22,0.26]`, pflug `[0.18,-0.28]`) and `Skill` uses it instead of `SKILL.homeGuard` while `f.strike.active` (one-line change at skill.js:510-511 `const hx = home[0] - off.x`). This is what makes a right Zornhau end in the left Pflug instead of crawling back to the right Pflug.
- `endPose.next` (wechselL 0.057, alber 0.146 for diagonal cuts; tagL/sideL for horizontal) is exposed as `f.strike.nearGuards` for R5's openness reading and for the viewer; not used by the drive.
- `startFrom`/`startPose` are used by the puppet to place the ragdoll at t0 and by gesture as the family's canonical start pad (pflug/pflugL).

#### 걸음 목표·시각 → gait

Large clips: `step.landPhi = 0.85 = φc` (`landT === marks.tc = 0.65`), `liftPhi = 0.14` (liftT 0.408). Medium clips: `landPhi 0.833` (landT 0.558, 7 ms before tc 0.565), `liftPhi 0.178` (liftT 0.333). Small: `step: null`. The atlas blends `liftPhi/landPhi/fwd/side` across sizes with the same two-segment rule as the channels, with small = `{fwd 0, side 0, liftPhi 0.178, landPhi 0.833}` so that `fwd(S)` rises from 0 without a jump. Mapping in §2-4 (legs).

#### Config (`CONFIG.ATLAS`, first values)

`{ pack: 'v0', families: ['zornhau','oberhau','mittelhau','unterhau'], reserved: ['zwerchhau','schielhau','scheitelhau','krumphau'], phiStep: 0.01, sgWindow: 5, strict: true }` — `strict` false only for the puppet/viewer tools that want to open clip/1 records.

#### Exported API

```js
export const CLIP_FORMAT = 'stillness-motion-clip/2', INDEX_FORMAT = 'stillness-motion-index/1', PACK_FORMAT = 'stillness-atlas-pack/1';
export function validateIndex(idx), validateClip(clip);          // throw
export function buildAtlas(clips, { families, phiStep });          // → Atlas
export async function loadAtlasFromClips(dir /* node */), loadAtlasPacked(json /* browser */);
export class Atlas {
  has(cut, side); sizes(cut, side);                                // small|medium|large present
  sample(out, { cutA, cutB, wAB, side, phi, S });                  // fills ClipPose + derivatives + small(φ)
  timeAt(phi, S, cut, side); phiDotNatural(phi, S, cut, side);
  step(cut, side, S);                                              // { fwd, side, liftPhi, landPhi } two-segment blend, small = { fwd 0, side 0, liftPhi 0.178, landPhi 0.833 }
  recoverTo(cut, side), startFrom(cut, side), nearGuards(cut, side);
  report;                                                          // reach, pole flips, wrist>160, warnings
  meta[clipId];                                                    // sources, provenance, marks
}
// ClipPose (facing-local unless noted): pelvisYaw, chestYaw, side, lean, drop (game units), Qc,
//   handS, handO, sword, poleS, poleO, girdleS, girdleO (chest-local m), footYaw{F,B}, heel{F,B},
//   openness, guardGap; d1.*, d2.* per channel; small.* (S=0 sample)
```

---

### 2-2. 게임 뼈대로 옮기기 (retarget)

Game skeleton facts (fighter.js): shoulder anchor `at: [0, 1.43, s * 0.2]` (line 85) = chest-local `(0, 0.1, ±0.2)`; `armIK` uses `a = 0.3`, `b = 0.27` with reach clamp `a + b − 0.005 = 0.565` (1932-1935); physical hand point `wristLocal (0.565, 1.43, ±0.2)` (411). Off arm: `a = 0.3, b = 0.275` (2013-2014), shoulder `(0, 0.1, −side·0.2)`. Clip body (`body.mjs BODY`): `upper 0.3, fore 0.265, shoulder [0,0.1,0.2]` — identical.

**Reach report from the game's fixed shoulder** (computed from the clips, `|handS − (0,0.1,0.2)| − 0.565`, worst frame):

| clip | fixed shoulder | with girdle root | off hand vs 0.575 | elbow pole proj. min | pole flips > 57°/frame |
|---|---|---|---|---|---|
| zornhau L/M/S | −0.1 / −2.1 / −2.1 cm | −2.0 / −3.5 / −3.5 | +2.4 cm @ t0 (pflug) | 0.98 | 0 |
| oberhau L/M/S | −0.4 / −0.4 / **+1.7** | −3.5 / −3.5 / −0.5 | +2.4 | 0.91–0.98 | 0 |
| mittelhau L/M/S | −2.1 / −2.1 / −2.1 | −3.5 | +2.4 | 0.99 | **2 (0.88 s, 1.07 s)** |
| unterhau L/M/S | −2.1 | −3.5 | +2.4 | 0.99 | 0 |
| zwerchhau L/M/S | −2.1 | −3.5 | +2.4 | 0.98 | 0 |
| schielhau L/M/S | −0.2 / −0.9 / **+3.1** | −3.5 / −3.5 / −0.5 | +2.4 | 0.98 (S 0.91) | 0 |
| scheitelhau L/M/S | **+0.5** / +0.5 / **+3.4** | −3.5 / −3.5 / −0.3 | +2.4 | 0.98 (S 0.87) | 0 |
| krumphau L/M/S | −0.6 / −1.0 / **+3.9** | −2.7 / −3.2 / +2.2 | +2.4 | 0.98 (S **0.32** @0.53 s) | 0 |

Reading: every medium/large hand is reachable from the fixed shoulder except scheitelhau_large/medium at tc (+0.5 cm). The small (= game guards) overshoots are the game's own `긴 자세` hand `[0.57,0.07,0.03]` (0.596 m from the shoulder) — the game already saturates there today. The off-hand +2.4 cm at pflug is likewise today's behaviour (offArmIK clamps).

**Rules**

1. IK target = full clip hand (`chest + yaw⊗Qc·handS` + Δ scheme of §2-4). Never scale the hand toward the shoulder.
2. Girdle: move the real shoulder joint anchor with the clip: `this.jointByName.uarmS.joint.setAnchor1({x: girdle.prot, y: 0.1 + girdle.lift, z: side·0.2})` (Rapier compat 0.19.3 exposes `ImpulseJoint.setAnchor1`, verified in `node_modules/@dimforge/rapier3d-compat/rapier.d.ts:109`; the parent anchor is chest-local, and `chest` has identity `localRot`, so the value is the chest-local point directly). IK root `S` (armIK:1931) moves by the same vector. Rate-limited 0.5 m/s, scaled by S so that S = 0 leaves the anchor at its constructor value bit-for-bit. Fallback if the moving anchor jitters in the 60/120 Hz battery: keep the anchor fixed, drop girdle, report the hand error it costs (≤ 0.06 m at the top of the wind, ≤ 0.037 m at tc) — puppet gate then measured hand-relative-to-shoulder.
3. Elbow pole from the clip with hysteresis: `pDir` in armIK (1938-1941) becomes `poleUsed = slerp(poleUsed_prev, poleClip, min(1, dt·POLE_RATE))`, `POLE_RATE 12 /s`; flip guard: if the projected pole `pole − (pole·Dn)Dn` has length < 0.15 or the new projected direction is > 90° from the previous one, keep the previous `pDir` for that step and let the slerp carry it over (mittelhau_large 0.88 s/1.07 s: the elbow crosses under the arm axis as the hand passes the far hip). Blend with the default pole by S: `pole = normalize(lerp(defaultPole, poleClip, S))` — S = 0 is the constructor default `(-0.25, -1, side·0.5)` exactly.
4. Unreachable frames: armIK keeps its clamp (`d ≤ 0.565`, line 1935) because a hand cannot leave the shoulder; but when the clamp engages while `f.strike.S > 0` the drive counts `f.strike.stats.reachClamp++` and `reachClampMax = max(d_wanted − 0.565)`; `chain.mjs` prints both per stroke. The remedy is the trunk (lean +20° at tf, chest yaw −65°) which the clip already prescribes — if the count stays > 0 after the trunk tracks, the clip is reported back to the motion PM (scheitelhau tc +0.5 cm is expected).
5. Wrist: the clip `sword` is the aim target; the physical wrist is the spherical `gripJoint` with `maxAimTorque 22` — clips whose forearm–blade angle exceeds ~160° (medium zwerch 175°, krump 171°, zorn 166°) will lag; report `atlas.report.wristOver` and the measured aim error in the puppet (puppet places the sword kinematically, so the check is "what the physics will be asked to do").
6. Legs: clip knees are 31–81°; game `legIK` handles them (`A_LEN 0.43`, `B_LEN 0.42`); pelvis drop ≤ 0.15 m is within `GAIT.maxDip 0.12` + guardHeight slack — report if the `h` target clips.

---

### 2-3. `src/strike/gesture.js` — 손짓 읽기 (finger → S, dir, φ)

**Input**: `input.fingerTrace` (R0 `INPUT.coalesce`, `fingerTrace.at(t, out)` → unclamped pad position `{x, y, vx, vy}` at physics time `t` with `predictMs 8` look-ahead). Pad units are metres, `+x` sword side, `+y` up, same as `handOffset`. Alignment of the integrated trace to `handOffset` is done the way `detectCommit` does it (skill.js:568-580: subtract the pieces not yet added) once per touch.

**Per physics step** (`Gesture.update(dt, now)`, called at the top of `Skill.update`):

1. `p = trace.at(now + predictMs)`, `v = p.v`.
2. Origin `o`: last place where `|v| < restV 0.25 m/s` for ≥ `restDwell 40 ms`; reset at `TRACE_LIFT`/new touch to the touch-down pad.
3. Wind vector `w = p − o`; it counts as a wind only when it pulls away from the pad centre (`dot(w, p̂) > 0.5·|w|`) and toward a chamber node (θ_p not in the dead sector, table below). `|w|` is not clamped by the 0.62 disc (skill.js:399/462 clamps stay on the arm share); `padExt 1.0` is the input extent.
4. `S_wind = smoothstep(sL0 0.12, sL1 0.55, |w|)`; rising instantly; falling only while the finger returns slowly (`|v| < vStrike` and `dot(v, ŵ) < 0`) with τ `windDecay 0.25 s`; otherwise held (a wound-up guard can be held — Q2 default free).
5. `φ_wind = −1 + clamp(|w| / sL1, 0, 1)` (clip wind segment traversed 1:1 with the finger; beyond 0.55 the extra pull is slack, §6).
6. Cut start = first step with `dot(v, ŵ) < −0.3·|v|` and `|v| > vStrike 1.5 m/s` (also when the finger lifts with `|v| > vStrike`). Then `φ ← 0`, `S_cut = S_wind`, family locked after lateSelect, carry-over offset armed (§2-4 "cut start").
7. During the stroke: `S_stroke = smoothstep(0.35, 0.9, strokeLen)·kStroke 0.4` (strokeLen = path length since the reversal, or since the last dwell if there was no wind — Q3); `S = max(S_cut, S_stroke)`, monotone non-decreasing until φ_g.
8. `φ̇_finger = 1/T0(S) + kv 0.35·max(0, v_along)`; `T0(S) = (tc − tw)/0.85` of the blended size (0.329/0.335/0.341 s for small/medium/large ≈ the redesign's 0.30; weapon multipliers R6); after φ ≥ 1.6 the natural recovery rate. `φ_body` = critically-damped 2nd-order filter of `φ_finger` (ω 60 rad/s, semi-implicit, ω·dt = 0.5 at 120 Hz) plus lead `min(leadMs 40·S, …)·φ̇`. `φ̈` from the filter drives the feed-forward torque.
9. Publish `f.strike = { active, S, phi, phiDot, phiDDot, famA, famB, wAB, side, state: 'idle'|'wind'|'cut'|'follow'|'recover', windVec, strokeDir, tCut, homePad, openness, stats }`. Created once in the `Fighter` constructor next to `this.skill = new Skill(this)` (fighter.js:233), mirroring how `fighter.commit` is created in `Skill` (skill.js:139).
10. End: φ ≥ 2.2 → `active=false`, S → 0, family cleared. A new wind may start any time (no cooldown, Q18); its origin is the current dwell.

**Family/side wheel** — node = the guard chamber the wind is heading to, keyed by the pad polar angle `θ_p = atan2(p.y, p.x)` of the wind-end position `p` (not of `w`, so that "pull straight up from Pflug" lands on Tag, not on a left bias). Radius gate `|p| ≥ 0.30` for a node to count.

| node (side) | chamber guard (pad) | θ_p centre | clip wind-end handS (large, chest) | stroke direction θ_s (chamber → end pad) | R2 v0 |
|---|---|---|---|---|---|
| oberhau (R/L by sign of p.x; tie → current pad side) | 지붕 Vom Tag `(0.02, 0.52)` | 90° | `[-0.10, 0.56, 0.06]` | −90° → Alber `(0,−0.5)` | active |
| zornhau_R | 어깨 지붕 `(0.42, 0.42)` | 45° | `[-0.12, 0.52, 0.12]` | −134° → 왼쪽 바꿈 `(−0.4,−0.42)` | active |
| zwerchhau_R | (Ochs-high side, between 어깨 지붕 and 옆 자세) | 20° | `[-0.06, 0.40, 0.22]` | ~165° (high horizontal to ochsL) | reserved |
| mittelhau_R | 옆 자세 `(0.52, 0.03)` | 3° | `[0.08, 0.12, 0.38]` | 180° → 왼쪽 옆 자세 | active |
| unterhau_R | 바꿈 `(0.38,−0.44)` / 옆 지킴 `(0.55,−0.26)` | −40° | `[0.14, −0.32, 0.18]` | 131° → 왼쪽 황소 `(−0.22, 0.26)` | active |
| dead sector | Alber | −70° … −110° | — | — | no wind |
| unterhau_L | 왼쪽 바꿈 `(−0.4,−0.42)` | −133° (227°) | mirrored | 49° → 황소 `(0.22, 0.26)` | active |
| mittelhau_L | 왼쪽 옆 자세 `(−0.52, 0.03)` | 177° | mirrored | 0° → 옆 자세 | active |
| zwerchhau_L | mirrored | 160° | mirrored | ~15° | reserved |
| zornhau_L | 왼쪽 어깨 지붕 `(−0.4, 0.42)` | 133° | mirrored | −46° → 바꿈 `(0.38,−0.44)` | active |
| schielhau_R/L, krumphau_R/L | same node as zornhau (wind-end handS `[-0.10, 0.48, 0.14]`) | 45° / 133° | — | schiel −110° ending high, krump ≈ −160° with side step | reserved (lateSelect discriminators to be defined with the motion PM) |
| scheitelhau_R/L | same node as oberhau | 90° | — | −90° ending extended high | reserved |

- Neighbour blending: only the two active nodes adjacent in θ_p; `wAB = (θ_p − θ_A)/(θ_B − θ_A)` linear. Example: θ_p 70° → oberhau 0.56 / zornhau_R 0.44; θ_p −20° → mittelhau_R 0.47 / unterhau_R 0.53. With zwerch reserved, 45° → 3° blends zornhau_R↔mittelhau_R directly (a high horizontal), which the format allows (same φ marks).
- `lateSelect 70 ms` (or φ ≤ 0.3, whichever first) after the reversal: among `{famA, famB}` ∪ their wheel neighbours, choose the node whose θ_s is closest to the finger stroke direction if within `angTol 35°`; blend weight `wAB` re-solved toward the pick with a 30 ms min-jerk so nothing jumps; then lock (`f.strike.locked = true`).
- No wind (S_stroke case): the family is picked by θ_s alone at the first step `|v| > vStrike` (same table, column θ_s) — the "큰 긋기 from Pflug" path; kStroke bounds its S (Q3).

**Hooks (skill.js)**

- skill.js:392 `update(dt) {` … insert before line 405: `if (GESTURE.on && this.detect && this.trace) this.gesture.update(dt, this.f.now);`
- skill.js:405 `if (WHOLE.on && WHOLE.commit && this.detect && this.trace) this.detectCommit(dt);` → `if (WHOLE.on && WHOLE.commit && !GESTURE.on && …)`. The old two-stage path (`beginCut` 807, `confirmCut` 820, `startProgram` 894, `autoChamber` branch at 481) stays as the comparison flag and is inert when `GESTURE.on`.
- skill.js:492 / 529 (`this.lunge = SKILL.lungeTime`, `f.move.y = Math.max(…)`): skip when `f.strike.S > 0.3 && f.strike.stepRequested` (merge with the passing step, §2-4).
- skill.js:510-511 (`SKILL.homeGuard[0] - off.x`): use `f.strike.homePad ?? SKILL.homeGuard`.

**AI hook (for R5 `planStrike`)**: `Gesture` is source-agnostic — it reads any `FingerTrace`. R2 adds `SyntheticFinger` in gesture.js: `traceFromPath(points /* pad m */, speeds /* m/s */, t0)` pushes `(t, dx, dy)` pieces into a per-fighter `FingerTrace` (the enemy gets `skill.trace = new FingerTrace()` and `skill.detect = true` when `GESTURE.ai`). Today the AI writes `handOffset` directly in `ai.js:1256 moveHand(dt)` along `this.path` built in `ai.js:865 startStrike()` and clamps at `ai.js:1303 if (off.length() > 0.62) off.setLength(0.62);` — R5's `planStrike` will emit a wind-up leg (toward the chamber node, beyond the disc) followed by the stroke leg into the synthetic trace **before** that clamp; the same `Gesture` then produces S/φ/family for the AI, so the AI uses the identical whole-body path. R2 only lands the interface and a unit test that a synthetic zornhau path yields `famA = zornhau_right`, `S ≥ 0.9`, reversal detected within one step.

**Config (`CONFIG.GESTURE`, first values from §9)**: `{ on: true, ai: false, sL0: 0.12, sL1: 0.55, padExt: 1.0, restV: 0.25, restDwell: 0.04, vStrike: 1.5, reverseDot: -0.3, kStroke: 0.4, strokeL0: 0.35, strokeL1: 0.9, windDecay: 0.25, lateSelect: 0.07, angTol: 35, predictMs: 8, kv: 0.35, phiFilterW: 60, leadMs: 40, nodeR: 0.30, deadSector: [-110, -70] }`.

---

### 2-4. `src/strike/drive.js` — ClipDrive (클립 따라가기)

**Core rule (additive size delta)**: for every driven quantity X,

`X_cmd = X_guard(pad) + Δ_X(φ, S)`, `Δ_X = X_clip(φ, S) − X_small(φ)` (family-blended), with `Δ ≡ 0` when `S == 0` (code path skipped).

Why: small == guards (start/end 0 cm, wind-end chamber `[0.219,0.152,0.057]`·Qc(45°,3°) = `[0.115, 0.15, 0.195]` ≈ 어깨 지붕 `[0.12,0.14,0.2]`), so the delta is "how much bigger the human motion is than the arm cut at this phase", added to wherever the finger actually is. This keeps the finger sovereign (off-path finger = steering), makes S → 0⁺ continuous, and places the hand in the clip's chest frame at S = 1 (because `X_clip` already contains `Qc`, and `Qc` is what the trunk is commanded to). The redesign's `slerp(this.yaw, commanded chest, S)` is thus realised without a second frame blend.

**Cut start carry-over**: at the reversal φ jumps from φ_wind to 0. To avoid a pose step, `Δ_eff(φ) = Δ(φ, S) + [Δ(φ_rev, S) − Δ(0, S)]·(1 − sj(φ / 0.3))` (`sj` = min-jerk 0→1, same helper as skill.js:52). The hands are nearly still in the first 60–80 ms of a real release, so the 0.3 φ window (≈ 70–100 ms) hides nothing.

**Per-step order** (inside `Fighter.step`, fighter.js:716-724 `this.skill.update(dt); this.updateBodyPose(dt); this.driveBalance(dt); … this.applyPose(dt); … this.driveSword(); this.offHand(); this.driveJoints(); this.elbowGravity();`):

1. `skill.update` → `gesture.update` → `drive.sample()` (one `atlas.sample` at φ_body, S; computes Δ, Δ̇, Δ̈ for trunk, hand, sword, poles, girdle, feet; aim warping; step request; publishes on `f.strike`).
2. `updateBodyPose` (605-653): keep the whole existing body — `const G = guardAt(sk.aimRaw.x, …)` (608), the `follow()` filter (612-615), the `else` branch (645-650). After line 650 insert `if (st.S > 0) this.drive.addTrunk(bp, bv, dt);` which does `bp.pelvisYaw += Δpel; bv.pelvisYaw += Δ̇pel` (same for `chestYaw`, `pitch`, `drop`, new `side`). The clip share bypasses `follow()` (34/26 rad/s, `holdSpeed`) exactly as the redesign asks ("필터 대신 시간표"); the guards share still filters. `this.pelvisYawOffset = bp.pelvisYaw;` (651) then carries the clip pelvis yaw into the anchor and gait.
3. `driveBalance` anchor (1309-1324): `anchorQ` (1309-1310) already includes `pelvisYawOffset`. Replace the loop body at 1321-1324 for the yaw axis only:
   `raw.jointConfigureMotor(h, AX_YAW, 0, 0, BODY.uprightStiffness·assist·r·(1 − DRIVE.anchorYawRelax·S), BODY.uprightDamping·assist·r)`; other axes unchanged (`jointConfigureMotorPosition`). Because the anchor is a kinematic body whose rotation is set every step, the damping term already acts as a velocity servo toward the commanded pelvis yaw rate; relaxing the position stiffness (0.9·S) lets the pelvis carry momentum (R4 scales the damping further). `AX_YAW` must be measured once: `JointData.generic(…, axis (1,0,0))` makes the joint frame x = forward, so yaw should be `MOTOR_AXES[1]` (AngY), whereas `uprightRelax` (1189-1202) treats `MOTOR_AXES[2]` as yaw — the first task in work item 4 is a 20-line probe that applies a pelvis yaw torque with each axis motor zeroed and picks the axis that yields.
   Feed-forward: `pelvis.addTorque(UP·ffGain·I_pel·Δ̈pel)` (reaction on the kinematic anchor = ground, the same abstraction the upright motor already uses).
4. `applyPose` spine (1541-1545): `const twist = THREE.MathUtils.clamp(chestYaw - …, -0.8, 0.8);` → `±(0.8 + 0.15·S)` (0.95 at S = 1); `spine('abdomen', bend * 0.5, twist * 0.45); spine('chest', bend * 0.5, twist * 0.55);` gain a side-bend argument `bp.side·0.5` on the x Euler slot. Joint limits: `jointSetLimits(abdomen, AngY, ±(0.5 + 0.05·S))`, `(chest, AngY, ±(0.6 + 0.10·S))`, hips y `±(GAIT.hipTwist + 0.2·S)` (0.9 → 1.1, Q5) set per step (cheap), so S = 0 leaves the constructor limits; soft limit: from `softLim 0.15 rad` before the widened limit add `−k_soft·S·(q − (lim − 0.15))` with `k_soft 400 N·m/rad` (chest/abdomen) and `600` (hips) — active only when S > 0.
5. `driveJoints` (1552-1600): rate clamps `clamp(…, -15, 15)` at 1591 and 1596 → `±(15 + 25·S)`; co-contraction: `k`,`d` (1564-1565) × `(1 + 0.5·S)` for `uarmS`/`farmS` via `j.cocon`; spine FF torque after `raw.jointConfigureMotor` for `abdomen`/`chest`: `τ = ffGain·I_j·Δ̈chestYaw·share` about the joint's y axis (`addTorque` child +, parent −), shares 0.45/0.55 like the twist split.
6. `manualMuscle` (1642-1686): `if (wT.length() > 20) wT.setLength(20);` (1660) → `20 + 20·S`; add `+ I_arm·α_des` where `α_des` = second difference of `j.target` (prev, prevPrev) low-passed 40 rad/s, only when S > 0. Hill curve and `maxT` (80 N·m) untouched (Q4).
7. `driveSword` (1688-1849): after `handLocal.x = Math.min(handLocal.x, this.closeReach());` (1719) insert `if (S > 0) handLocal.add(drive.handDelta);` (facing-local; `closeReach` and the pad disc apply to the arm share only, as the redesign specifies); after `if (cp.w > 0) this.cutAim(aim, cp);` (1744) and before `aim.applyQuaternion(this.yaw);` (1746) insert `if (S > 0) aim.applyQuaternion(drive.aimDelta).normalize();` where `aimDelta` = rotation from `small(φ).swordFacing` to `clip(φ,S).swordFacing`. `wAim` 25 rad/s (1751) is R0's business (`STRIKE.wristRel`); the clip's sword rate reaches 26–27 rad/s at tr–tc in large oberhau/scheitelhau/schielhau, which the old world clamp would have cut.
8. `armIK` (1925-1955): root `S` (1931) `+= drive.girdleS·S` and the joint anchor moved to match (§2-2 rule 2); `pole` (1938) → `drive.poleS` (hysteresis, §2-2 rule 3); count clamps at 1935. `offArmIK` (2006-2035): pole (2018) → `drive.poleO`; root `+= girdleO·S`. `offHand`'s target (1981 `gripAim = aimDirW·along + sword pos`) is left alone in R2 (R3 does the lever); with the clip aim it already lands the off hand on `handO` (= `handS + sword·(−0.14)`, format §3-6).
9. `elbowGravity`, `trackBlade`: unchanged.

**Legs (`src/strike/drive_legs.js`, hooks in gait.js)**

- Foot pivot (Q5): in `poseLegs` stance branch after `l.heel += (heel - l.heel) * 0.3;` (gait.js:810): `l.heel = max(l.heel, drive.heel[l.k])` with `drive.heel = clipLift·GAIT.heelMax·S` (`heelMax 0.5`); `l.yaw = l.yawTD + Δfootyaw·S` (game sign `−deg·D2R`) for the stance foot. In `pinFeet` the yaw friction lever `const lt = GAIT.pinMu * l.Nf * 0.05;` (1038) becomes `0.05 → 0.02` when `l.heel > 0.3` (toe pivot: the contact patch is the ball of the foot; a physical statement, not a cap). `GAIT.swingTwist` clamp in `target()` (713 `clamp(wrap(l.yaw1 - pel), -GAIT.swingTwist, GAIT.swingTwist)`) → `±(0.6 + 0.4·S)` (1.0 at S = 1).
- Passing step (Q7 default yes): when φ crosses `step.liftPhi` (0.14 large / 0.178 medium, blended) with `S > stepS0 0.3` and the family is locked, `gait.requestStep({ kind: 'pass', fwd: step.fwd·S, side: step.side·S, duration: (step.landPhi − step.liftPhi)/φ̇_body, hold: 0.3 })` (gait.js:222-232). `requestStep` picks the rear foot (`gait.js:411 next = this.req.kind === 'lunge' ? front : front === 'F' ? 'B' : 'F'`) — in the game guard stance the sword-side foot is front, so the off foot passes; the clip's stance is the opposite (sword foot rear, Meyer's "right cut, right foot"). R2 accepts either; the landing metric is what the gate checks. `touchdown` (gait.js:721-743) calls `this.onTouchdown(l.k, strength, kind)` (742) → drive records `tLand − t(φc)` for `chain.mjs` ("딛는 때가 겨눈 선 ±50 ms"). Refusals (`move.y < −0.1`, `!GAIT.requestSteps`, not standing) are counted in `f.strike.stats.stepRefused`, never retried silently. `requestStep` clamps `duration` to `[0.28, 0.7]` (gait.js:226) — see §6 (Q7).
- Lunge merge: when the step is requested, skill.js:492/529 joystick lunge is skipped (`COMMIT.armLunge` analogue).

**Aim warping (≤ warpMax 0.25 m)**: at the reversal (and refreshed until φr) compute the world point the clip hand will have at φc (`chest + yaw⊗Qc(φc)·handS(φc)`), the target zone by family (zornhau/oberhau/scheitelhau/schielhau → head/neck line `chest + (head − chest)·0.5` as `COMMIT.planeK`; mittelhau/zwerch → shoulder line; unterhau → abdomen/arms; krumphau → hands), the component of (target − predicted sword mid-point) perpendicular to the clip sword direction, clamp to 0.25 m, and add it to `handDelta` with envelope `env(φ; φr−0.05 → φc rise, hold to φf, fade by φg)`. Reuses `cutPlane`'s foe geometry (fighter.js:1881-1923) for the normal. It bounds assistance, not the player (§6).

**Config (`CONFIG.DRIVE`, first values)**: `{ on: true, ffGain: 0.8, ffI: { pelvis: 1.2, abdomen: 0.9, chest: 0.6, arm: 0.12 }, anchorYawRelax: 0.9, twistWide: 0.15, limWide: { abdomen: 0.05, chest: 0.10, hip: 0.2 }, softLim: 0.15, kSoft: { spine: 400, hip: 600 }, rateLimS0: 15, rateLimS1: 40, wTargetS0: 20, wTargetS1: 40, cocon: 0.5, poleRate: 12, girdleRate: 0.5, stepS0: 0.3, stepHold: 0.3, warpMax: 0.25, heelPivotLever: 0.02, puppet: false }`.

---

## 3. S = 0 불변 논증

1. Every new statement in `fighter.js`, `gait.js`, `skill.js` is guarded by `S > 0` (or `puppet`), and every modified constant is written as `base + (wide − base)·S` so that at S = 0 the expression evaluates to the original literal (`15 + 25·0 === 15`, `20 + 20·0 === 20`, `0.8 + 0.15·0 === 0.8`, limits `0.5 + 0.05·0`, `GAIT.swingTwist + 0.4·0`), and `jointSetLimits`/`setAnchor1` are only called when S > 0 (so the constructor values persist bit-for-bit).
2. `gesture.update` writes only `f.strike`; with `GESTURE.on` the old `detectCommit` is not called, so `fighter.commit.on` stays false and `cutPose.w`, `rest.w` stay 0 — the arm-cut branch of `updateBodyPose` (645-650) and `driveSword` (`cp.w > 0` false) run the existing code. The R2 baseline is "arm cut without commit" plus R1's intended latency changes.
3. `Δ(φ, 0) = clip(φ, 0) − small(φ) = 0` identically (same sample), so even if a caller forgot the guard, the delta is zero; the guard exists to make it byte-identical, not only numerically identical.
4. Atlas continuity at S → 0⁺: validated at load (`atlas_check.mjs`) — small clip start/end vs `guardAt(startFrom)`/`guardAt(recoverTo)` hand ≤ 0.02 m (format promises 0), small tw hand vs the family's chamber guard ≤ 0.03 m (zornhau: 0.115/0.15/0.195 vs 0.12/0.14/0.20).
5. Regression test (work item 6): `chain.mjs` replays the same finger trace with `GESTURE.on` true/false and a trace that never winds (S = 0 throughout) and asserts identical record/1 output (tip/hand series equal to 1e-9) at 60 and 120 Hz for three weapons; then the ±2 cm hand-shape test against the S = 0 record of R1.

---

## 4. 꼭두각시 모드와 관문

**Puppet mode** (`src/strike/puppet.js`, `tools/sim/puppet.mjs`, `?puppet=<clipId>&loop=1` in `main.js` — parse next to `params.get('fps')` at main.js:1241):

1. Kinematic retarget check (no physics): for each grid φ, build pelvis/chest frames from `pelvis.yaw/pitch/drop`, `chest.yaw/lean/side` on the game segment heights (`hipY 0.93, waistUp 0.13, chestUp 0.27`), shoulder = `(0,0.1,±0.2) + girdle`, two-bone IK with `a 0.3, b 0.265` and the clip pole → elbow, hand; sword tip = hand + `sword·(hilt 0.13 + blade 1.05)`; compare with the clip's own `J` (`elS`, `hS`, `tip`) in the clip world frame. Records `hand err` (mean/max over t0…tf and t0…tg), `tip err`, `pole flips`, `reach clamps`.
2. Ragdoll puppet: `setBodyType(KinematicPositionBased)` on all fighter bodies and the sword, place them from the FK every step (`setNextKinematicTranslation/Rotation`), legs from `legIK` targets solved kinematically; the enemy removed; record with `game_joints.mjs jointsOf` → `stillness-motion-record/1` (`kind: 'puppet'`) → `tools/motion/compare.mjs` and `viewer.html` overlay. This is the picture the owner sees first: does the game skeleton, placed on the clip, look like the reference.
3. Then switch physics on (`DRIVE.on`) and replay the same clip as a synthetic finger through gesture (S = 1, φ from the clip time) → tracking record; the difference between puppet and tracked records is the drive's error.

**Gates (numbers from §8 R2 row, §2-6, targets.md; all minimum targets, no upper bound on speed)**

| gate | number | how measured |
|---|---|---|
| Puppet hand error | ≤ 0.03 m (mean over t0…tf, every v0 clip, 3 sizes) | step 1 above vs clip `J.hS`; known offsets: pflug 2.8 cm (game guard beyond reach), scheitelhau tc +0.5 cm |
| Puppet sword | tip ≤ 0.05 m, direction ≤ 5° | vs `J.tip` |
| Retarget report | 0 unreported clamps | `atlas.report.reach`, `f.strike.stats.reachClamp` |
| Motion size (S = 1, longsword, large clips) | wind hand ≥ head top + 0.05 m (overhead cuts), hand ≥ 0.10 m behind torso front, shoulder elevation ≥ 130° (overhead) / 110° (zwerch), blade ≥ 1.0 m behind chest, follow-through hand side ≤ −0.30 m (diagonal) / −0.33 m (horizontal, rising), chest range ≥ 120°, pelvis ≥ 65°, X-factor order (chest more wound than pelvis at tw, pelvis releases first), hand path ≥ 1.8 m | `shape_metrics.mjs` on the tracked record (same code as the clips) |
| S = 0 | byte-identical record; ±2 cm vs R1 | §3 item 5 |
| Wind follows the finger | pelvis 5° within ≤ 33 ms (60 Hz) / 25 ms (120 Hz) of the drag start | `chain.mjs` latency block; finger step of 0.3 m in 50 ms |
| Tracking | hand mean error ≤ 0.08 m after time alignment on tc, sword ≤ 15° | tracked record vs clip (DTW as `compare.mjs`) |
| Chain order | pelvis ≤ chest ≤ hand ≤ tip peaks (10 ms tie), step landing within tc ± 50 ms | `chain.mjs` |
| Per-round battery | 60/120 Hz, 24–45 fps jitter, 3 weapons, miss/hit/blocked, AI-vs-AI 10 min (NaN 0, falls not increased, glitch 0), CPU ≤ +5–10 %, sampling ≤ 0.05 ms/step | existing harness + `chain.mjs` |
| Owner | comparison viewer screenshots (puppet ‖ clip, tracked ‖ clip) for zornhau/oberhau/mittelhau/unterhau right | `viewer.html` |

---

## 5. 위험과 대응

| risk | evidence | mitigation |
|---|---|---|
| Trunk feed-forward fights balance (feet slip, falls) | `pinFeet` yaw lever 18 N·m at 400 N; anchor is the only pelvis actuator today | stage `ffGain` 0 → 0.8 and `anchorYawRelax` 0 → 0.9 with the AI-vs-AI fall counter at each step; foot pivot reduces the needed hip twist; R4's capture-point step is the real fix — R2 ships with the numbers that keep falls at the R1 level |
| Looks like canned animation | clip is a full-body timetable | Δ is added to the finger-driven pose (finger steers), ffGain 0.8 leaves PD and contacts to disturb, three sizes blend continuously, hits break the timetable (φ keeps running but the body lags physically) |
| Wrong family | wind-end angle noisy, 8-way wheel | two-node blending, `lateSelect`, `angTol 35°`, finger delta keeps aim; reserved nodes excluded until discriminators exist |
| Elbow flip | mittelhau_large 0.88/1.07 s; krumphau_small pole projection 0.32 | hysteresis + rate 12 /s; puppet reports flips per clip |
| Reach saturation | scheitelhau tc +0.5 cm; game guards +3 cm | report counters; trunk lean/yaw from the clip; if persistent, feed back to the motion PM (no silent scaling) |
| Moving shoulder anchor injects energy | `setAnchor1` per step | rate 0.5 m/s, scaled by S, only while S > 0; fallback fixed anchor documented in §2-2 |
| Medium clips ask > 160° wrist | v0 medium zwerch/krump/zorn | those cuts are reserved or their medium is reported; motion PM's v1 medium; the physics will simply lag (reported in tracking error, not hidden) |
| φ from 60 Hz input jitters | pieces every other physics step | φ integrates event-time velocity from `fingerTrace.at`; 2nd-order filter ω 60; lead ≤ 40 ms·S |
| Step refused (retreating) | `requestStep` returns false | counted; the cut still runs (weaker, physical); shown in `chain.mjs` |
| Rapier motor axis mix-up (`uprightRelax` treats AngZ as yaw) | fighter.js:1199 `const min = ax === MOTOR_AXES[2] ? RECOIL.anchorYaw : RECOIL.anchorPitch;` vs the generic joint frame (x = forward → AngY should be yaw) | probe first (work item 4, step 0) |
| Bundle size | 24 clips raw ≈ 5 MB | packed atlas ≈ 1.3 MB base64 (float16 ≈ 0.7 MB), lazily imported with the strike module |

---

## 6. 한도처럼 작용할 수 있는 값 → 사장님 질문

| value (first) | where | why it could cap/floor | owner question |
|---|---|---|---|
| `kStroke 0.4` | gesture S_stroke | caps S for strokes without a wind | **Q3** (default 40 %) |
| `sL1 0.55`, `padExt 1.0`, S ∈ [0,1] = 'large' | gesture | S saturates at the authored large clip; pulling beyond 0.55 is slack; bigger-than-large needs extrapolation (S > 1) | **Q21** (gesture extent); weapon-class sizes **Q26** |
| `windDecay 0.25 s`, free wind hold | gesture | none (wind is free) — listed because a cost here would be a limit | **Q2** (default free) |
| `hipTwist 0.9 → 1.1`, `swingTwist 0.6 → 1.0`, spine twist `0.8 → 0.95`, joint limits `0.5/0.6 → 0.55/0.7`, `softLim 0.15`, foot pivot lever 0.02 | drive/gait | ranges bound the trunk turn; soft limits push back before the limit | **Q5** (default allow) |
| passing step `fwd = 0.78·S` (clip) vs the redesign's 0.5 m; `stepS0 0.3`; gait `duration` clamp `[0.28, 0.7]` (gait.js:226, pre-existing) — the clip's swing is 0.24 s, so the floor makes the foot land late at high φ̇; `requestStep` refuses while retreating | drive_legs/gait | the 0.28 s floor is a floor on step speed; refusal removes the leg share | **Q7** (default yes; proposal inside Q7: lower the floor to 0.20 s for `kind:'pass'` strike steps — pending) |
| motor target-rate `15 → 40 rad/s`, `manualMuscle` `20 → 40 rad/s` (by S) | driveJoints/manualMuscle | still clamps; a silent floor on the feed-forward chain if too low | **Q4** (with the muscle limits 80/22 N·m, Hill vmax 30/18/25 that stay) and **Q22** (protective values) |
| forearm-relative wrist 60 rad/s | R0 `STRIKE.wristRel` | clip needs 26–27 rad/s at tr–tc; protective | **Q22** |
| `anchorYawRelax 0.9·S` | driveBalance | how much of the invisible hand remains sets carry/recoil | **Q1 / Q24** (R4 tunes) |
| `1/T0(S)` floor on φ̇ (φ never slower than the clip's natural pace once released) | gesture | a floor on speed, not a cap; what stopping costs | **Q1** (R4 brake `brake0/brakeK`) |
| `leadMs 40·S`, `phiFilterW 60` | gesture | stability values | **Q22** |
| `lateSelect 70 ms`, `angTol 35°`, `vStrike 1.5`, `reverseDot −0.3`, `restV 0.25`, `restDwell 40 ms`, `nodeR 0.30`, dead sector | gesture | detection thresholds: too strict = fewer whole-body cuts | **Q21** |
| `warpMax 0.25 m` | drive aim warping | bounds assistance (aim help), not the player; 0 = no help | not a limit on the player; no Q needed — reported for transparency (it belongs with **Q17** feel checks in the owner build) |
| armIK `d ≤ 0.565`, off arm `0.575` (existing) | armIK/offArmIK | anatomical; reported, never scaled | none (physiology, reported) |
| `ffGain 0.8`, `cocon 0.5`, `ffI` | drive | gains, raise if the chain is late; not caps | none |
| AI minimum wind time | R5 | — | **Q8** |

No new owner question is added; the one pre-existing clamp that R2 wants to move (gait swing duration floor) is filed under Q7.

---

## 7. 작업 나누기 (worktree 단위, 파일 경계, 순서)

| # | item | files (only) | depends on | done when |
|---|---|---|---|---|
| 1 | **atlas + pack** | `src/strike/atlas.js`, `tools/motion/pack_atlas.mjs`, `src/strike/clips/atlas_v0.json`, `tools/sim/atlas_check.mjs`, `config.js` `ATLAS` block | clips on `main` (`git checkout main -- docs/motion/clips` into the worktree or read from `/home/user/halfsword`) | `atlas_check.mjs` prints the reach/flip/wrist report of §2-2, validation throws on a clip/1 fixture and on a mutated channel width, small-vs-guards ≤ 0.02/0.03 m, sample ≤ 0.02 ms |
| 2 | **puppet** | `src/strike/puppet.js`, `tools/sim/puppet.mjs`, `main.js` (`?puppet=` ≈ 10 lines), record/1 output | 1 (can start on raw clips through `loadAtlasFromClips`) | hand ≤ 0.03 m for 24 clips, tip ≤ 0.05 m, viewer screenshots |
| 3 | **gesture** | `src/strike/gesture.js`, `config.js` `GESTURE` block, `skill.js` hooks (lines 392-407, 492/529, 510-511), `tools/sim/gesture_replay.mjs` | R0 `fingerTrace.at` | replay of the 9 `docs/motion/records` inputs + synthetic winds gives the expected node/S/φ; reversal detected in 1 step; S = 0 for the arm-cut records |
| 4 | **drive — upper body** | `src/strike/drive.js`, `fighter.js` hooks (605-653, 1309-1324, 1541-1545, 1552-1600, 1642-1686, 1688-1849, 1925-1955, 2006-2035, ctor 233), `config.js` `DRIVE` block | 1, 3 (interfaces `atlas.sample`, `f.strike`) | step 0: yaw-axis probe; then S = 0 byte-identity, tracking ≤ 0.08 m / 15°, latency gate, shape gates (except step) |
| 5 | **drive — legs** | `src/strike/drive_legs.js`, `gait.js` hooks (713, 742/750, 810, 1038), `skill.js` 492/529 merge | 4 (for φ and S), 1 (`atlas.step`) | step lands within tc ± 50 ms in ≥ 80 % of S = 1 strokes at 1.6–2.0 m, no increase in falls, pivot yaw ≥ 25° of the clip's 35° |
| 6 | **measurement + owner build** | `tools/sim/chain.mjs` (extend R0's), `tools/motion/compare.mjs`/`viewer.html` (game record overlay already exists), `docs/motion/records/*` new records | all | R2 gate table filled at 60/120 Hz × 3 weapons, screenshots delivered, S = 0 identity report |

Order: **1 → (2 ∥ 3) → 4 → 5 → 6**. Items 1 and 3 can start today in separate worktrees (no shared files); item 2 needs only item 1's `loadAtlasFromClips`; item 4 is the merge point (its hooks are the only edits to `fighter.js`); item 5 touches `gait.js` only, so it can be developed against item 4's branch without conflicts; item 6 runs continuously from the first tracked record.

Seams left for later rounds: R3 reads `f.strike.S`, `phi`, `d1.sword` for the late wrist release and the off-hand lever in `offHand` (1964-2004) and `combat.js:155 mEff`; R4 replaces the φ clock after 1.0 with brake dynamics and scales `anchorYawRelax`/damping and `GAIT.maxAccel`; R5 reads `f.strike.openness`, `guardGap`, `nearGuards` in `ai.js:666 opportunity` and feeds `SyntheticFinger` from `planStrike`; `combat.js:565` gains `if (att.strike?.active) att.drive.onStrikeResult(kind, r)` beside the commit call so results are stamped with φ and S in record/1.
