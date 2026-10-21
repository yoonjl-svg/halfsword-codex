from pathlib import Path
import json,math,statistics,sys
p=Path(sys.argv[1]);rows=json.loads(p.read_text())['rows'];metrics=('limb','con','bleed');pairs=[]
def damage(r,t,span):
 return {m:{k:sum(e[m] for e in r['events'] if e['vic']==v and t-1e-8<=e['t']<=t+span+1e-8) for k,v in [('received',0),('dealt',1)]} for m in metrics}
for a,b in zip(rows[::2],rows[1::2]):
 assert not a['body'] and b['body'] and a['initial']==b['initial']
 ca=next((e for e in a['contacts'] if e['started']),None);cb=next((e for e in b['contacts'] if e['started']),None)
 if not ca:assert not cb;continue
 assert cb and ca['hash']==cb['hash'] and ca['t']==cb['t']
 t=ca['t'];ss=[s for s in a['bodySamples'] if s['serial']==1];tt=[s for s in b['bodySamples'] if s['serial']==1]
 rot=max(abs(y['body']['chestYaw']-x['body']['chestYaw'])*180/math.pi for x,y in zip(ss,tt))
 rigid=[]
 for x,y in zip(ss,tt):
  if x['t']>t+.25:continue
  q=x.get('chestRotationAfterPhysics');z=y.get('chestRotationAfterPhysics')
  if q and z:
   dot=sum(q[k]*z[k] for k in ['x','y','z','w'])/math.sqrt(sum(q[k]**2 for k in q)*sum(z[k]**2 for k in z))
   rigid.append(2*math.acos(min(1,abs(dot)))*180/math.pi)
 pairs.append({'rigidChestDeltaMaxDeg250ms':max(rigid) if rigid else None,'seed':a['seed'],'policy':a['policy'],'t':t,'chestDeltaMaxDeg':rot,'windows':{str(n):{'before':damage(a,t,n),'after':damage(b,t,n),'losses':[sum(e['vic']==0 and t<=e['t']<=t+n for e in r['deaths']) for r in [a,b]]} for n in [1,5]}})
out={'runs':len(rows),'pairedStarts':len(pairs),'controllerChestDeltaMedianDeg':statistics.median(x['chestDeltaMaxDeg'] for x in pairs),'windows':{},'totals':{},'pairs':pairs}
out['rigidChestDeltaMedianDeg250ms']=statistics.median(x['rigidChestDeltaMaxDeg250ms'] for x in pairs if x['rigidChestDeltaMaxDeg250ms'] is not None) if any(x['rigidChestDeltaMaxDeg250ms'] is not None for x in pairs) else None
for n in [1,5]:
 w=out['windows'][str(n)]={}
 for m in metrics:
  w[m]={side:{k:statistics.mean(x['windows'][str(n)][side][m][k] for x in pairs) for k in ['received','dealt']} for side in ['before','after']}
  w[m]['netDelta']=(w[m]['after']['dealt']-w[m]['after']['received'])-(w[m]['before']['dealt']-w[m]['before']['received'])
 w['losses']=[sum(x['windows'][str(n)]['losses'][i] for x in pairs) for i in [0,1]]
for body in [False,True]:
 rs=[r for r in rows if r['body']==body]
 out['totals']['body' if body else 'baseline']={'runs':len(rs),'starts':sum(e['type']=='start' for r in rs for e in r['triggers']),'earlyWithdraw':sum(e['type']=='withdraw' for r in rs for e in r['triggers']),'losses':sum(not r['p']['alive'] for r in rs),'wins':sum(not r['a']['alive'] for r in rs),'autoDamageContacts':sum(e['vic']==1 and e['autoRunning'] and any(e[m]>1e-8 for m in metrics) for r in rs for e in r['events'])}
Path(__file__).with_name('analysis.json').write_text(json.dumps(out,indent=2));print(json.dumps({k:v for k,v in out.items() if k!='pairs'},indent=2))
