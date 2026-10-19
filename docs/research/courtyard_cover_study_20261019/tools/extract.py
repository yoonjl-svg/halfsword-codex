import pathlib, subprocess, re, os, json, hashlib
base=pathlib.Path('/tmp/courtyard-cover-study-20261019');repo='/workspace/halfsword-codex';ref='44b17d86f4b8d595bc452b8a27c8901089c940ab';seen=set();todo=['tools/sim/harness_m.mjs','tools/sim/courtyard_cover.mjs','tools/sim/courtyard_camera_map.mjs','src/camera_rig.js','src/characters.js'];rows=[]
while todo:
 p=todo.pop()
 if p in seen or '/node_modules/' in '/'+p:continue
 seen.add(p)
 try:b=subprocess.check_output(['git','show',ref+':'+p],cwd=repo,stderr=subprocess.DEVNULL)
 except subprocess.CalledProcessError:continue
 out=base/p;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(b);rows.append({'path':p,'sha256':hashlib.sha256(b).hexdigest()})
 for rel in re.findall(r'''(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]''',b.decode(errors='ignore')):
  if rel.startswith('.'):todo.append(os.path.normpath(str(pathlib.PurePosixPath(p).parent/rel)))
(base/'package.json').write_text('{"type":"module"}\n')
if not (base/'node_modules').exists():(base/'node_modules').symlink_to(repo+'/node_modules',target_is_directory=True)
(base/'source.json').write_text(json.dumps({'sha':ref,'repository':'https://github.com/yoonjl-svg/halfsword','files':rows},indent=2)+'\n')
print(len(rows))
