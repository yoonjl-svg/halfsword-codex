from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
import subprocess,json,time
base=Path('/tmp/courtyard-cover-study-20261019');out=base/'results';out.mkdir(exist_ok=True)
jobs=[(m,c,s)for m in ['base','exact','combined']for c in ['entry_hide','entry_push','edge_north','edge_south']for s in [101,203,307]]
def run(job):
 m,c,s=job;p=out/f'{m}_{c}_{s}.json';t=time.time();r=subprocess.run(['node',str(base/'tools/sim/cover_study.mjs'),m,c,str(s),str(p),'30'],capture_output=True,text=True)
 (out/(p.stem+'.stdout')).write_text(r.stdout);(out/(p.stem+'.stderr')).write_text(r.stderr)
 return {'mode':m,'case':c,'seed':s,'exit':r.returncode,'seconds':time.time()-t}
t0=time.time();done=[]
with ThreadPoolExecutor(max_workers=2) as pool:
 for future in as_completed([pool.submit(run,j)for j in jobs]):
  r=future.result();done.append(r);print(json.dumps(r),flush=True)
(base/'batch.json').write_text(json.dumps({'jobs':done,'elapsed':time.time()-t0,'workers':2},indent=2)+'\n')
