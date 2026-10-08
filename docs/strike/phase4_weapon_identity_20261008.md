# Phase 4 · opponent and weapon identity · 2026-10-08

Baseline: `5cb606fce3b369d309ab7b4e6a685d6228ecb7f1`. User requested the remaining Phase 4 work. The bounded goal is to check representative opponents and weapon choices, reuse valid evidence, and fix demonstrated mismatches rather than launch another balance study.

## Finding and change

With `?foe=bran&foeWeapon=chicken`, the card and fighter correctly used `rubber_chicken`, but `prepareRound` retained the raw alias. `newRound` passed that alias as the AI school; `schoolOf` fell back to longsword. The actual browser baseline reproduced this on entry and restart. The canonical `rubber_chicken` URL was the control. AI reach was 1.305263 versus 1.24 and cutTime .131707 versus .13. The wrong school also contains five thrust techniques, but blunt damage weights can suppress selection: this is **not evidence that the chicken actually stabbed**.

Resolve the chosen enemy weapon through the existing `getWeapon(...).id` once in `prepareRound`. Card, fighter and AI then use the same identity. Query precedence, ordinary roster choice, character persona, physical weapon properties, player control and damage formulas retain their existing behavior. Unknown IDs retain the existing longsword fallback. No new weapon/AI system or general physics tuning is introduced.

## Evidence and limits

- Reused [first exchanges](phase4_opening_20261007.md) and [pacing fix](phase4_pacing_20261007.md): Bran, Isolde and Margarethe differ under the same two input conditions. Isolde's healthy patient distance is not a demonstrated bug. The ordinary six character mappings and Bran's alternative preserve their character settings; unfinished `persona.whole` data remains the explicitly documented draft.
- Browser tool: [phase4_weapon_identity_20261008.mjs](../../tools/browser/phase4_weapon_identity_20261008.mjs). Three native card rounds: chicken alias, its restart, canonical control. Random player cards, trusted touch/stick/pause, fresh round identities, weapon-dependent ordinary defaults and unchanged stored preference bytes. No RNG, body, velocity, AI or damage assignments. These are short opening rounds, not a walking-distance, attack outcome, win-rate or full-combat test.
- First two baseline attempts are retained harness failures: preview server absent (zero rounds), then an incorrect foe-card selector before selection. Baseline03 reproduces the game defect and passes the protocol. Local/public fixed runs and exact executed hashes are recorded in [delivery receipt](phase4_weapon_identity_release.json).
- Existing emotion checks 5/5 and hand-controller checks 60 cases/306 assertions passed during independent review. An initial generic test command rejected missing custom-runner arguments, then the documented command passed. No duplicate whole-combat matrix was run.
- Candidate01 passed the same three-round protocol: both alias entries and canonical control use rubber_chicken, with zero browser errors and unchanged source/build during execution. Independent configuration audit passed all 14 aliases × six opponents (84 comparisons), six ordinary persona identities, Bran's alternative and six unknown-ID fallbacks. This audit uses the exact extracted preparation function and actual AI constructors; it does not run combat.
- Public01 completed all three identity contracts but failed the overall protocol: seven cardback PNG requests returned HTTP 503. The same seven URLs subsequently returned 200 with exact local asset bytes. The failed run is retained; the precise upstream cause is unproven. One bounded unchanged-protocol retry and a separate query-free opening-release/movement/phone-plan check are recorded in the receipt.
- Public02 passed all three identity rounds with zero errors. The separate public-smoke01 completed ordinary entry, opening release, one second of trusted movement, pause and both phone-plan layouts, but failed overall on one further cardback 503. It remains a failed transport attempt; the final smoke retry and its outcome are in the receipt. Movement displacement is functional evidence, not a speed/balance measurement or physical-phone validation.
- Public-smoke02 passed with zero errors: query-free Zweihander versus Heinrich, normal hold release, trusted movement from fightT 2.442 to 3.458 seconds, finite state and pause/input reset; the plan fits 390×844 and 844×390. Final delivered game commit `d597ccb48a54b4bd4bb2e69a257c07f6a95988aa`, deployment run `37708930719` succeeded, and eight public HTML/JS files match the tested build. Both transport failures remain preserved and their precise cause remains unknown.

Raw manifests, reports, executed tool and screenshots are preserved outside Git under `/workspace/halfsword-handoff/phase4-weapon-identity-20261008/browser/`. The receipt includes exact hashes and measured results so this summary does not depend on chat context.

```sh
node tools/browser/phase4_weapon_identity_20261008.mjs \
  --expect=fixed \
  --base=http://127.0.0.1:4173/ \
  --out=/workspace/halfsword-handoff/phase4-weapon-identity-20261008/browser/NEW-RUN
```

Omit `--base` for the public site; use a fresh output directory. The installed Playwright module defaults to the cloud onboarding browser package. Build bytes must match local `dist`; source/tool/build hashes are captured. Each run is bounded to three rounds, under eight simulated seconds per round and 240 wall seconds. Baseline mode explicitly expects the old mismatch.

## Phase boundary

This closes the planned basic quality pass once public delivery passes: repetition/resources → first exchange → outcome/restart → representative content identity. It does not close all content expansion, physical-phone endurance, global difficulty tuning or human motion research. Armor B promotion and previously withheld weapons/arm research keep their existing status. Current next steps are in [ACTIVE_PLAN](../codex_team/ACTIVE_PLAN.md).
