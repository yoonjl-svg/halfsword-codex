#!/usr/bin/env bash
set -euo pipefail
RECIPE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$RECIPE_ROOT/engine_env.sh"
TASK_ROOT="$ENGINE_RESEARCH_ROOT"
mkdir -p "$TASK_ROOT/toolchain" "$TASK_ROOT/evidence"
bash "$RECIPE_ROOT/prepare_checkout.sh"
check_engine_checkout
fetch() {
 [[ -s "$2" ]] || curl --fail --location --retry 2 "$1" --output "$2"
 printf "%s  %s\n" "$3" "$2" | sha256sum --check --status
}
fetch https://static.rust-lang.org/rustup/archive/1.29.1/x86_64-unknown-linux-gnu/rustup-init "$TASK_ROOT/toolchain/rustup-init-1.29.1" dda7234360b7f578ca8b0ddcb80145646fa61a67c1720a5abc7051b35c9fcb71
chmod +x "$TASK_ROOT/toolchain/rustup-init-1.29.1"
if [[ ! -x "$CARGO_HOME/bin/rustup" ]]; then
  "$TASK_ROOT/toolchain/rustup-init-1.29.1" -y --no-modify-path --profile minimal --default-toolchain 1.89.0 --target wasm32-unknown-unknown > "$TASK_ROOT/evidence/rustup-install.log" 2>&1
else
  rustup toolchain install 1.89.0 --profile minimal
  rustup target add --toolchain 1.89.0 wasm32-unknown-unknown
fi
fetch https://github.com/rustwasm/wasm-pack/releases/download/v0.12.1/wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz "$TASK_ROOT/toolchain/wasm-pack-0.12.1.tar.gz" 7339ba3ad776bd5fc04dd5d6b9babe952648050a54226c08206fab4ffeec621f
fetch https://github.com/rustwasm/wasm-bindgen/releases/download/0.2.100/wasm-bindgen-0.2.100-x86_64-unknown-linux-musl.tar.gz "$TASK_ROOT/toolchain/wasm-bindgen-0.2.100.tar.gz" 63d6a38deb65bd7023c02bdf382ab66b0d2c0241c8582fd3413b5a808b8aeb5b
fetch https://github.com/WebAssembly/binaryen/releases/download/version_112/binaryen-version_112-x86_64-linux.tar.gz "$TASK_ROOT/toolchain/binaryen-112.tar.gz" 25a94f8129a532b4d84b6fa305ae630bcbd379d56416c895b3daa48d5fb2523e
tar -xzf "$TASK_ROOT/toolchain/wasm-pack-0.12.1.tar.gz" -C "$TASK_ROOT/toolchain"
tar -xzf "$TASK_ROOT/toolchain/wasm-bindgen-0.2.100.tar.gz" -C "$TASK_ROOT/toolchain"
tar -xzf "$TASK_ROOT/toolchain/binaryen-112.tar.gz" -C "$TASK_ROOT/toolchain" binaryen-version_112/bin/wasm-opt
cp "$TASK_ROOT/toolchain/wasm-pack-v0.12.1-x86_64-unknown-linux-musl/wasm-pack" "$CARGO_HOME/bin/wasm-pack"
cp "$TASK_ROOT/toolchain/wasm-bindgen-0.2.100-x86_64-unknown-linux-musl/wasm-bindgen" "$CARGO_HOME/bin/wasm-bindgen"
cp "$TASK_ROOT/toolchain/binaryen-version_112/bin/wasm-opt" "$CARGO_HOME/bin/wasm-opt"
cd "$TASK_ROOT/rapier.js"
[[ "$(git rev-parse HEAD)" == 0fd32c1cbbc7018af36f09b190c16ce72fbb9301 ]]
npm ci --ignore-scripts --no-audit --no-fund > "$TASK_ROOT/evidence/npm-root-install-no-scripts.log" 2>&1
cd rapier-compat
npm ci --ignore-scripts --no-audit --no-fund > "$TASK_ROOT/evidence/npm-compat-install-no-scripts.log" 2>&1
