from pathlib import Path
import subprocess, concurrent.futures, hashlib, json, os
doc=Path(__file__).resolve().parent;root=Path(os.environ.get('GATE_ROOT',doc.parents[2]));out=Path(os.environ.get('GATE_OUT',doc/'gates'));out.mkdir(parents=True,exist_ok=True)
commands={'fights12':['node','tools/sim/fights12.mjs'],'live_battery':['node','tools/sim/live_battery.mjs'],'finish_thrust':['node','tools/sim/finish_thrust.mjs','1','--stand'],'weapon_smoke':['node','tools/sim/weapon_smoke.mjs'],'corr_s0':['node','tools/sim/corr_s0.mjs','--limits=off,on','--scenes=a,b']}
def run(item):
 name,cmd=item
 with (out/(name+'.stdout')).open('w')as f,(out/(name+'.stderr')).open('w')as e:p=subprocess.run(cmd,cwd=root,stdout=f,stderr=e)
 data=(out/(name+'.stdout')).read_bytes();row={'name':name,'exit':p.returncode,'sha256':hashlib.sha256(data).hexdigest()}
 if name=='corr_s0':row['identical']=data.count(b'IDENTICAL')
 print(row,flush=True);return row
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:rows=list(pool.map(run,commands.items()))
(out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');assert all(r['exit']==0 for r in rows);assert next(r for r in rows if r['name']=='corr_s0')['identical']==12
