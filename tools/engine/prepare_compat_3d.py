#!/usr/bin/env python3
import os
"""Official compat generation/rollup operations restricted to normal 3D."""
from pathlib import Path
import shutil,re
_research_root=Path(os.environ.get('ENGINE_RESEARCH_ROOT','/tmp/halfsword-engine-research')).resolve()
_game_root=Path(__file__).resolve().parents[2]
if _research_root == Path('/') or _research_root == _game_root or _game_root in _research_root.parents:
 raise RuntimeError('ENGINE_RESEARCH_ROOT must be outside the game repository')
root=Path(os.environ.get('ENGINE_RESEARCH_ROOT','/tmp/halfsword-engine-research')).resolve()/'rapier.js'; compat=root/'rapier-compat'
gen=compat/'gen3d'
shutil.copytree(root/'src.ts',gen,dirs_exist_ok=True)
for name in ['raw.ts','init.ts']:(gen/name).unlink(missing_ok=True)
shutil.copytree(compat/'src3d',gen,dirs_exist_ok=True)
for p in gen.rglob('*'):
 if p.is_file():
  lines=p.read_text().splitlines(keepends=True); out=[]; skip=False
  for line in lines:
   if '#if DIM2' in line: skip=True
   if not skip:out.append(line)
   if skip and '#endif' in line:skip=False
  p.write_text(''.join(out))
build=compat/'builds/3d';pkg=build/'pkg';pkg.mkdir(parents=True,exist_ok=True)
for p in (build/'wasm-build').glob('rapier_wasm*'):shutil.copy2(p,pkg/p.name)
shutil.copytree(gen,build/'gen3d',dirs_exist_ok=True)
for name in ['tsconfig.common.json','tsconfig.json']:shutil.copy2(compat/name,build/name)
shutil.copy2(compat/'tsconfig.pkg3d.json',build/'tsconfig.pkg.json')
p=pkg/'rapier_wasm3d.js';p.write_text(p.read_text().replace('import.meta.url','"<deleted>"'))
config=(compat/'rollup.config.js').read_text()
config=re.sub(r'export default \[.*?\];', 'export default [config("3d", "3d")];', config, flags=re.S)
(compat/'.engine-research-rollup3d.config.js').write_text(config)
# Official raw declaration post-build operation, safe to create before rollup.
(pkg/'raw.d.ts').write_text('export * from "./rapier_wasm3d";\n')
