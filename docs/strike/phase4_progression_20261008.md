# Phase 4 progression UI · 2026-10-08

Two concrete baseline mismatches were reproduced: pausing a decided victory advertised an ordinary restart even though it advanced to the next opponent; a latched defeat changed its menu to victory after the enemy also died, even though the next click correctly stayed on the same stage. The corrected-collector fixed run satisfies both narrow UI contracts and all protocol checks. Candidate01 completed the UI contracts but remains a failed attempt: one asynchronous page response-body collector hit a closed target. The error lacked its URL; short-lived audio Worker termination is the supported explanation, not a proven game crash. Later runs capture and hash the identical route.fetch/fulfill bytes before worker termination. Accounting: 3 attempts, 9 rounds, 1 retained protocol failures.

| Run | Protocol / correct UI | Early victory pause: title · button · Resume visible | Delayed latched defeat: title · button | Physics steps / trusted touch |
|---|---|---|---|---|
| baseline | True / False | 일시정지 · 처음부터 다시 · True | 승리 · 다음 상대 | 416 / 31 |
| candidate01 | False / True | 승리 · 다음 상대 · False | 패배 · 다시 싸우기 | 438 / 31 |
| candidate02 | True / True | 승리 · 다음 상대 · False | 패배 · 다시 싸우기 | 406 / 31 |

The single-context protocol is identical across versions: query-free ordinary card 0 → Poseidon/Heinrich; call the actual `enemy.die('기절')` and await the original victory toast; trusted early Pause and Start → Clearing/Bran; call `player.die('기절')`, await the original defeat toast, then call `enemy.die('기절')`; wait for the normal result timer and tap Start/card 0 → fresh Clearing/Bran. The third round only verifies native input and normal Pause. Card draws and Bran's alternative weapon are not forced.

**These three explicit terminal API calls are controlled fixtures, not natural combat or human victory evidence.** Original AI/physics still advance and all UI/card/hand actions are trusted touch. No RNG, pose, velocity, direct alive flag, stage or outcome flag is assigned. Natural injury, decisive-hit slow motion, all-opponent journeys and balance are outside this test.

The baseline's protocol `pass=true` means both known mismatches were reproduced while progression integrity passed; its `contractsPass=false` remains preserved. A fixed run requires victory/next-opponent/no-Resume after early Pause, and defeat/replay/no-Resume after the later second death. Both branches also require the actual roster sequence, matching foe card/name/weapon, fresh fighter/world/AI/controller/gait identities, wound/limb reset, ordinary weapon-dependent defaults, unchanged preference bytes, observed world/visual disposal and working new native input. Disposal counts do not claim GPU bytes or performance improvement.

Every attempt preserves source/build/tool manifests, the executed tool, a raw report and three game screenshots under `/workspace/halfsword-handoff/phase4-progression-20261008/browser/`. Public delivery additionally checks the static phone plan at 390×844 and 844×390 after exporting the paused game, including the new heading, summary and no horizontal overflow. The JSON includes exact paths/hashes, source HEAD, settings, errors, outcome classification and counts without per-step dumps. See [phase4_progression_20261008.json](phase4_progression_20261008.json).

```sh
PLAYWRIGHT_MODULE=/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/workspace/cloud-onboarding/browser/cache \
node tools/browser/phase4_progression_20261008.mjs \
  --out=/workspace/halfsword-handoff/phase4-progression-20261008/browser/NEW-DIRECTORY \
  --expect=fixed
```

Add `--base=http://127.0.0.1:4173/` for a frozen matching local build; `--expect=baseline` explicitly requests reproduction of the old mismatches. Each run is capped at three rounds, eight simulation seconds and 240 wall seconds. Card waits use the real .45-second selection/.95-second skip guards and allow 45 wall seconds for software-rendered animation. No automatic retry or victory search is performed.
