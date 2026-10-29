import pathlib,subprocess,concurrent.futures,hashlib,json,re
root=pathlib.Path(__file__).resolve().parents[3];doc=pathlib.Path(__file__).resolve().parent;out=doc/'gates';out.mkdir(exist_ok=True)
cmds={'fights12':['node','tools/sim/fights12.mjs'],'live_battery':['node','tools/sim/live_battery.mjs'],'finish_thrust':['node','tools/sim/finish_thrust.mjs','1','--stand'],'weapon_smoke':['node','tools/sim/weapon_smoke.mjs'],'corr_s0':['node','tools/sim/corr_s0.mjs','--limits=off,on','--scenes=a,b']}
def run(item):
 name,cmd=item
 with (out/(name+'.stdout')).open('w')as f,(out/(name+'.stderr')).open('w')as e:p=subprocess.run(cmd,cwd=root,stdout=f,stderr=e)
 data=(out/(name+'.stdout')).read_bytes();a={'name':name,'exit':p.returncode,'sha256':hashlib.sha256(data).hexdigest()}
 if name=='corr_s0':a['identical']=data.count(b'IDENTICAL')
 print(a,flush=True);return a
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:rows=list(pool.map(run,cmds.items()))
(doc/'gates.json').write_text(json.dumps(rows,indent=2)+'\n')
assert all(r['exit']==0 for r in rows)
assert next(r for r in rows if r['name']=='corr_s0')['identical']==12
