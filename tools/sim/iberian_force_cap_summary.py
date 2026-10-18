"""Paired cap-only screen: first 5s and full-fight common exposure, both sides."""
import gzip,json,hashlib,statistics
from pathlib import Path
P=Path('docs/research/iberian_force_cap_20261019');plan=json.loads((P/'plan.json').read_text())
K=['limb','concussion','bleed','balance','pain']
def read(p):return json.loads(gzip.decompress(p.read_bytes()))
def damage(r,side,a,b):return {k:sum(x['delta'][k] for x in r[side]['applied'] if a<=x['t']<b) for k in K}
def add(xs):return {k:sum(x[k] for x in xs) for k in K}
def death(r,side,t=0,end=1e9):
 d=r[side]['death'];return bool(d and t<=d['t']<=end+1e-8)
base=read(P/'raw/alone.json.gz');out={'method':'Both sides; per-candidate common exposure, early death retained; existing12 and fresh12 reported separately; simulated human commands, not humans.', 'groups':{}}
old=read(Path('docs/research/iberian_control_duration_20261018/raw/confirm-alone.json.gz'))
assert len(base)==len(plan['cases'])
for i in range(12):
 for key in ['health','enemy','motions','weapons','commands','duration']:
  assert base[i][key]==old[i][key],(i,key)
out['baselineExactReproduction12']=True
for cfg in plan['configs'][1:]:
 f=P/'raw'/f"{cfg['id']}.json.gz"
 if not f.exists():continue
 rows=read(f)
 if len(rows)!=len(base):continue
 assert all(a['observation']['prefixHash']==b['observation']['prefixHash'] for a,b in zip(base,rows))
 groups={}
 for name,indices in [('existing12',range(12)),('fresh12',range(12,24)),('all24',range(24))]:
  ends={i:min(base[i]['duration'],rows[i]['duration']) for i in indices}
  firsts=[i for i in indices if base[i]['observation']['first'] is not None]
  arms={}
  for arm,rs in [('alone',base),('candidate',rows)]:
   armout={}
   for side in ['health','enemy']:
    firstRows=[]
    for i in firsts:
     t=base[i]['observation']['first'];assert abs(t-rs[i]['observation']['first'])<1e-8
     firstRows.append(damage(rs[i],side,t,min(t+5,ends[i])))
    armout[side]={'first5':add(firstRows),'fullCommon':add([damage(rs[i],side,0,ends[i]) for i in indices]),
      'deathWithin5':sum(death(rs[i],side,base[i]['observation']['first'],base[i]['observation']['first']+5) for i in firsts),
      'deathsFull':sum(death(rs[i],side) for i in indices),
      'bloodLostFull':sum(rs[i][side].get('bloodLost',0) for i in indices)}
   armout.update({'breaks':[sum(len(rs[i]['weapons'][s]['breaks']) for i in indices) for s in ['player','enemy']],
    'activations':sum(len(rs[i]['motions']) for i in indices),'effects':sum(len(rs[i]['controlEvents']) for i in indices)})
   arms[arm]=armout
  details=[]
  for i in firsts:
   t=base[i]['observation']['first'];end=min(t+5,ends[i])
   details.append({'i':i,**plan['cases'][i],'first':t,'common5Seconds':end-t,'baseline':damage(base[i],'health',t,end),'candidate':damage(rows[i],'health',t,end),
    'baselineDeath':base[i]['health']['death'],'candidateDeath':rows[i]['health']['death']})
  groups[name]={'n':len(indices),'firstN':len(firsts),'commonFightSeconds':sum(ends.values()),'common5Seconds':sum(x['common5Seconds'] for x in details),
   'complete5N':sum(x['common5Seconds']>=5-1e-8 for x in details),'arms':arms,'firstDetails':details,
   'changes5':{k:{'better':sum(x['candidate'][k]<x['baseline'][k]-1e-9 for x in details),'worse':sum(x['candidate'][k]>x['baseline'][k]+1e-9 for x in details)} for k in K}}
  fmt=lambda d:'/'.join(f'{d[k]:.4f}' for k in K[:3])
  print(cfg['id'],name,'5s n',len(firsts),'secs',round(groups[name]['common5Seconds'],3),fmt(arms['alone']['health']['first5']),'->',fmt(arms['candidate']['health']['first5']),
   '30s',fmt(arms['alone']['health']['fullCommon']),'->',fmt(arms['candidate']['health']['fullCommon']),
   'dead',arms['alone']['health']['deathsFull'],arms['candidate']['health']['deathsFull'],'breaks',arms['alone']['breaks'],arms['candidate']['breaks'])
 out['groups'][cfg['id']]=groups
out['completeArms']=1+len(out['groups']);out['expectedArms']=5
(P/'summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
manifest=[{'path':str(f.relative_to(P)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'runs':len(read(f))} for f in sorted((P/'raw').glob('*.gz'))]
(P/'raw-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('baseline 12 exact; complete arms',out['completeArms'])
if out['completeArms']==5:
 arms={'alone':base,**{c['id']:read(P/'raw'/f"{c['id']}.json.gz") for c in plan['configs'][1:]}}
 commonEnds=[min(rs[i]['duration'] for rs in arms.values()) for i in range(24)]
 firsts=[i for i,r in enumerate(base) if r['observation']['first'] is not None]
 sensitivity={'commonFightSeconds':sum(commonEnds),'firstN':len(firsts),'common5Seconds':sum(min(base[i]['observation']['first']+5,commonEnds[i])-base[i]['observation']['first'] for i in firsts),'arms':{}}
 for arm,rs in arms.items():
  sensitivity['arms'][arm]={side:{'first5':add([damage(rs[i],side,base[i]['observation']['first'],min(base[i]['observation']['first']+5,commonEnds[i])) for i in firsts]),
    'full':add([damage(rs[i],side,0,commonEnds[i]) for i in range(24)])} for side in ['health','enemy']}
 out['allArmsCommonExposureSensitivity']=sensitivity
 (P/'summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 print('COMMON ALL ARMS',sensitivity['commonFightSeconds'],sensitivity['common5Seconds'])
 for arm,s in sensitivity['arms'].items():print(arm,'5',s['health']['first5'],'30',s['health']['full'],'enemy5',s['enemy']['first5'])
