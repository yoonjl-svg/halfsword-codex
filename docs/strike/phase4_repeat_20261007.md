# Phase 4-1: repeated rounds, 2026-10-07

The baseline showed a shader program reference increase at both restart boundaries (+69 each). The local candidate returned to the same start count after every restart. Scene objects and attached materials also returned to their original counts. All integration/provenance checks passed in both runs. Final public verification is pending; these three-round observations do not establish an unbounded-session or GPU byte guarantee.

| Measurement | Frozen public baseline | Frozen local candidate |
|---|---|---|
| Shader `usedTimes` at three starts | 271 → 342 → 464 | 185 → 185 → 185 |
| Restart: previous paused → next start | 273 → 342; 395 → 464 | 190 → 185; 192 → 185 |
| Renderer geometries at starts | 150 / 151 / 151 | 150 / 151 / 151 |
| Renderer textures at starts | 15 / 17 / 19 | 15 / 18 / 20 |
| Programs; scene objects/materials at starts | 31; 260 / 162 throughout | 31; 260 / 162 throughout |
| Simulation seconds; physics steps | 19.333; 2,320 | 19.467; 2,336 |
| Natural `applyWound` events | 18 blunt + 2 cut | 19 blunt + 1 cut |
| Trusted touch events; render wrapper calls | 112; 447 | 114; 452 |
| Start tap → fight, ms | 2,042 / 1,207 / 2,163 | 1,797 / 1,518 / 1,097 |
| Runtime/network errors; nonfinite states | 0; 0 | 0; 0 |

Baseline HEAD was `aa7ddb5c7409954fb5c2efbfc69ba08ee0b504bb`, asset `main-CxbuHD3X.js`. Candidate used the modified working tree at the same HEAD, asset `main-BI0MSntv.js`; separate source manifests identify the different code. Both before/after source/build/tool/HEAD comparisons were stable. All eight delivered files matched each run's frozen local `dist` by bytes and SHA-256. `pass=true` means the scenario, provenance, input and instrumentation assertions passed; it does not classify the baseline resource growth as acceptable.

Two browser attempts completed six rounds in two contexts, with zero failed or abandoned attempts and no reruns. Each context used three approximately 6.4-second rounds, trusted Start/Pause/restart touch, current ordinary longsword versus Heinrich, original normal AI, manual v2/fresh/bounded/player-centerline controls, limb severing on, legacy finish and gravity 9.81. Poseidon was pinned through its ordinary URL option. Every restart created new fighter/world/combat/AI/controller identities and fresh health/wounds/limbs. Preferences remained byte-identical; blood was on. No injury/position/velocity/AI state injection, seed search, forced GC or video recording occurred. Original method calls, results and exceptions were preserved. Public TLS verification stayed enabled with the inherited proxy; local comparison used loopback HTTP.

The candidate's constant start reference count is the narrow verified improvement. Geometry returned to 151 after the first fight in both runs. Different natural wound types can warm different decal texture caches; texture counts are not directly comparable as an optimization result. DOM remained 124 elements/two canvases; CDP listeners settled at 81. Heap and detached DOM counts include normal GC timing, caches and compact observer records. Geometry/texture/program/reference counts are not GPU bytes, and this probe does not establish retention of old fighter objects.

The actual renderer instance wrapper was verified by its call count. Per-frame CPU observations sum original AI, fighter, physics-world and post-step combat durations; rendering measures synchronous submission/possible driver waits. Frame input, camera/effects and observer work outside those calls are excluded. Cloud scheduling, shader warmup, software rendering and randomized contacts limit comparisons. Start latency is mixed, not a demonstrated universal speedup. These measurements are neither isolated GPU duration nor physical-phone FPS. Detailed stage timing, resource/GC checkpoints, damage, native events, manifests and hashes remain in the JSON/raw artifacts. One baseline extraction helper initially used the wrong event key; the corrected read reused the same report without a browser rerun.

Artifacts are under `/workspace/halfsword-handoff/phase4-20261007/repeat/`, separately in `baseline-public01/` and `candidate-local01/`. Each preserves `report.json`, `manifest-before.json`, three paused screenshots and the exact `executed-tool.mjs`. The same tool SHA-256 was used in both: `d3dceba3e6ef213ad2595e097ce1947fac18131287ae32102fbbc92e5d82e169`. Compact results and exact artifact hashes: [phase4_repeat_20261007.json](phase4_repeat_20261007.json).

```sh
PLAYWRIGHT_MODULE=/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/workspace/cloud-onboarding/browser/cache \
node tools/browser/phase4_repeat_20261007.mjs \
  --out=/workspace/halfsword-handoff/phase4-20261007/repeat/NEW-DIRECTORY
```

For a candidate, add `--base=http://127.0.0.1:PORT/` serving the matching frozen `dist`. Use a fresh direct child output directory and freeze source/build/HEAD/tool through the final manifest check. Final public results will be recorded separately after deployment.
