from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
import subprocess,json,time
b=Path('/tmp/courtyard-cover-study-20261019');o=b/'followup';o.mkdir(exist_ok=True)
jobs=[(m,c,s)for m in ['base','exact','combined']for c in ['cover_loop','push_first']for s in [110,111]]
def run(j):
 m,c,s=j;p=o/f'{m}_{c}_{s}.json';t=time.time();r=subprocess.run(['node',str(b/'tools/sim/cover_study.mjs'),m,c,str(s),str(p),'30'],capture_output=True,text=True);(o/(p.stem+'.stdout')).write_text(r.stdout);(o/(p.stem+'.stderr')).write_text(r.stderr);return {'mode':m,'case':c,'seed':s,'exit':r.returncode,'seconds':time.time()-t}
t=time.time();rs=[]
with ThreadPoolExecutor(max_workers=2)as pool:
 for f in as_completed([pool.submit(run,j)for j in jobs]):r=f.result();rs.append(r);print(json.dumps(r),flush=True)
(b/'followup_batch.json').write_text(json.dumps({'jobs':rs,'elapsed':time.time()-t,'workers':2},indent=2)+'\n')
