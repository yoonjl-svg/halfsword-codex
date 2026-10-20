import json,sys,statistics
from pathlib import Path
rows=json.load(open(sys.argv[1]))['rows'];pairs=[];unchanged=[];M=['limb','con','bleed']
def dmg(r,t,n):return {m:{k:sum(e[m] for e in r['events'] if e['vic']==v and t-1e-8<=e['t']<=t+n+1e-8) for k,v in [('received',0),('dealt',1)]} for m in M}
for a,b in zip(rows[::2],rows[1::2]):
 assert a['initial']==b['initial']
 if a['policy'] in ['hold','backward']:
  assert {k:v for k,v in a.items() if k!='body'}=={k:v for k,v in b.items() if k!='body'},(a['seed'],a['policy'])
  unchanged.append([a['seed'],a['policy']])
 q=next((e for e in b['triggers'] if e['type']=='stepQueued'),None)
 if not q:continue
 c=next(c for c in b['contacts'] if c['started'] and abs(c['clock']-q['t'])<1e-8)
 ca=next(ca for ca in a['contacts'] if abs(ca['t']-c['t'])<1e-8)
 assert ca['hash']==c['hash']
 t=c['t'];pairs.append({'seed':b['seed'],'policy':b['policy'],'t':t,'started':any(e['type']=='stepStarted' for e in b['triggers']),'windows':{str(n):{'before':dmg(a,t,n),'after':dmg(b,t,n),'losses':[sum(e['vic']==0 and t<=e['t']<=t+n for e in r['deaths']) for r in [a,b]]} for n in [1,5]}})
summary={'runs':len(rows),'neutral_back_identical_pairs':unchanged,'paired_requests':len(pairs),'started_pairs':sum(p['started'] for p in pairs),'events':{k:sum(e['type']==k for r in rows if r['body'] for e in r['triggers']) for k in ['start','stepQueued','stepStarted','stepCancelled','stepAssistStopped','stepFinished']},'windows':{},'totals':{},'pairs':pairs}
for n in [1,5]:
 w=summary['windows'][str(n)]={m:{side:{k:statistics.mean(p['windows'][str(n)][side][m][k] for p in pairs) for k in ['received','dealt']} for side in ['before','after']} for m in M};w['losses']=[sum(p['windows'][str(n)]['losses'][i] for p in pairs) for i in [0,1]]
for on in [False,True]:
 rs=[r for r in rows if r['body']==on];summary['totals']['on' if on else 'off']={'runs':len(rs),'losses':sum(not r['p']['alive'] for r in rs),'wins':sum(not r['a']['alive'] for r in rs),'starts':sum(e['type']=='start' for r in rs for e in r['triggers'])}
Path(__file__).with_name('analysis.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items() if k!='pairs'},indent=2))
