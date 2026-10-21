#!/usr/bin/env python3
"""Extract pinned game + research-only files into a fresh directory. Never edits production src."""
from pathlib import Path
import argparse,tarfile,shutil,json,hashlib
p=argparse.ArgumentParser();p.add_argument('output',type=Path);p.add_argument('--version',choices=['1','2','3'],default='3');p.add_argument('--dependencies',type=Path,default=Path('/workspace/halfsword-codex/node_modules'));a=p.parse_args()
root=Path(__file__).resolve().parent
if a.output.exists():raise SystemExit('Use a fresh output directory')
a.output.mkdir(parents=True)
with tarfile.open(root/'source-files.tar.gz') as t:t.extractall(a.output,filter='data')
manifest=json.loads((root/'source.json').read_text())
for name,digest in manifest['files'].items():assert hashlib.sha256((a.output/name).read_bytes()).hexdigest()==digest,name
(a.output/'node_modules').symlink_to(a.dependencies.resolve(),target_is_directory=True)
for f in (root/'tools').glob('*.mjs'):shutil.copy2(f,a.output/'tools/sim'/f.name)
for f in (root/'tools').glob('*.js'):shutil.copy2(f,a.output/'src'/f.name)
if a.version!='3':shutil.copy2(root/'tools'/f'italian_opposition_research_v{a.version}.js',a.output/'src/italian_opposition_research.js')
for name in ['analyze.py','cases-pilot.json','cases-heldout.json','cases-all.json','replay.html','replay.js','capture.mjs']:
 shutil.copy2(root/name,a.output/name)
with tarfile.open(root/'raw-results.tar.gz') as t:t.extractall(a.output,filter='data')
print(a.output)
