#!/usr/bin/env bash
set -euo pipefail
RECIPE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$RECIPE_ROOT/engine_env.sh"
TASK_ROOT="$ENGINE_RESEARCH_ROOT"
check_engine_checkout
cd "$TASK_ROOT/rapier.js"
[[ "$(git rev-parse HEAD)" == 0fd32c1cbbc7018af36f09b190c16ce72fbb9301 ]]
LOCK_BEFORE="$(sha256sum Cargo.lock | cut -d' ' -f1)"
python "$RECIPE_ROOT/bootstrap_workspace.py"
wasm-pack --verbose build --target web --out-dir ../../rapier-compat/builds/3d/wasm-build ./builds/rapier3d --locked > "$TASK_ROOT/evidence/wasm-pack-3d.log" 2>&1
[[ "$(sha256sum Cargo.lock | cut -d' ' -f1)" == "$LOCK_BEFORE" ]]
python "$RECIPE_ROOT/prepare_compat_3d.py"
cd rapier-compat
./node_modules/.bin/rollup --config .engine-research-rollup3d.config.js --bundleConfigAsCjs > "$TASK_ROOT/evidence/rollup-3d.log" 2>&1
