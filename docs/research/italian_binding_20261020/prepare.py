#!/usr/bin/env python3
from pathlib import Path
import argparse,tarfile,json,hashlib,shutil
p=argparse.ArgumentParser();p.add_argument('output',type=Path);p.add_argument('--dependencies',type=Path,default=Path('/workspace/halfsword-codex/node_modules'));a=p.parse_args();root=Path(__file__).resolve().parent
if a.output.exists():raise SystemExit('Use a fresh directory')
a.output.mkdir(parents=True)
with tarfile.open(root/'source-files.tar.gz') as t:t.extractall(a.output,filter='data')
m=json.loads((root/'source.json').read_text())
for name,h in m['files'].items():assert hashlib.sha256((a.output/name).read_bytes()).hexdigest()==h,name
(a.output/'base.txt').write_text(m['sha']+'\n');(a.output/'node_modules').symlink_to(a.dependencies.resolve(),target_is_directory=True)
shutil.copy2(root/'tools/italian_binding_research.js',a.output/'src/italian_binding_research.js');shutil.copy2(root/'tools/binding_fight.mjs',a.output/'tools/sim/binding_fight.mjs')
for n in ['tradeoff_binding.py','analyze_binding.py','verify_binding.py','replay.html','replay.js','capture.mjs','failure.html','failure.js','capture-failure.mjs']:shutil.copy2(root/n,a.output/n)
with tarfile.open(root/'raw-results.tar.gz') as t:t.extractall(a.output,filter='data')
for n,suffix in [('replay','capture'),('failure','failure')]:
 rows=[json.loads((a.output/'raw'/f'{v}-{suffix}.json').read_text())['results'][0] for v in ['current','bind26']]
 (a.output/f'{n}.json').write_text(json.dumps({'results':rows}))
print(a.output)
