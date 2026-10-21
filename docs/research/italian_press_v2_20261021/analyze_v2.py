import json,sys,collections,statistics
from pathlib import Path
D=json.loads(Path(sys.argv[1]).read_text());rs=D['rows'];keys=['limb','con','bleed','severity'];out={'runs':len(rs),'groups':{},'pairs':[]}
def metrics(events):return {k:sum(e[k] for e in events) for k in keys}
def summarize(rows):
 res={'bouts':len(rows),'starts':0,'hitActions':0,'meaningfulActions':0,'inRange':{'starts':0,'hits':0,'meaningful':0},'losses':sum(not r['p']['alive'] for r in rows),'wins':sum(not r['a']['alive'] for r in rows),'windows':{}}
 for r in rows:
  for s in [s for s in r['triggers'] if s['type']=='start']:
   ee=[e for e in r['events'] if e['serial']==s['serial'] and e['vic']==1 and e['autoRunning']];v=metrics(ee);hit=bool(ee);meaning=v['severity']>=.05 or v['limb']>=.02 or v['con']>=.02
   res['starts']+=1;res['hitActions']+=hit;res['meaningfulActions']+=meaning
   if s['gap']<1.9:
    res['inRange']['starts']+=1;res['inRange']['hits']+=hit;res['inRange']['meaningful']+=meaning
 for sec in [1,5]:
  received=[];dealt=[];net=[]
  for r in rows:
   press=next((a for a in r['actions'] if a['kind']=='press'),None)
   if not press:continue
   es=[e for e in r['events'] if press['t']<=e['t']<press['t']+sec]
   rec=metrics([e for e in es if e['vic']==0]);give=metrics([e for e in es if e['vic']==1]);received.append(rec);dealt.append(give);net.append({k:give[k]-rec[k] for k in keys})
  res['windows'][sec]={'n':len(net),'received':{k:statistics.mean(v[k] for v in received) for k in keys},'dealt':{k:statistics.mean(v[k] for v in dealt) for k in keys},'net':{k:statistics.mean(v[k] for v in net) for k in keys}}
 return res
for group in ['all','single','repeat',*dict.fromkeys(r['policy'] for r in rs)]:
 selected=[r for r in rs if group=='all' or group=='single' and r['policy'].startswith('single') or group=='repeat' and not r['policy'].startswith('single') or group==r['policy']]
 if not selected:continue
 out['groups'][group]={m:summarize([r for r in selected if r['mode']==m]) for m in dict.fromkeys(r['mode'] for r in selected)}
for key in sorted({(r['seed'],r['policy']) for r in rs}):
 rows=[r for r in rs if (r['seed'],r['policy'])==key];hashes=[next(e['hash'] for e in r['actions'] if e['kind']=='press') for r in rows];out['pairs'].append({'seed':key[0],'policy':key[1],'modes':len(rows),'identical':len(set(hashes))==1})
Path(sys.argv[2]).write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out['groups']['all'],indent=2))
