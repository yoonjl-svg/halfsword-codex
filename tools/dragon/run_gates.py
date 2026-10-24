from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,hashlib,json,time,re
root=Path('/workspace/halfsword-dragon');out=root/'docs/design/dragon_20261024/gates';out.mkdir(parents=True,exist_ok=True)
commands={'fights12':['node','tools/sim/fights12.mjs'],'live_battery':['node','tools/sim/live_battery.mjs'],'finish_thrust':['node','tools/sim/finish_thrust.mjs','1','--stand'],'corr_s0':['node','tools/sim/corr_s0.mjs','--limits=off,on','--scenes=a,b'],'weapon_smoke':['node','tools/sim/weapon_smoke.mjs']}
def run(item):
 label,cmd=item;result={}
 for kind,cwd in [('base','/workspace/halfsword-whip-handoff'),('dragon',str(root))]:
  start=time.time();p=subprocess.run(cmd,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=420)
  (out/f'{label}-{kind}.stdout').write_bytes(p.stdout);(out/f'{label}-{kind}.stderr').write_bytes(p.stderr)
  clean=b'\n'.join(x for x in p.stdout.splitlines() if b'using deprecated parameters' not in x)
  if label=='corr_s0':clean=re.sub(rb' \xc2\xb7 [0-9.]+ s\s*$',b'',clean)
  result[kind]={'exit':p.returncode,'sha256':hashlib.sha256(clean).hexdigest(),'seconds':round(time.time()-start,2)}
 result['identical']=result['base']['sha256']==result['dragon']['sha256']
 print(label,json.dumps(result),flush=True);return label,result
with ThreadPoolExecutor(max_workers=2) as pool: report=dict(pool.map(run,commands.items()))
(out/'results.json').write_text(json.dumps(report,indent=2)+'\n')
