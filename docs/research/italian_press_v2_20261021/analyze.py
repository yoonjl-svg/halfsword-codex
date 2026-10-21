import json,sys,statistics,collections
from pathlib import Path
D=json.loads(Path(sys.argv[1]).read_text());rows=D['rows'];out={'runs':len(rows),'modes':{},'pairedFirstPress':[]}
keys=['limb','con','bleed','severity']
def metric(events):return {k:sum(e[k] for e in events) for k in keys}
def average(items):return {k:statistics.mean(x[k] for x in items) if items else 0 for k in keys}
def damaging(e):return e['severity']>0 or e['limb']>0 or e['con']>0
for mode in dict.fromkeys(r['mode'] for r in rows):
 rr=[r for r in rows if r['mode']==mode];starts=sum(sum(e['type']=='start' for e in r['triggers']) for r in rr)
 hit_actions=sum(len({e['serial'] for e in r['events'] if e['vic']==1 and e['autoRunning'] and damaging(e)}) for r in rr)
 result={'bouts':len(rr),'starts':starts,'damagingActions':hit_actions,'boutsWithDamagingAction':sum(any(e['vic']==1 and e['autoRunning'] and damaging(e) for e in r['events']) for r in rr),'losses':sum(not r['p']['alive'] for r in rr),'wins':sum(not r['a']['alive'] for r in rr),'windows':{},'firstPressWindows':{}}
 for sec in [1,5]:
  received=[];dealt=[];pReceived=[];pDealt=[]
  for r in rr:
   for s in [e for e in r['triggers'] if e['type']=='start']:
    window=[e for e in r['events'] if s['t']<=e['t']<s['t']+sec]
    received.append(metric([e for e in window if e['vic']==0]));dealt.append(metric([e for e in window if e['vic']==1]))
   p=next((e for e in r['actions'] if e['kind']=='press'),None)
   if p:
    window=[e for e in r['events'] if p['t']<=e['t']<p['t']+sec]
    pReceived.append(metric([e for e in window if e['vic']==0]));pDealt.append(metric([e for e in window if e['vic']==1]))
  result['windows'][sec]={'n':len(received),'receivedMean':average(received),'dealtMean':average(dealt),'warning':'Overlapping windows and different activation times: descriptive, not an isolated causal effect.'}
  result['firstPressWindows'][sec]={'n':len(pReceived),'receivedMean':average(pReceived),'dealtMean':average(pDealt)}
 out['modes'][mode]=result
for key in sorted({(r['seed'],r['policy']) for r in rows}):
 hashes=[next(e['hash'] for e in r['actions'] if e['kind']=='press') for r in rows if (r['seed'],r['policy'])==key]
 out['pairedFirstPress'].append({'seed':key[0],'policy':key[1],'identical':len(set(hashes))==1})
Path(sys.argv[2]).write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:{s:v[s] for s in ['bouts','starts','damagingActions','losses','wins']} for k,v in out['modes'].items()},indent=2))
