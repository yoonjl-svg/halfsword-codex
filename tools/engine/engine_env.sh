#!/usr/bin/env bash
# Source; caches/checkouts are external to the game. HOME/proxy/TLS are preserved.
RECIPE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
GAME_ROOT="$(cd -- "$RECIPE_ROOT/../.." && pwd)"
export ENGINE_RESEARCH_ROOT="$(realpath -m -- "${ENGINE_RESEARCH_ROOT:-/tmp/halfsword-engine-research}")"
case "$ENGINE_RESEARCH_ROOT" in /|"$GAME_ROOT"|"$GAME_ROOT"/*) echo 'Research root must be separate from the game' >&2; return 1;; esac
export RUSTUP_HOME="$ENGINE_RESEARCH_ROOT/toolchain/rustup"
export CARGO_HOME="$ENGINE_RESEARCH_ROOT/toolchain/cargo"
export RUSTUP_TOOLCHAIN=1.89.0
export NPM_CONFIG_CACHE="$ENGINE_RESEARCH_ROOT/toolchain/npm-cache"
export XDG_CACHE_HOME="$ENGINE_RESEARCH_ROOT/toolchain/cache"
export WASM_PACK_CACHE="$ENGINE_RESEARCH_ROOT/toolchain/wasm-pack-cache"
export PATH="$CARGO_HOME/bin:$ENGINE_RESEARCH_ROOT/rapier.js/node_modules/.bin:$PATH"
check_engine_checkout() {
 [[ "$(git -C "$ENGINE_RESEARCH_ROOT/rapier.js" rev-parse HEAD)" == 0fd32c1cbbc7018af36f09b190c16ce72fbb9301 ]] || return 1
 [[ "$(sha256sum "$ENGINE_RESEARCH_ROOT/rapier.js/Cargo.lock" | cut -d' ' -f1)" == 233d13421c0d0ac34b2165d1791a6ad303dd46bd83ab2ca94328c289d9aebecc ]] || return 1
 [[ "$(sha256sum "$ENGINE_RESEARCH_ROOT/rapier.js/src/dynamics/impulse_joint.rs" | cut -d' ' -f1)" == 49113252985c982d1e515630814f815736a72de6de14d8c194297925ca2ac8ef ]] || return 1
}
