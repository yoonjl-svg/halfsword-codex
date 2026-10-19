from pathlib import Path
import json,statistics,math
b=Path('/tmp/courtyard-cover-study-20261019')
def avg(a):return sum(a)/len(a)
def metrics(rs):
 return dict(n=len(rs),deaths=sum(not r['player']['alive']for r in rs),survival_mean=avg([r['duration']for r in rs]),limb=sum(r['player']['damage']['limbs']for r in rs),consciousness=sum(r['player']['damage']['consciousness']for r in rs),bleed_added=sum(r['player']['damage']['bleed']for r in rs),blood_loss_mean=avg([1-r['player']['blood']for r in rs]),cover_mean=avg([r['cover']['coveredSeconds']for r in rs]),move_spent_mean=avg([r['player']['spent']['move']for r in rs]),path_mean=avg([r['player']['path']for r in rs]),camera_max=max(r['camera']['maxCameraStep']for r in rs),attack_accept=sum(r['player']['attackAccepted']for r in rs),enemy_blood_loss=avg([1-r['enemy']['blood']for r in rs]),near_seconds=avg([r['opportunity']['nearSeconds']for r in rs]),stuck_mean=avg([r['player']['stuck']for r in rs]))
report={}
for folder in ['results','followup']:
 rs=[json.loads(p.read_text())for p in (b/folder).glob('*.json')];by={m:metrics([r for r in rs if r['mode']==m])for m in ['base','exact','combined']}
 common=[]
 for key in sorted(set((r['scenario'],r['seed'])for r in rs)):
  rows=[r for r in rs if (r['scenario'],r['seed'])==key];cut=min(r['duration']for r in rows);out={'scenario':key[0],'seed':key[1],'cutoff':cut}
  for r in rows:
   f=max((f for f in r['frames']if f['t']<=cut),key=lambda f:f['t']);out[r['mode']]={'sampleTime':f['t'],'damage':f['damage']['player'],'bloodLoss':1-f['blood'],'coverSeconds':sum(max(0,min(e['end'],cut)-e['start'])for e in r['cover']['episodes']if e['start']<cut)}
  common.append(out)
 report[folder]={'groups':by,'common_time_pairs':common,'by_scenario':{sc:{m:metrics([r for r in rs if r['mode']==m and r['scenario']==sc])for m in by}for sc in sorted(set(r['scenario']for r in rs))}}
# Assert exact/combined identical when fixed edge starts erase the start intervention.
rs=[json.loads(p.read_text())for p in (b/'results').glob('*.json')];dups=[]
for sc in ['edge_north','edge_south']:
 for seed in [101,203,307]:
  a=next(r for r in rs if r['mode']=='exact'and r['scenario']==sc and r['seed']==seed);c=next(r for r in rs if r['mode']=='combined'and r['scenario']==sc and r['seed']==seed)
  aa={k:v for k,v in a.items()if k!='mode'};cc={k:v for k,v in c.items()if k!='mode'};assert aa==cc;dups.append([sc,seed])
report['fixed_start_identity_pass']=dups
# Recorded rendering rerun must match original measurements over its duration.
render=[]
for m in ['base','exact']:
 r=json.loads((b/'visual'/f'{m}.json').read_text());full=json.loads((b/'followup'/f'{m}_cover_loop_110.json').read_text());ok=r['frames']==full['frames'][:len(r['frames'])];assert ok;render.append({'mode':m,'prefix_frames_equal':ok,'n':len(r['frames'])})
report['render_replay_identity']=render
(b/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report['followup']['groups'],ensure_ascii=False,indent=2))
