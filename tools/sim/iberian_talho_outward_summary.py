"""Matched human-command trials: separate motion benefit from full force penalty."""
import json,gzip,hashlib,statistics
from pathlib import Path
P=Path('docs/research/iberian_talho_outward_20261019');plan=json.loads((P/'plan.json').read_text());K=['limb','concussion','bleed','balance','pain'];ids=[c['id'] for c in plan['configs']]
def read(p):return json.loads(gzip.decompress(p.read_bytes()))
R={a:read(P/'raw'/f'{a}.json.gz') for a in ids};n=len(plan['cases']);assert all(len(rs)==n for rs in R.values())
first={i:R[ids[0]][i]['observation']['first'] for i in range(n)}
for i in range(n):
 assert len({R[a][i]['observation']['prefixHash'] for a in ids})==1,(i,'prefix')
 assert len({R[a][i]['observation']['first'] for a in ids})==1,(i,'first')
 for a in ids:
  x=R[a][i];assert x['twistAudit']['maxServoRatio']<=1+1e-9
  if a.endswith('-full'):
   assert all(e['floor']==.2 and e['duration']==1 for e in x['controlEvents'])
   if x['controlEvents']:assert x['twistAudit']['limitedFrames']>0 and abs(x['twistAudit']['minScale']-.2)<1e-9
  else:assert not x['controlEvents'] and x['twistAudit']['limitedFrames']==0
old=read(Path('docs/research/iberian_force_cap_20261019/raw/alone.json.gz'))[12:]
for i in range(12):
 for key in ['health','enemy','motions','weapons','commands','duration']:assert old[i][key]==R['outward-alone'][i][key],(i,key)
E={a:list(rs) for a,rs in R.items()};extended=[]
for a in ids:
 q=P/'extended'/f'{a}.json.gz'
 if q.exists():
  for x in read(q):E[a][x['i']]=x['row'];extended.append({'arm':a,'i':x['i']})
def dmg(r,side,start,end):
 hits=[h for h in r[side]['applied'] if start<=h['t']<end]
 return {**{k:sum(h['delta'][k] for h in hits) for k in K},'damagingHits':sum(any(h['delta'][k]>1e-9 for k in K[:3]) for h in hits)}
def death(r,side,start=0,end=1e9):
 d=r[side]['death'];return int(bool(d and start<=d['t']<=end+1e-8))
def sumd(rows):return {k:sum(x[k] for x in rows) for k in K+['damagingHits']}
def met(r,start,end,horizon):
 return {side:dmg(r,side,start,end) for side in ['health','enemy']}|{'deaths':[death(r,s,start,horizon) for s in ['health','enemy']],'commands':sum(c['action'] in ['swipe','tap'] and start<=c['t']<end for c in r['commands']),'breaks':[sum(start<=b['t']<end for b in r['weapons'][s]['breaks']) for s in ['player','enemy']]}
def sumrows(rows):
 return {s:sumd([r[s] for r in rows]) for s in ['health','enemy']}|{'deaths':[sum(r['deaths'][j] for r in rows) for j in [0,1]],'commands':sum(r['commands'] for r in rows),'breaks':[sum(r['breaks'][j] for r in rows) for j in [0,1]]}
pairs=[('native-full','outward-full'),('native-alone','native-full'),('outward-alone','outward-full'),('native-alone','outward-alone')];out={'firstPrefixAndTimeMatched':n,'oldOutwardBaselineExact':12,'pairs':{},'groups':{},'cases':plan['cases'],'lateWindowExtensions':extended}
for A,B in pairs:
 result={}
 for group,indices in [('all',list(range(n))),('previous12',list(range(12))),('fresh12',list(range(12,n)))]:
  windows={}
  for window in [1,5,30]:
   Z=R if window==30 else E
   ii=[i for i in indices if window==30 or first[i] is not None];details=[]
   for i in ii:
    start=0 if window==30 else first[i];end=min(start+window,Z[A][i]['duration'],Z[B][i]['duration']);assert end>=start
    details.append({'i':i,'start':start,'end':end,'a':met(Z[A][i],start,end,start+window),'b':met(Z[B][i],start,end,start+window)})
   aa=sumrows([x['a'] for x in details]);bb=sumrows([x['b'] for x in details])
   windows[str(window)]={'n':len(ii),'completeWindows':sum(x['end']-x['start']>=window-1e-8 for x in details),'commonSeconds':sum(x['end']-x['start'] for x in details),'a':aa,'b':bb,'details':details,'counts':{s:{k:{'lower':sum(x['b'][s][k]<x['a'][s][k]-1e-9 for x in details),'higher':sum(x['b'][s][k]>x['a'][s][k]+1e-9 for x in details),'equal':sum(abs(x['b'][s][k]-x['a'][s][k])<=1e-9 for x in details)} for k in K[:3]} for s in ['health','enemy']}}
   if group=='all':print(A,'->',B,window,'n',len(ii),'seconds',round(windows[str(window)]['commonSeconds'],3),'P', [round(aa['health'][k],5) for k in K[:3]],'->',[round(bb['health'][k],5) for k in K[:3]],'E',[round(aa['enemy'][k],5) for k in K[:3]],'->',[round(bb['enemy'][k],5) for k in K[:3]],'deaths',aa['deaths'],bb['deaths'],'breaks',aa['breaks'],bb['breaks'])
  result[group]=windows
 out['pairs'][A+'__'+B]=result
for group,indices in [('all',range(n)),('previous12',range(12)),('fresh12',range(12,n))]:
 out['groups'][group]={a:{'effects':sum(len(rs[i]['controlEvents']) for i in indices),'eligibleContacts':sum(len(rs[i]['motions']) for i in indices),'procCases':sum(bool(rs[i]['controlEvents']) for i in indices),'deaths':[sum(death(rs[i],s) for i in indices) for s in ['health','enemy']],'staminaSpent':sum(sum(rs[i]['health']['stamina']['spent'].values()) for i in indices)} for a,rs in R.items()}
# First applied full-penalty event must agree with shared opening contact if used as a conditional benefit.
out['firstActuallyApplied']={a:[{'i':i,'firstEligible':first[i],'firstApplied':rs[i]['controlEvents'][0]['start'] if rs[i]['controlEvents'] else None} for i in range(n) if first[i] is not None] for a,rs in R.items() if a.endswith('-full')}
# Conservative common exposure across all four arms; separate from primary paired comparison.
out['all4Common']={}
for win in [1,5,30]:
 Z=R if win==30 else E
 ii=[i for i in range(n) if win==30 or first[i] is not None];rr={}
 for a,rs in Z.items():
  zz=[]
  for i in ii:
   start=0 if win==30 else first[i];end=min(start+win,*[Z[b][i]['duration'] for b in ids]);zz.append(met(rs[i],start,end,start+win))
  rr[a]=sumrows(zz)
 out['all4Common'][str(win)]=rr
# No outcome-selected reruns. Raw bytes retained with hashes.
(P/'summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(P/'raw-manifest.json').write_text(json.dumps([{'path':str(p.relative_to(P)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'runs':len(read(p))} for p in sorted([*(P/'raw').glob('*.json.gz'),*(P/'extended').glob('*.json.gz')])],indent=2)+'\n')
print('PASS all raw complete, first-prefix/time matched, old 12 exactly reproduced, cap scope audit')
# Secondary all-proc windows: union of both paired variants' eligible events,
# same clock windows for both, merge overlaps, trim to shared 30s exposure.
out['repeated5Union']={}
for A,B in pairs:
 armRows={'a':[],'b':[]};exposure=0
 for i in range(n):
  end=min(30,R[A][i]['duration'],R[B][i]['duration']);win=[]
  for t in sorted(set(e['t'] for a in [A,B] for e in R[a][i]['observation']['triggers'])):
   if t>=end:continue
   z=[t,min(t+5,end)]
   if win and z[0]<=win[-1][1]:win[-1][1]=max(win[-1][1],z[1])
   else:win.append(z)
  for start,stop in win:
   exposure+=stop-start
   for label,a in [('a',A),('b',B)]:armRows[label].append(met(R[a][i],start,stop,stop))
 out['repeated5Union'][A+'__'+B]={'commonSeconds':exposure,'a':sumrows(armRows['a']),'b':sumrows(armRows['b']),'interpretation':'descriptive union of both arms trigger windows, not independent samples'}
# Influence check: show how each omitted condition changes the primary 5s difference.
details=out['pairs']['native-full__outward-full']['all']['5']['details']
out['leaveOneCaseOut5']=[{'omit':x['i'],'delta':{side:{k:sum(y['b'][side][k]-y['a'][side][k] for y in details if y['i']!=x['i']) for k in K[:3]} for side in ['health','enemy']}} for x in details]
(P/'summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
