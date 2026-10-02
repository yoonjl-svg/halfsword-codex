# Independent native-motor engine recipe

This recipe writes only to an external `ENGINE_RESEARCH_ROOT` (default `/tmp/halfsword-engine-research`). It preserves the game npm/src/locks, HOME, inherited proxy and TLS validation. Linux x86_64 needs Git, curl, tar, Python3.11+, Node/npm, C compiler/linker. The historical build used Rust1.89.0, Node24.19.0/npm11.9.0, wasm-pack0.12.1, wasm-bindgen0.2.100 and Binaryen112. Downloads are pinned and SHA-checked; Rust components are managed by the pinned toolchain and rustup's manifest integrity checks.

```sh
export ENGINE_RESEARCH_ROOT=/tmp/my-native-motor-research
bash tools/engine/setup_toolchain.sh
bash tools/engine/build_3d_compat.sh
node tools/engine/import_smoke.mjs
python tools/engine/write_receipt.py
```

Setup clones **only official** `https://github.com/dimforge/rapier.js.git` tagv0.19.3 and verifies commit `0fd32c1cbbc7018af36f09b190c16ce72fbb9301`. It checks/applies `native_motor_binding.patch`; an exact existing patch is recognized and skipped, partial/conflicting edits abort. Original Cargo.lock SHA256 is `233d13421c0d0ac34b2165d1791a6ad303dd46bd83ab2ca94328c289d9aebecc`. Binding patch SHA256 is `a72d84ecf75566691e9fdc7cfefefcd4dea8acc0e8ade09f9cf2986250aad3b7`.

The official tag template disagrees with its committed lock: package0.19.3/direct parry^0.25.3 versus locked workspace package0.19.2/parry0.25.2. Generated manifests match the lock's0.19.2 metadata and omit the newly added direct parry dependency. Source uses Rapier's re-exports, and the historical build compiled successfully with **Rust Rapier0.30.1/parry0.25.2** without engine dependency upgrades. Thus `RAPIER.version()` returns0.19.2. This is a tag-source plus committed-lock research rebuild; it does not reproduce the published npm binary. All six manifest skeletons permit locked workspace resolution; only normal3D compat is built.

The high-level ES module is `$ENGINE_RESEARCH_ROOT/rapier.js/rapier-compat/builds/3d/pkg/rapier.mjs` (also CJS); WASM is base64-inlined. `await RAPIER.init()` requires no external WASM. The five new API methods live on `world.impulseJoints.raw`. API availability does not prove motor impulse units, substep meaning or realistic movement; separate fixtures supply those results. Upstream compat init's deprecated-parameter warning and rollup circular-import/base64 source-map warnings were observed in the successful build.

`recipe_provenance.json` separates original external script hashes from portable file hashes. The prior external build passed import/high-level/one-step smoke; module SHA256 `a3be9d8361b386b0b664ee7ba771f14ae60e93eda9a4ab825f1de1260dbb5623`. **This port passed syntax and official patch checks only; a clean rebuild of the port has not been run.** Build scripts preserve new logs/manifest diff/receipt under the selected external root. No binary, node_modules or complete lockfile is included here, and no game engine is replaced or publicly connected.
