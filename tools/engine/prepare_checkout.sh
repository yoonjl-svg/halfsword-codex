#!/usr/bin/env bash
set -euo pipefail
RECIPE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$RECIPE_ROOT/engine_env.sh"
mkdir -p "$ENGINE_RESEARCH_ROOT/evidence" "$ENGINE_RESEARCH_ROOT/toolchain"
if [[ ! -e "$ENGINE_RESEARCH_ROOT/rapier.js" ]]; then
 git clone --depth 1 --branch v0.19.3 https://github.com/dimforge/rapier.js.git "$ENGINE_RESEARCH_ROOT/rapier.js"
fi
cd "$ENGINE_RESEARCH_ROOT/rapier.js"
case "$(git remote get-url origin)" in https://github.com/dimforge/rapier.js|https://github.com/dimforge/rapier.js.git) ;; *) echo 'Unexpected engine origin' >&2; exit 1;; esac
[[ "$(git rev-parse HEAD)" == 0fd32c1cbbc7018af36f09b190c16ce72fbb9301 ]]
[[ "$(sha256sum "$RECIPE_ROOT/native_motor_binding.patch" | cut -d' ' -f1)" == a72d84ecf75566691e9fdc7cfefefcd4dea8acc0e8ade09f9cf2986250aad3b7 ]]
git diff --cached --quiet
while IFS= read -r name; do [[ "$name" == src/dynamics/impulse_joint.rs ]] || { echo "Unexpected source modification: $name" >&2; exit 1; }; done < <(git diff --name-only)
if git apply --check "$RECIPE_ROOT/native_motor_binding.patch"; then
 git apply "$RECIPE_ROOT/native_motor_binding.patch"
elif git apply --reverse --check "$RECIPE_ROOT/native_motor_binding.patch"; then
 echo 'Exact binding patch already applied; skipping'
else
 echo 'Binding patch cannot be applied or recognized; aborting' >&2; exit 1
fi
check_engine_checkout
