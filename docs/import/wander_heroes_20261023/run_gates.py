import concurrent.futures,hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[3];out=pathlib.Path(__file__).resolve().parent
commands={'fights12':['node','tools/sim/fights12.mjs'],'live_battery':['node','tools/sim/live_battery.mjs'],'finish_thrust':['node','tools/sim/finish_thrust.mjs','1','--stand'],'weapon_smoke':['node','tools/sim/weapon_smoke.mjs'],'corr_s0':['node','tools/sim/corr_s0.mjs','--limits=off,on','--scenes=a,b']}
def run(item):
 name,cmd=item;result={'name':name}
 for label,cwd in [('baseline',pathlib.Path('/workspace/halfsword-current-baseline')),('delivery',root)]:
  d=out/'logs'/label;d.mkdir(parents=True,exist_ok=True)
  with (d/(name+'.stdout')).open('w') as so,(d/(name+'.stderr')).open('w') as se:r=subprocess.run(cmd,cwd=cwd,stdout=so,stderr=se)
  data=(d/(name+'.stdout')).read_bytes();result[label]={'exit':r.returncode,'sha256':hashlib.sha256(data).hexdigest()}
 result['stdoutEqual']=result['baseline']['sha256']==result['delivery']['sha256'];result['pass']=all(result[k]['exit']==0 for k in ['baseline','delivery']) and (result['stdoutEqual'] or name=='corr_s0' and data.count(b'IDENTICAL')==12)
 print(json.dumps(result),flush=True);return result
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:r=list(pool.map(run,commands.items()))
(out/'gates.json').write_text(json.dumps(r,indent=2)+'\n');assert all(x['pass'] for x in r),r
