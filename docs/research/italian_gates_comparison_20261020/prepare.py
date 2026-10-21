from pathlib import Path
import sys,subprocess,shutil,hashlib,json
here=Path(__file__).resolve().parent
repo=next(p for p in here.parents if (p/'.git').exists())
base=repo/'docs/research/italian_four_playtest_20261020'
expected=json.loads((here/'source-manifest.json').read_text())
for rel,sha in expected.items():
 p=base/rel
 if hashlib.sha256(p.read_bytes()).hexdigest()!=sha:raise RuntimeError(f'Prior lab source changed: {rel}. Restore 6f77df13 source before reproduction.')
subprocess.run([sys.executable,str(base/'prepare.py'),sys.argv[1]],check=True)
shutil.copy2(here/'gates_comparison.mjs',Path(sys.argv[1])/'tools/sim/gates_comparison.mjs')
