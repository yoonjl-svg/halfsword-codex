from pathlib import Path
import json,statistics,sys,collections
D=Path(__file__).resolve().parent
files=sorted(p for p in D.glob('raw-*.json') if p.name!='raw-manifest.json')
if files:
 rows=[r for p in files for r in json.loads(p.read_text())['rows']]
else:
 import tarfile
 with tarfile.open(D/'raw.tar.gz') as archive:
  rows=[r for name in sorted(archive.getnames()) for r in json.load(archive.extractfile(name))['rows']]
M=('limb','con','bleed')
def dmg(r,lo=0,hi=30):
 es=[e for e in r['events'] if lo-1e-8<=e['t']<=hi+1e-8]
 out={}
 for m in M:
  out[m]={'received':sum(e[m] for e in es if e['vic']==0),'dealt':sum(e[m] for e in es if e['vic']==1)};out[m]['net']=out[m]['dealt']-out[m]['received']
 out['injuries']={str(v):sum(e['vic']==v and any(e[m]>1e-8 for m in M) for e in es) for v in [0,1]}
 out['deaths']={str(v):sum(e['vic']==v and lo-1e-8<=e['t']<=hi+1e-8 for e in r['deaths']) for v in [0,1]}
 out['broken']={str(v):sum(e['vic']==v and lo-1e-8<=e['t']<=hi+1e-8 for e in r['breaks']) for v in [0,1]}
 return out

def totals(rs):
 out={'n':len(rs),'starts':0,'firedRounds':0,'autoDamageContacts':0,'withdraws':0,'deaths':[0,0],'breaks':[0,0],'exhaustions':[0,0],'spentActivation':0,'duration':sum(r['t'] for r in rs)}
 ds=[dmg(r) for r in rs]
 for m in M:out[m]={k:sum(d[m][k] for d in ds) for k in ('received','dealt','net')}
 out['injuries']=[sum(d['injuries'][str(v)] for d in ds) for v in [0,1]]
 for r in rs:
  starts=[e for e in r['triggers'] if e['type']=='start'];out['starts']+=len(starts);out['firedRounds']+=bool(starts);out['spentActivation']+=sum(e['cost'] for e in starts)
  out['withdraws']+=sum(e['type']=='withdraw' for e in r['triggers'])
  out['autoDamageContacts']+=sum(e['vic']==1 and e['autoRunning'] and any(e[m]>1e-8 for m in M) for e in r['events'])
  for v in [0,1]:
   out['deaths'][v]+=sum(e['vic']==v for e in r['deaths']);out['breaks'][v]+=sum(e['vic']==v for e in r['breaks']);out['exhaustions'][v]+=sum(e['kind']=='exhaust' and e['vic']==v for e in r['actions'])
 return out
pairs=[];errors=[]
by=collections.defaultdict(dict)
for r in rows:by[(r['variant'],r['seed'],r['policy'])][r['relaxed']]=r
for key,both in by.items():
 if len(both)<2:continue
 a,b=both[False],both[True];assert a['initial']==b['initial'],key
 anchor=None
 for x,y in zip(a['contacts'],b['contacts']):
  if x['hash']!=y['hash'] or abs(x['t']-y['t'])>1e-8:
   errors.append({'key':key,'reason':'diverged before changed trigger','t':[x['t'],y['t']]});break
  if x['fired']!=y['fired'] or x['started']!=y['started']:
   anchor=x['t'];break
 if anchor is None:
  if a['p']!=b['p'] or a['a']!=b['a'] or a['t']!=b['t']:errors.append({'key':key,'reason':'different outcome without validated anchor'})
  pairs.append({'key':key,'anchor':None});continue
 w={}
 for secs in [1,5]:
  if anchor+secs>30+1e-8:continue
  aa,bb=dmg(a,anchor,anchor+secs),dmg(b,anchor,anchor+secs)
  w[str(secs)]={'before':aa,'after':bb,'netDelta':{m:bb[m]['net']-aa[m]['net'] for m in M}}
 pairs.append({'key':key,'anchor':anchor,'oldRejected':[k for k,v in x['blocked'].items() if v],'oldStarted':x['started'],'newStarted':y['started'],'windows':w})

def win(ps,n):
 ps=[p for p in ps if str(n) in p.get('windows',{})];out={'n':len(ps)}
 for m in M:
  ds=[p['windows'][str(n)]['netDelta'][m] for p in ps]
  if not ds:continue
  out[m]={side:{k:statistics.mean(p['windows'][str(n)][side][m][k] for p in ps) for k in ('received','dealt','net')} for side in ('before','after')}
  out[m].update(delta=statistics.mean(ds),median=statistics.median(ds),better=sum(d>1e-8 for d in ds),equal=sum(abs(d)<=1e-8 for d in ds),worse=sum(d<-1e-8 for d in ds),leaveOneOutRange=[min((sum(ds)-d)/(len(ds)-1) for d in ds),max((sum(ds)-d)/(len(ds)-1) for d in ds)] if len(ds)>1 else None)
 for k in ('deaths','broken','injuries'):
  out[k]={side:[sum(p['windows'][str(n)][side][k][str(v)] for p in ps) for v in [0,1]] for side in ('before','after')}
 return out

def group(rs,ps):return {'before':totals([r for r in rs if not r['relaxed']]),'after':totals([r for r in rs if r['relaxed']]),'windows':{str(n):win(ps,n) for n in [1,5]}}
summary={'runs':len(rows),'pairedConditions':len(pairs),'errors':errors,'all':group(rows,pairs),'variants':{v:group([r for r in rows if r['variant']==v],[p for p in pairs if p['key'][0]==v]) for v in sorted(set(r['variant'] for r in rows))},'policies':{v:group([r for r in rows if r['policy']==v],[p for p in pairs if p['key'][2]==v]) for v in sorted(set(r['policy'] for r in rows))},'anchorRejections':dict(collections.Counter(k for p in pairs for k in p.get('oldRejected',[]))),'pairs':pairs}
(D/'analysis.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['pairs','policies','variants']},ensure_ascii=False,indent=2))
for v,g in summary['variants'].items():print(v, 'starts',g['before']['starts'],g['after']['starts'],'firedRounds',g['before']['firedRounds'],g['after']['firedRounds'],'dead',g['before']['deaths'],g['after']['deaths'],'1/5net',[(n,w['n'],{m:round(w[m]['delta'],4) for m in M if m in w}) for n,w in g['windows'].items()])
for v,g in summary['policies'].items():print(v,'starts',g['before']['starts'],g['after']['starts'],'dead',g['before']['deaths'],g['after']['deaths'],'1/5net',[(n,w['n'],{m:round(w[m]['delta'],4) for m in M if m in w}) for n,w in g['windows'].items()])
# Sensitivity by the six seed clusters, preserving correlation across A-D and scripts.
cluster={}
for label,ps in [('all',pairs)]+[(v,[p for p in pairs if p['key'][0]==v]) for v in summary['variants']]:
 cluster[label]={}
 for n in [1,5]:
  psn=[p for p in ps if str(n) in p.get('windows',{})]
  if not psn:continue
  seeds=sorted(set(p['key'][1] for p in psn));cluster[label][str(n)]={}
  for m in M:
   values={s:statistics.mean(p['windows'][str(n)]['netDelta'][m] for p in psn if p['key'][1]==s) for s in seeds}
   leave=[statistics.mean(p['windows'][str(n)]['netDelta'][m] for p in psn if p['key'][1]!=s) for s in seeds]
   cluster[label][str(n)][m]={'seedMeans':values,'leaveSeedOutRange':[min(leave),max(leave)]}
summary['clusterSensitivity']=cluster
summary['causes']={side:dict(collections.Counter(e['cause'] for r in rows if r['relaxed']==(side=='after') for e in r['deaths'] if e['vic']==0)) for side in ('before','after')}
summary['shortCauses']={str(n):{side:dict(collections.Counter(e['cause'] for p in pairs if str(n) in p.get('windows',{}) for r in [by[tuple(p['key'])][side=='after']] for e in r['deaths'] if e['vic']==0 and p['anchor']-1e-8<=e['t']<=p['anchor']+n+1e-8)) for side in ('before','after')} for n in [1,5]}
summary['manualTaps']={side:{'requested':sum(e['kind']=='tap' for r in rows if r['relaxed']==(side=='after') for e in r['actions']),'accepted':sum(e['kind']=='tap' and e['accepted'] for r in rows if r['relaxed']==(side=='after') for e in r['actions'])} for side in ('before','after')}
(D/'analysis.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
for side in ('before','after'):
 rs=[r for r in rows if r['relaxed']==(side=='after')]
 summary['all'][side]['startsWithAutoDamage']=sum(any(e['vic']==1 and e['serial']==s['serial'] and any(e[k]>1e-8 for k in M) for e in r['events']) for r in rs for s in r['triggers'] if s['type']=='start')
 summary['all'][side]['autoDamageTypes']=dict(collections.Counter(e['type'] for r in rs for e in r['events'] if e['vic']==1 and e['autoRunning'] and any(e[k]>1e-8 for k in M)))
(D/'analysis.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
