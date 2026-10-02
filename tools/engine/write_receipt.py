#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,subprocess,re,difflib,tomllib,datetime,os
_research_root=Path(os.environ.get('ENGINE_RESEARCH_ROOT','/tmp/halfsword-engine-research')).resolve()
_game_root=Path(__file__).resolve().parents[2]
if _research_root == Path('/') or _research_root == _game_root or _game_root in _research_root.parents:
 raise RuntimeError('ENGINE_RESEARCH_ROOT must be outside the game repository')
r=Path(os.environ.get('ENGINE_RESEARCH_ROOT','/tmp/halfsword-engine-research')).resolve(); repo=r/'rapier.js'; ev=r/'evidence'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(*args):return subprocess.check_output(args,cwd=repo,text=True).strip()
original_lock=subprocess.check_output(['git','show','HEAD:Cargo.lock'],cwd=repo)
assert hashlib.sha256(original_lock).hexdigest()==sha(repo/'Cargo.lock')
lock=tomllib.loads((repo/'Cargo.lock').read_text()); versions={x['name']:x['version'] for x in lock['package']}
(ev/'root-binding.diff').write_text(run('git','diff','--','src/dynamics/impulse_joint.rs')+'\n')
template=(repo/'builds/prepare_builds/templates/Cargo.toml.tera').read_text(); diffs=[]
for dim in ['2','3']:
 for suffix,features,flags in [('',[],[]),('-deterministic',['enhanced-determinism'],[]),('-simd',['simd-stable'],['--enable-simd'])]:
  name=f'rapier{dim}d{suffix}';s=template.replace('{% if dimension == "2" %}3{% else %}2{% endif %}', '3' if dim=='2' else '2')
  s=re.sub(r'{%- for feature in additional_features %}.*?{%- endfor %}', ''.join(f'\n    "{x}",' for x in features), s, flags=re.S)
  s=re.sub(r'{%- for flag in additional_wasm_opt_flags %}.*?{%- endfor %}', ''.join(f"\n    '{x}'," for x in flags), s, flags=re.S)
  s=s.replace('{{ js_package_name }}',name).replace('{{ dimension }}',dim)
  actual=(repo/'builds'/name/'Cargo.toml').read_text()
  diffs.extend(difflib.unified_diff(s.splitlines(True),actual.splitlines(True),fromfile=f'official-rendered/{name}/Cargo.toml',tofile=f'lock-faithful-generated/{name}/Cargo.toml'))
(ev/'generated-manifests.diff').write_text(''.join(diffs))
files=[repo/'Cargo.lock',repo/'package-lock.json',repo/'rapier-compat/package-lock.json',repo/'src/dynamics/impulse_joint.rs',r/'toolchain/wasm-pack-0.12.1.tar.gz',r/'toolchain/wasm-bindgen-0.2.100.tar.gz',r/'toolchain/binaryen-112.tar.gz',*sorted(Path(__file__).resolve().parent.glob('*.*'))]
files += [p for p in (repo/'rapier-compat/builds/3d/pkg').glob('*') if p.is_file()]
receipt={'createdUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseCommit':run('git','rev-parse','HEAD'),'description':'Official tag 0.19.3 source + its committed lock research rebuild; NOT reproduction of npm binary','sourceChanges':run('git','diff','--stat'),'originalBindingSHA256':hashlib.sha256(subprocess.check_output(['git','show','HEAD:src/dynamics/impulse_joint.rs'],cwd=repo)).hexdigest(),'originalCargoLockSHA256':hashlib.sha256(original_lock).hexdigest(),'bindingPatchSHA256':sha(ev/'root-binding.diff'),'historicalBuildTimesSeconds':{'firstPatchedRustRelease':21.17,'cachedRustRelease':0.05,'finalWasmPack':31.36,'rollup':4.1},'upstreamManifestMismatch':{'officialTemplatePackage':'0.19.3','generatedWorkspacePackage':'0.19.2','officialAddedDirectParryConstraint':'^0.25.3','committedLockParry3d':versions['parry3d'],'choice':'omit added direct parry dependency; src uses rapier3d re-export, preserve lock exactly'},'rapier3d':versions['rapier3d'],'wasmBindgen':versions['wasm-bindgen'],'toolchain':{'rust':'1.89.0','wasmPack':'0.12.1','target':'wasm32-unknown-unknown','binaryen':'112','node':subprocess.check_output(['node','--version'],text=True).strip(),'npm':subprocess.check_output(['npm','--version'],text=True).strip()},'command':'ENGINE_RESEARCH_ROOT=<external-dir> bash tools/engine/build_3d_compat.sh','gameNpmReplaced':False,'cargoLockUnchanged':True,'npmLocksUnchanged':run('git','diff','--','package-lock.json','rapier-compat/package-lock.json')=='','files':{str(p):sha(p) for p in files if p.is_file()}}
(ev/'build-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:receipt[k] for k in ['baseCommit','rapier3d','cargoLockUnchanged','npmLocksUnchanged']}))
