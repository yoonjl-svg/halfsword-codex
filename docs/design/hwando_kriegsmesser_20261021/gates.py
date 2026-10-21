import concurrent.futures, subprocess, pathlib, json, sys
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
cmds={'fights12':['node','tools/sim/fights12.mjs'],'live_battery':['node','tools/sim/live_battery.mjs'],'finish_thrust':['node','tools/sim/finish_thrust.mjs','1','--stand'],'corr_s0':['node','tools/sim/corr_s0.mjs','--limits=off,on','--scenes=a,b'],'weapon_smoke':['node','tools/sim/weapon_smoke.mjs']}
def run(it):
 name,cmd=it
 with (out/(name+'.stdout')).open('w') as o,(out/(name+'.stderr')).open('w') as e:r=subprocess.run(cmd,cwd=root,stdout=o,stderr=e)
 print(name,r.returncode,flush=True);return name,r.returncode
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:result=dict(pool.map(run,cmds.items()))
(out/'result.json').write_text(json.dumps(result));sys.exit(any(result.values()))
