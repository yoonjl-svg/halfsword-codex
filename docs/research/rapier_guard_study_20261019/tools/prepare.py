"""Restore pinned research dependency tree into a fresh directory, never a checkout."""
import argparse, pathlib, json, tarfile, hashlib, shutil, subprocess
ap=argparse.ArgumentParser();ap.add_argument('target');ap.add_argument('--deps',required=True);args=ap.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent;target=pathlib.Path(args.target).resolve();target.mkdir(parents=True,exist_ok=False)
m=json.loads((root/'source.json').read_text())
with tarfile.open(root/'source-files.tar.gz') as tf:
 for name,digest in m['files'].items():
  b=tf.extractfile(name).read();assert hashlib.sha256(b).hexdigest()==digest
  p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
(target/'node_modules').symlink_to(pathlib.Path(args.deps).resolve(),target_is_directory=True)
subprocess.run(['patch','-p1','-i',str(root/'research-hook.patch')],cwd=target,check=True)
for name in ['rapier_probe.mjs','rapier_fight.mjs','rapier_pose.mjs','rapier_pose_capture.mjs']:
 shutil.copy(root/'tools'/name,target/'tools/sim'/name)
shutil.copy(root/'tools/rapier_guard_research.js',target/'src/rapier_guard_research.js')
for name in ['selection.json','validation72.json','failures12.json']:shutil.copy(root/name,target/name)
for name in ['pose.html','pose.js','poses.json']:shutil.copy(root/'tools'/name,target/name)
print(target)
