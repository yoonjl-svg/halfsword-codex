from pathlib import Path
import subprocess,concurrent.futures,time,json,hashlib,re
root=Path('/workspace/halfsword-pappenheimer-handoff');base=Path('/workspace/halfsword-pappenheimer-receiver');out=root/'docs/import/pappenheimer_20261025/gates';out.mkdir(exist_ok=True)
cmds={'fights12':['node','tools/sim/fights12.mjs'],'live_battery':['node','tools/sim/live_battery.mjs'],'finish_thrust':['node','tools/sim/finish_thrust.mjs','1','--stand'],'corr_s0':['node','tools/sim/corr_s0.mjs','--limits=off,on','--scenes=a,b'],'weapon_smoke':['node','tools/sim/weapon_smoke.mjs']}
def run(x):
 name,where=x;cmd=cmds[name];t=time.monotonic();p=subprocess.run(cmd,cwd=base if where=='base' else root,capture_output=True,timeout=150);(out/f'{name}-{where}.stdout').write_bytes(p.stdout);(out/f'{name}-{where}.stderr').write_bytes(p.stderr);return name,where,{'exit':p.returncode,'seconds':round(time.monotonic()-t,2),'sha256':hashlib.sha256(p.stdout).hexdigest()}
r={n:{'command':v}for n,v in cmds.items()}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for n,w,d in pool.map(run,[(n,w)for n in cmds for w in ['base','changed']]):r[n][w]=d;print(n,w,d,flush=True)
for n in cmds:
 a=(out/f'{n}-base.stdout').read_text();b=(out/f'{n}-changed.stdout').read_text()
 if n=='corr_s0':
  norm=lambda x:re.sub(r'· [0-9.]+ s\s*$','· <elapsed> s',x);r[n]['identicalScenes']=b.count('IDENTICAL');same=norm(a)==norm(b)
 elif n=='weapon_smoke':
  old='\n'.join(x for x in b.splitlines() if not x.startswith('pappenheimer'));same=old==a.rstrip();r[n]['newWeapon']=[x for x in b.splitlines() if x.startswith('pappenheimer')]
 else:same=a==b
 r[n]['existingUnchanged']=same;r[n]['pass']=same and all(r[n][w]['exit']==0 for w in ['base','changed'])
(out/'results.json').write_text(json.dumps(r,indent=2)+'\n');assert all(d['pass'] for d in r.values())
