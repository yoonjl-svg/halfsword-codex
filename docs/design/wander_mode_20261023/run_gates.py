import concurrent.futures,hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[3];out=pathlib.Path(__file__).resolve().parent;logs=out/'logs';logs.mkdir(exist_ok=True)
old=root/'docs/design/sebastian_shoulder_structure_20261022/logs'
commands={'fights12':['node','tools/sim/fights12.mjs'],'live_battery':['node','tools/sim/live_battery.mjs'],'finish_thrust':['node','tools/sim/finish_thrust.mjs','1','--stand'],'weapon_smoke':['node','tools/sim/weapon_smoke.mjs'],'corr_s0':['node','tools/sim/corr_s0.mjs','--limits=off,on','--scenes=a,b']}
def run(item):
 name,cmd=item
 with open(logs/(name+'.stdout'),'w') as stdout,open(logs/(name+'.stderr'),'w') as stderr:r=subprocess.run(cmd,cwd=root,stdout=stdout,stderr=stderr)
 data=(logs/(name+'.stdout')).read_bytes();result={'name':name,'exit':r.returncode,'sha256':hashlib.sha256(data).hexdigest()}
 if name=='corr_s0': result['identical']=data.count(b'IDENTICAL');assert result['identical']==12,result
 else:result['unchanged']=data==(old/(name+'.stdout')).read_bytes();assert result['unchanged'],result
 assert r.returncode==0,result
 print(result,flush=True);return result
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(run,commands.items()))
(out/'gates.json').write_text(json.dumps(results,indent=2)+'\n')
